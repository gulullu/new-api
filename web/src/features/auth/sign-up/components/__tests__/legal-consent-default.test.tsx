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

import { SignUpForm } from '../sign-up-form'

const {
  register,
  useAuthRedirect,
  useEmailVerification,
  useStatus,
  useTurnstile,
} = vi.hoisted(() => ({
  register: vi.fn(),
  useAuthRedirect: vi.fn(),
  useEmailVerification: vi.fn(),
  useStatus: vi.fn(),
  useTurnstile: vi.fn(),
}))

vi.mock('@/features/auth/api', () => ({
  register,
  wechatLoginByCode: vi.fn(),
}))

vi.mock('@/features/auth/components/oauth-providers', () => ({
  OAuthProviders: () => null,
}))

vi.mock('@/features/auth/hooks/use-auth-redirect', () => ({
  useAuthRedirect,
}))

vi.mock('@/features/auth/hooks/use-email-verification', () => ({
  useEmailVerification,
}))

vi.mock('@/features/auth/hooks/use-turnstile', () => ({
  useTurnstile,
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus,
}))

vi.mock('@/components/turnstile', () => ({
  Turnstile: () => null,
}))

const statusWithLegalTerms = {
  user_agreement_enabled: true,
  privacy_policy_enabled: true,
  oauth_register_enabled: false,
}

describe('sign-up legal consent', () => {
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
      redirectToLogin: vi.fn(),
      handleLoginSuccess: vi.fn(),
    })
    useEmailVerification.mockReturnValue({
      isSending: false,
      secondsLeft: 0,
      isActive: false,
      sendCode: vi.fn(),
    })
    register.mockReset()
  })

  test('starts checked and keeps the submit gate when the user opts out', () => {
    render(<SignUpForm />)

    const checkbox = screen.getByRole('checkbox')
    const submit = screen.getByRole('button', { name: 'Create account' })

    expect(checkbox).toBeChecked()
    expect(submit).toBeEnabled()

    fireEvent.click(checkbox)

    expect(checkbox).not.toBeChecked()
    expect(submit).toBeDisabled()
  })
})
