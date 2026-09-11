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

test('selecting a group searches all keys from page one and clearing restores the list', async () => {
  const requests: URL[] = []
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    const request = new URL(String(url), 'https://example.test')
    requests.push(request)
    if (request.pathname === '/api/user/self/groups') {
      return {
        data: {
          success: true,
          data: {
            vip: { desc: 'VIP', ratio: 1 },
            empty: { desc: 'Empty', ratio: 1 },
          },
        },
      }
    }
    return {
      data: {
        success: true,
        data: { items: [], total: request.pathname === '/api/token/' ? 80 : 0 },
      },
    }
  })
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
    history: createMemoryHistory({ initialEntries: ['/keys?page=3'] }),
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
  fireEvent.click(await screen.findByRole('button', { name: 'Group' }))
  fireEvent.click(await screen.findByRole('option', { name: /^vip/ }))
  await waitFor(() => {
    expect(
      requests.some(
        (request) =>
          request.pathname === '/api/token/search' &&
          request.searchParams.get('group') === 'vip' &&
          request.searchParams.get('p') === '1'
      )
    ).toBe(true)
  })
  expect(screen.getAllByText('No API Keys Found').length).toBeGreaterThan(0)
  fireEvent.click(await screen.findByText('Clear filters', { exact: true }))
  await waitFor(() => {
    expect(
      requests.some(
        (request) =>
          request.pathname === '/api/token/' &&
          request.searchParams.get('p') === '1'
      )
    ).toBe(true)
  })
})
