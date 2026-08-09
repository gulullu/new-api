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
import { toIntlLocale } from '@/i18n/languages'

/**
 * Format a processor-confirmed payment amount without converting currencies.
 * Returns null when either part of the payment snapshot is unavailable.
 */
export function formatPaymentAmount(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
  locale?: string
): string | null {
  const normalizedCurrency = currency?.trim().toUpperCase()
  if (typeof amount === 'string' && amount.trim() === '') {
    return null
  }
  const numericAmount =
    typeof amount === 'number' ? amount : Number(amount?.trim())

  if (!normalizedCurrency || !Number.isFinite(numericAmount)) {
    return null
  }

  const formattedAmount = new Intl.NumberFormat(toIntlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount)

  return `${normalizedCurrency} ${formattedAmount}`
}
