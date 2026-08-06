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

import { toIntlLocale } from '@/i18n/languages'
import { quotaUnitsToDollars } from '@/lib/format'

import type { AdminReferralRewardStatus } from '../types'

export function formatAdminReferralPaidAmount(
  amount: string,
  locale?: string
): string {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount)) return amount.trim() || '-'

  return new Intl.NumberFormat(toIntlLocale(locale), {
    maximumFractionDigits: 8,
  }).format(numericAmount)
}

export function formatAdminReferralCredits(
  quota: number,
  locale?: string
): string {
  const credits = quotaUnitsToDollars(quota)
  if (!Number.isFinite(credits)) return '-'

  return new Intl.NumberFormat(toIntlLocale(locale), {
    maximumFractionDigits: 4,
  }).format(credits)
}

export function formatAdminReferralCount(
  value: number,
  locale?: string
): string {
  if (!Number.isFinite(value)) return '-'

  return new Intl.NumberFormat(toIntlLocale(locale), {
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatAdminReferralRate(rateBasisPoints: number): string {
  if (!Number.isFinite(rateBasisPoints)) return '-'
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(rateBasisPoints / 100)}%`
}

export function getAdminReferralProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    creem: 'Creem',
    epay: 'Epay',
    stripe: 'Stripe',
    waffo: 'Waffo',
    waffo_pancake: 'Waffo Pancake',
  }
  const normalized = provider.trim().toLowerCase()
  return labels[normalized] ?? (provider.trim() || '-')
}

export function getAdminReferralStatusDisplay(
  status: AdminReferralRewardStatus,
  t: TFunction
): {
  label: string
  variant: 'success' | 'warning' | 'danger' | 'neutral'
} {
  if (status === 'awarded') {
    return { label: t('Awarded'), variant: 'success' }
  }
  if (status === 'withheld') {
    return { label: t('Withheld'), variant: 'warning' }
  }
  if (status === 'reversed') {
    return { label: t('Reversed'), variant: 'danger' }
  }
  return { label: status || t('Unknown'), variant: 'neutral' }
}
