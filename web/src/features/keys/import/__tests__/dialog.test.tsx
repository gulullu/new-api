/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { ApiKeysProvider } from '../../components/api-keys-provider'
import { ApiKeysImportDialog } from '../dialog'
import type { ImportItem } from '../types'

const clients: QueryClient[] = []
afterEach(() => {
  clients.forEach((c) => c.clear())
  clients.length = 0
})
function renderDialog() {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: {
      success: true,
      data: url.includes('groups')
        ? {
            default: { desc: 'Default', ratio: 1 },
            vip: { desc: 'Priority access', ratio: 2 },
            parnter: { desc: 'Internal', ratio: 1 },
            auto: { desc: 'Auto', ratio: 1 },
          }
        : [],
    },
  }))
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <ApiKeysProvider>
        <ApiKeysImportDialog onClose={onClose} />
      </ApiKeysProvider>
    </QueryClientProvider>
  )
  return onClose
}
async function pasteRows(text = 'Alice\nBob') {
  fireEvent.click(screen.getByRole('button', { name: 'Paste table' }))
  fireEvent.change(
    screen.getByLabelText('Paste names or a spreadsheet table'),
    { target: { value: text } }
  )
  fireEvent.click(screen.getByRole('button', { name: 'Import into table' }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Next: confirm configuration' })
    ).toBeEnabled()
  )
}

async function choose(label: string, option: string | RegExp) {
  fireEvent.click(screen.getByRole('combobox', { name: label }))
  const item = await screen.findByRole('option', { name: option })
  if (item.hasAttribute('cmdk-item')) fireEvent.click(item)
  else fireEvent.keyDown(item, { key: 'Enter', code: 'Enter' })
}

test('pastes, edits row groups, previews and retries uncertain creation without duplicate IDs', async () => {
  let attempts = 0
  const post = vi.spyOn(api, 'post').mockImplementation(async (url, data) => {
    if (url.endsWith('/preview')) {
      for (const item of (data as { items: ImportItem[] }).items) {
        expect(item).toMatchObject({
          unlimited_quota: true,
          remain_quota: 0,
          expired_time: -1,
        })
      }
      return {
        data: {
          success: true,
          data: { existing_names: ['Alice'], remaining: 50 },
        },
      }
    }
    attempts++
    if (attempts === 1) throw new Error('connection lost after commit')
    return {
      data: {
        success: true,
        data: (data as { items: ImportItem[] }).items.map(
          (item: object, index: number) => ({
            ...item,
            id: index + 1,
            key: `sk-fixture-${index}`,
          })
        ),
      },
    }
  })
  const close = renderDialog()
  expect(
    screen.getByRole('button', { name: 'Next: confirm configuration' })
  ).toBeDisabled()
  await pasteRows()
  await choose('Group for row 2', /^vip/)
  fireEvent.click(
    screen.getByRole('button', { name: 'Next: confirm configuration' })
  )
  const confirm = await screen.findByRole('button', {
    name: 'Confirm creation',
  })
  expect(confirm).toBeDisabled()
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'Create additional keys with these names; keep existing keys unchanged.',
    })
  )
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Confirm creation' })
    ).toBeEnabled()
  )
  fireEvent.click(screen.getByRole('button', { name: 'Confirm creation' }))
  expect(
    await screen.findByRole('button', { name: 'Retry this import' })
  ).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Back to edit' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry this import' }))
  await screen.findByText('sk-fixture-0')
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled()
  const requests = post.mock.calls.filter(
    ([url]) => url === '/api/token/batch/import'
  )
  expect(requests).toHaveLength(2)
  expect(requests[0][1]).toEqual(requests[1][1])
  expect(requests[0][1]).toMatchObject({
    allow_existing_names: true,
    items: [
      { name: 'Alice', group: 'default' },
      { name: 'Bob', group: 'vip' },
    ],
  })
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(close).toHaveBeenCalledOnce()
})

test('batch edits selected rows, restores inheritance and rejects duplicate names', async () => {
  renderDialog()
  await pasteRows()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select row 2' }))
  await choose('Batch group', /^Cross-group/)
  fireEvent.click(screen.getByRole('button', { name: 'Apply group' }))
  expect(screen.getByLabelText('Group for row 1')).toHaveTextContent(
    'Inherit template'
  )
  expect(screen.getByLabelText('Group for row 2')).toHaveTextContent(
    'Cross-group'
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Restore template defaults' })
  )
  expect(screen.getByLabelText('Group for row 2')).toHaveTextContent(
    'Inherit template'
  )
  fireEvent.change(screen.getByLabelText('Name for row 2'), {
    target: { value: 'Alice' },
  })
  expect(
    screen.getByRole('button', { name: 'Next: confirm configuration' })
  ).toBeDisabled()
  expect(screen.getAllByText('Duplicate name in this import')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Remove selected rows' }))
  expect(screen.queryByLabelText('Name for row 2')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Next: confirm configuration' })
  ).toBeEnabled()
})

test('allows corrections after a definite server rejection', async () => {
  vi.spyOn(api, 'post').mockImplementation(async (url) => ({
    data: url.endsWith('/preview')
      ? { success: true, data: { existing_names: [], remaining: 100 } }
      : { success: false, message: 'API key limit exceeded' },
  }))
  renderDialog()
  await pasteRows('Project')
  fireEvent.click(
    screen.getByRole('button', { name: 'Next: confirm configuration' })
  )
  fireEvent.click(
    await screen.findByRole('button', { name: 'Confirm creation' })
  )
  await screen.findByText('API key limit exceeded')
  expect(screen.getByRole('button', { name: 'Back to edit' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }))
  expect(screen.getByLabelText('Name for row 1')).toHaveValue('Project')
})

test('saves reusable defaults and loads them without copying key rows into a template', async () => {
  renderDialog()
  const templates: Array<{ id: number; name: string; defaults: object }> = []
  vi.mocked(api.get).mockImplementation(async (url) => {
    let data: unknown = []
    if (url.includes('import-templates')) data = templates
    else if (url.includes('groups')) {
      data = {
        default: { desc: 'Default', ratio: 1 },
        vip: { desc: 'VIP', ratio: 2 },
      }
    }
    return { data: { success: true, data } }
  })
  const post = vi.spyOn(api, 'post').mockImplementation(async (url, data) => {
    expect(url).toBe('/api/token/import-templates')
    const saved = { id: 1, ...(data as { name: string; defaults: object }) }
    templates.push(saved)
    return { data: { success: true, data: saved } }
  })
  await pasteRows('Team A')
  await choose('Group', /^vip/)
  expect(
    screen.getAllByRole('checkbox', { name: 'Unlimited' })[0]
  ).toBeChecked()
  expect(screen.getByLabelText('Quota')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Save as template' }))
  fireEvent.change(screen.getByLabelText('Template name'), {
    target: { value: 'Shared configuration' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(screen.getByLabelText('Select import template')).toHaveTextContent(
      'Shared configuration'
    )
  )
  expect(post.mock.calls[0][1]).toEqual({
    name: 'Shared configuration',
    defaults: {
      group: 'vip',
      remain_quota: 0,
      unlimited_quota: true,
      expiry: 'never',
      model_limits: '',
      allow_ips: '',
    },
  })
  await choose('Group', /^default/)
  expect(screen.getByLabelText('Select import template')).toHaveTextContent(
    'Custom configuration'
  )
  await choose('Select import template', 'Shared configuration')
  expect(screen.getByLabelText('Group')).toHaveTextContent('vip')
  expect(screen.getByLabelText('Name for row 1')).toHaveValue('Team A')
})

test('imports an Excel file into editable rows without creating keys', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: {
      success: true,
      data: {
        text: 'name,group,quota,expiry,models,ips\n001 Device,vip,10,never,*,*\n',
      },
    },
  })
  renderDialog()
  const file = new File(['xlsx fixture'], 'filled-template.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  fireEvent.change(screen.getByLabelText('Import file'), {
    target: { files: [file] },
  })
  await waitFor(() =>
    expect(screen.getByDisplayValue('001 Device')).toBeInTheDocument()
  )
  expect(screen.getByLabelText('Group for row 1')).toHaveTextContent('vip')
  expect(post).toHaveBeenCalledTimes(1)
  expect(post.mock.calls[0][0]).toBe('/api/token/batch/import/file')
  expect((post.mock.calls[0][1] as FormData).get('file')).toBe(file)
  expect(
    screen.getByRole('button', { name: 'Next: confirm configuration' })
  ).toBeEnabled()
})

test('shows searchable group descriptions and ratios while hiding internal groups', async () => {
  renderDialog()
  await pasteRows('Team')
  fireEvent.click(screen.getByRole('combobox', { name: 'Group for row 1' }))
  const vip = await screen.findByRole('option', { name: /^vip/ })
  expect(within(vip).getByText('Priority access')).toBeInTheDocument()
  expect(within(vip).getByText('2x Ratio')).toBeInTheDocument()
  expect(
    screen.queryByRole('option', { name: /parnter/i })
  ).not.toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText('Search...'), {
    target: { value: 'Priority' },
  })
  expect(
    screen.queryByRole('option', { name: /^default/ })
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('option', { name: /^vip/ }))
  await choose('Group for row 1', /^Inherit template/)
  expect(screen.getByLabelText('Group for row 1')).toHaveTextContent(
    'Inherit template'
  )
})

test('changes expiration with the built-in selector and restores unlimited validity', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: { existing_names: [], remaining: 100 } },
  })
  renderDialog()
  await pasteRows('Service A\nService B')
  await choose('Expiration', '7 days after creation')
  await choose('Expiration for row 2', 'Custom date')
  fireEvent.change(screen.getByLabelText('Date for row 2'), {
    target: { value: '2030-12-31' },
  })
  await choose('Expiration for row 2', 'Never')
  fireEvent.click(
    screen.getByRole('button', { name: 'Next: confirm configuration' })
  )
  await screen.findByRole('button', { name: 'Confirm creation' })
  const items = (post.mock.calls[0][1] as { items: ImportItem[] }).items
  expect(items[0].expired_time).toBeGreaterThan(
    Math.floor(Date.now() / 1000) + 6 * 86400
  )
  expect(items[1].expired_time).toBe(-1)
})
