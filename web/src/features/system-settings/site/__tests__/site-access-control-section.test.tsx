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
import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getSiteAccessPolicy, updateSiteAccessPolicy } = vi.hoisted(() => ({
  getSiteAccessPolicy: vi.fn(),
  updateSiteAccessPolicy: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (value: string) => value }),
}))

vi.mock('../../api', () => ({
  getSiteAccessPolicy,
  updateSiteAccessPolicy,
}))

import { SiteAccessControlSection } from '../site-access-control-section'

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SiteAccessControlSection />
    </QueryClientProvider>
  )
}

describe('site access control', () => {
  beforeEach(() => {
    getSiteAccessPolicy.mockResolvedValue({
      success: true,
      data: { enabled: true, configured: true, degraded: false },
    })
    updateSiteAccessPolicy.mockReset()
  })

  test('loads the enabled state and persists a switch change', async () => {
    updateSiteAccessPolicy.mockResolvedValue({
      success: true,
      data: { enabled: false, configured: true, degraded: false },
    })
    renderSection()

    const toggle = await screen.findByRole('switch', {
      name: 'Block mainland China website access',
    })
    expect(toggle).toBeChecked()

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(updateSiteAccessPolicy).toHaveBeenCalledWith(false)
    })
    expect(toggle).not.toBeChecked()
  })

  test('restores the previous state when the policy update fails', async () => {
    updateSiteAccessPolicy.mockRejectedValue(new Error('backend unavailable'))
    renderSection()

    const toggle = await screen.findByRole('switch', {
      name: 'Block mainland China website access',
    })
    fireEvent.click(toggle)

    await waitFor(() => expect(toggle).toBeChecked())
  })
})
