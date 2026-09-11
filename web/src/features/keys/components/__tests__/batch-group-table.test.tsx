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
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { ApiKeysProvider } from '../api-keys-provider'
import { ApiKeysTable } from '../api-keys-table'

const clients: QueryClient[] = []
afterEach(() => {
  clients.forEach((client) => client.clear())
  clients.length = 0
  localStorage.clear()
})

test('batch group switching keeps selected key identities after a table refresh', async () => {
  const first = {
    id: 11,
    name: 'First key',
    key: 'masked-first',
    status: 1,
    group: 'default',
    remain_quota: 100,
    used_quota: 0,
    unlimited_quota: true,
    expired_time: -1,
    created_time: 1,
    accessed_time: 1,
    model_limits_enabled: false,
    model_limits: '',
    allow_ips: '',
  }
  const second = { ...first, id: 22, name: 'Second key', key: 'masked-second' }
  let items = [first, second]
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (String(url).startsWith('/api/user/self/groups')) {
      return {
        data: { success: true, data: { vip: { desc: 'VIP', ratio: 1 } } },
      }
    }
    return { data: { success: true, data: { items, total: 2 } } }
  })
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true, data: 1 } })
  const root = createRootRoute({ component: Outlet })
  const authenticated = createRoute({
    getParentRoute: () => root,
    id: '_authenticated',
    component: Outlet,
  })
  const keys = createRoute({
    getParentRoute: () => authenticated,
    path: 'keys/',
    component: () => (
      <ApiKeysProvider>
        <ApiKeysTable />
      </ApiKeysProvider>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([authenticated.addChildren([keys])]),
    history: createMemoryHistory({ initialEntries: ['/keys'] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )

  fireEvent.click(
    (await screen.findAllByRole('checkbox', { name: 'Select row' }))[0]
  )
  items = [second, first]
  await client.invalidateQueries({ queryKey: ['keys'] })
  await waitFor(() => {
    const checkboxes = screen.getAllByRole('checkbox', { name: 'Select row' })
    expect(checkboxes[0]).not.toBeChecked()
    expect(checkboxes[1]).toBeChecked()
  })
  fireEvent.click(screen.getByRole('button', { name: 'Switch group' }))
  expect(
    await screen.findByText('Choose a group for 1 selected API key(s).')
  ).toBeVisible()
  const selector = screen.getByRole('combobox', { name: 'Select a group' })
  await waitFor(() => expect(selector).toBeEnabled())
  fireEvent.click(selector)
  fireEvent.click(await screen.findByRole('option', { name: /vip/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/token/batch/group', {
      ids: [11],
      group: 'vip',
    })
  )
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  )
  for (const checkbox of screen.getAllByRole('checkbox', {
    name: 'Select row',
  })) {
    expect(checkbox).not.toBeChecked()
  }
})
