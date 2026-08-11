import i18next from 'i18next'

import { toIntlLocale } from '@/i18n/languages'

function currentIntlLocale(): string | undefined {
  return toIntlLocale(i18next.resolvedLanguage || i18next.language)
}

export function usdFromMicros(value: number): string {
  return new Intl.NumberFormat(currentIntlLocale(), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value / 1_000_000)
}

export function microsFromUsd(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const micros =
    BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0') || '0')
  if (micros <= 0n || micros > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return Number(micros)
}

export function percentFromBasisPoints(value: number): string {
  return new Intl.NumberFormat(currentIntlLocale(), {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 10_000)
}

export function netPartnerLifetimeUsdMicros(
  earnedUsdMicros: number,
  reversedUsdMicros: number
): number {
  if (!Number.isSafeInteger(earnedUsdMicros)) return 0
  if (!Number.isSafeInteger(reversedUsdMicros)) return earnedUsdMicros
  return Math.max(0, earnedUsdMicros - reversedUsdMicros)
}

export function partnerListCount<T>(items: T[] | null | undefined): number {
  return items?.length ?? 0
}

export function partnerDate(timestamp: number): string {
  if (!timestamp) return '—'
  return new Intl.DateTimeFormat(currentIntlLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp * 1000))
}
