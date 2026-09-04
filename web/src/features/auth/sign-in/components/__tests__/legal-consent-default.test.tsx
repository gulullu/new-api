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
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { UserAuthForm } from '../user-auth-form'

const {
  login,
  useAuthRedirect,
  useAuthStore,
  useStatus,
  useTurnstile,
} = vi.hoisted(() => ({
  login: vi.fn(),
  useAuthRedirect: vi.fn(),
  useAuthStore: vi.fn(),
  useStatus: vi.fn(),
  useTurnstile: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
}))

vi.mock('@/features/auth/api', () => ({
  login,
  wechatLoginByCode: vi.fn(),
}))

vi.mock('@/features/auth/components/oauth-providers', () => ({
  OAuthProviders: () => null,
}))

vi.mock('@/features/auth/hooks/use-auth-redirect', () => ({
  useAuthRedirect,
}))

vi.mock('@/features/auth/hooks/use-turnstile', () => ({
  useTurnstile,
}))

vi.mock('@/features/auth/passkey', () => ({
  beginPasskeyLogin: vi.fn(),
  finishPasskeyLogin: vi.fn(),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus,
}))

vi.mock('@/lib/passkey', () => ({
  buildAssertionResult: vi.fn(),
  isPasskeySupported: vi.fn(async () => false),
  prepareCredentialRequestOptions: vi.fn(),
}))

vi.mock('@/components/turnstile', () => ({
  Turnstile: () => null,
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore,
}))

const statusWithLegalTerms = {
  user_agreement_enabled: true,
  privacy_policy_enabled: true,
  password_login_enabled: true,
}

describe('sign-in legal consent', () => {
  beforeEach(() => {
    useStatus.mockReturnValue({ status: statusWithLegalTerms })
    useTurnstile.mockReturnValue({
      isTurnstileEnabled: false,
      turnstileSiteKey: '',
      turnstileToken: '',
      setTurnstileToken: vi.fn(),
      validateTurnstile: vi.fn(() => true),
    })
    useAuthRedirect.mockReturnValue({
      handleLoginSuccess: vi.fn(),
      redirectTo2FA: vi.fn(),
    })
    useAuthStore.mockImplementation((selector) =>
      selector({ auth: { setPending2FAFlowToken: vi.fn() } })
    )
    login.mockReset()
  })

  test('starts checked and keeps the submit gate when the user opts out', () => {
    render(<UserAuthForm />)

    const checkbox = screen.getByRole('checkbox')
    const submit = screen.getByRole('button', { name: 'Sign in' })

    expect(checkbox).toBeChecked()
    expect(submit).toBeEnabled()

    fireEvent.click(checkbox)

    expect(checkbox).not.toBeChecked()
    expect(submit).toBeDisabled()
  })
})
