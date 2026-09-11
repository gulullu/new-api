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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { ApiKeysBatchGroupDialog } from '../api-keys-batch-group-dialog'
import { ApiKeysProvider } from '../api-keys-provider'

const clients: QueryClient[] = []
afterEach(() => {
  clients.forEach((client) => client.clear())
  clients.length = 0
})

function renderDialog(ids = [11, 22]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <ApiKeysProvider>
        <ApiKeysBatchGroupDialog
          ids={ids}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </ApiKeysProvider>
    </QueryClientProvider>
  )
  return { onClose, onSuccess }
}

const groups = {
  data: {
    success: true,
    data: {
      vip: { desc: 'VIP', ratio: 1 },
      auto: { desc: 'Global order', ratio: 1 },
    },
  },
}

test('choosing a group updates only selected IDs and blocks duplicate confirmation while saving', async () => {
  vi.spyOn(api, 'get').mockResolvedValue(groups)
  let finish!: (value: { data: { success: boolean; data: number } }) => void
  const put = vi.spyOn(api, 'put').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const events = renderDialog()
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  const selector = screen.getByRole('combobox')
  await waitFor(() => expect(selector).toBeEnabled())
  fireEvent.click(selector)
  fireEvent.click(await screen.findByRole('option', { name: /vip/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  expect(put).toHaveBeenCalledWith('/api/token/batch/group', {
    ids: [11, 22],
    group: 'vip',
  })
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  expect(put).toHaveBeenCalledTimes(1)
  finish({ data: { success: true, data: 2 } })
  await waitFor(() => expect(events.onSuccess).toHaveBeenCalledOnce())
  expect(events.onClose).toHaveBeenCalledOnce()
})

test('selecting Cross-group explains that the global order will be used', async () => {
  vi.spyOn(api, 'get').mockResolvedValue(groups)
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true, data: 2 } })
  renderDialog()
  const selector = screen.getByRole('combobox')
  await waitFor(() => expect(selector).toBeEnabled())
  fireEvent.click(selector)
  fireEvent.click(await screen.findByRole('option', { name: /Cross-group/ }))
  expect(
    screen.getByText('Switching to Cross-group uses the global group order.')
  ).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/token/batch/group', {
      ids: [11, 22],
      group: 'auto',
    })
  )
})

test.each(['rejected', 'network'])(
  'a %s update keeps the dialog open and displays an error',
  async (failure) => {
    vi.spyOn(api, 'get').mockResolvedValue(groups)
    const put = vi.spyOn(api, 'put')
    if (failure === 'network') put.mockRejectedValue(new Error('offline'))
    else {
      put.mockResolvedValue({
        data: { success: false, message: 'Group no longer available' },
      })
    }
    const events = renderDialog()
    const selector = screen.getByRole('combobox')
    await waitFor(() => expect(selector).toBeEnabled())
    fireEvent.click(selector)
    fireEvent.click(await screen.findByRole('option', { name: /vip/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      failure === 'network'
        ? 'Failed to switch API key groups'
        : 'Group no longer available'
    )
    expect(events.onSuccess).not.toHaveBeenCalled()
    expect(events.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled()
  }
)

test.each(['empty', 'failed'])(
  '%s group loading prevents confirmation',
  async (state) => {
    const get = vi.spyOn(api, 'get')
    if (state === 'failed') get.mockRejectedValue(new Error('offline'))
    else get.mockResolvedValue({ data: { success: true, data: {} } })
    renderDialog()
    if (state === 'failed') {
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Failed to load groups'
      )
    } else expect(await screen.findByText('No group found.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  }
)

test('cancelling without a target group performs no mutation', async () => {
  vi.spyOn(api, 'get').mockResolvedValue(groups)
  const put = vi.spyOn(api, 'put')
  const events = renderDialog()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(events.onClose).toHaveBeenCalledOnce()
  expect(put).not.toHaveBeenCalled()
})
