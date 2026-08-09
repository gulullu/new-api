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
import type { TFunction } from 'i18next'

import { formatPaymentAmount } from '@/lib/payment-amount'

import type { ReferralRewardStatus } from '../types'

export function formatReferralPaidAmount(
  amount: string,
  currency: string,
  locale?: string
): string {
  return formatPaymentAmount(amount, currency, locale) ?? '-'
}

export function formatReferralRewardRate(rateBasisPoints: number): string {
  if (!Number.isFinite(rateBasisPoints)) return '-'

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(rateBasisPoints / 100)}%`
}

export function getReferralPaymentProviderLabel(provider: string): string {
  const normalizedProvider = provider.trim().toLowerCase()
  const labels: Record<string, string> = {
    creem: 'Creem',
    epay: 'Epay',
    stripe: 'Stripe',
    waffo: 'Waffo',
    waffo_pancake: 'Waffo Pancake',
  }

  return labels[normalizedProvider] ?? (provider.trim() || '-')
}

export function getReferralRewardStatusDisplay(
  status: ReferralRewardStatus,
  t: TFunction
): {
  label: string
  variant: 'success' | 'danger' | 'warning' | 'neutral'
} {
  if (status === 'awarded') {
    return { label: t('Awarded'), variant: 'success' }
  }
  if (status === 'reversed') {
    return { label: t('Reversed'), variant: 'danger' }
  }
  if (status === 'withheld') {
    return { label: t('Withheld'), variant: 'warning' }
  }

  return { label: status || t('Unknown'), variant: 'neutral' }
}
