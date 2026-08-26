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

import type { PaymentMethod } from '../../wallet/types'
import { toRelayBasesLocaleCode } from '../i18n/manifest'

export const RELAYBASES_CREDITS_DOCS_URL =
  'https://site.relaybases.com/usage-doc.html'
export const RELAYBASES_REFUND_POLICY_URL =
  'https://site.relaybases.com/refund.html'

const PAYMENT_ORDER = new Map([
  ['stripe', 0],
  ['waffo_pancake', 1],
  ['waffo', 2],
  ['alipay', 3],
  ['wxpay', 4],
])

export function isRelayBasesChineseLanguage(language?: string | null): boolean {
  const locale = toRelayBasesLocaleCode(language)
  return locale === 'zhCN' || locale === 'zhTW'
}

export function orderRelayBasesPaymentMethods(
  methods: PaymentMethod[]
): PaymentMethod[] {
  return methods
    .map((method, index) => ({ method, index }))
    .sort((a, b) => {
      const rankA = PAYMENT_ORDER.get(a.method.type) ?? Number.MAX_SAFE_INTEGER
      const rankB = PAYMENT_ORDER.get(b.method.type) ?? Number.MAX_SAFE_INTEGER
      return rankA - rankB || a.index - b.index
    })
    .map(({ method }) => method)
}

export function selectRelayBasesDefaultPaymentMethod(
  methods: PaymentMethod[],
  topupAmount: number
): PaymentMethod | null {
  return (
    orderRelayBasesPaymentMethods(methods).find(
      (method) => (method.min_topup ?? 0) <= topupAmount
    ) ?? null
  )
}

export function getRelayBasesPaymentMethodInteractionKey(
  method: Pick<PaymentMethod, 'name' | 'type'>
): string {
  return JSON.stringify([method.type, method.name])
}

export type RelayBasesPaymentCopyKey =
  | 'wallet.payment.stripe'
  | 'wallet.payment.waffo'
  | 'wallet.payment.generic'

export function getRelayBasesPaymentCopyKey(
  paymentType: string
): RelayBasesPaymentCopyKey {
  if (paymentType === 'stripe') return 'wallet.payment.stripe'
  if (paymentType === 'waffo' || paymentType === 'waffo_pancake') {
    return 'wallet.payment.waffo'
  }
  return 'wallet.payment.generic'
}

export type RelayBasesChinesePaymentHint = 'alipay' | 'wechat' | null

/**
 * Returns the payment channel that should replace the gateway label in the
 * Chinese wallet UI.  Stripe and Waffo are still sent to the backend using
 * their original payment types; this value is presentation-only.
 */
export function getRelayBasesPaymentDisplayKind(
  paymentType: string,
  language?: string | null
): RelayBasesChinesePaymentHint {
  if (!isRelayBasesChineseLanguage(language)) return null
  if (paymentType === 'stripe') return 'alipay'
  if (paymentType === 'waffo' || paymentType === 'waffo_pancake') {
    return 'wechat'
  }
  return null
}

export function getRelayBasesChinesePaymentHint(
  paymentType: string,
  language?: string | null
): RelayBasesChinesePaymentHint {
  return getRelayBasesPaymentDisplayKind(paymentType, language)
}

function numberFormatter(
  language: string | undefined,
  minimumFractionDigits: number,
  maximumFractionDigits: number
): Intl.NumberFormat {
  return new Intl.NumberFormat(toIntlLocale(language), {
    minimumFractionDigits,
    maximumFractionDigits,
  })
}

export function formatRelayBasesCredits(
  amount: number | string,
  language?: string
): string {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) return 'Ɍ —'
  return `Ɍ ${numberFormatter(language, 0, 2).format(numeric)}`
}

export function formatRelayBasesUsd(
  amount: number | string,
  language?: string
): string {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) return 'USD —'
  return `USD ${numberFormatter(language, 2, 2).format(numeric)}`
}

export function formatRelayBasesUsdCompact(
  amount: number | string,
  language?: string
): string {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) return '$—'
  return `$${numberFormatter(language, 2, 2).format(numeric)}`
}

export function getRelayBasesCreditsDocsUrl(language?: string | null): string {
  if (isRelayBasesChineseLanguage(language)) {
    return `${RELAYBASES_CREDITS_DOCS_URL}?lang=zh#zh-credits`
  }
  return `${RELAYBASES_CREDITS_DOCS_URL}?lang=en#en-credits`
}

export function getRelayBasesPaymentGridClass(methodCount: number): string {
  if (methodCount <= 1) return 'grid grid-cols-1 gap-2.5'
  if (methodCount === 2) return 'grid grid-cols-1 gap-2.5 sm:grid-cols-2'
  if (methodCount === 3) {
    return 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3'
  }
  return 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4'
}
