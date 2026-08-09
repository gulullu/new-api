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
import i18next from 'i18next'

export type RelayBasesContentLocale =
  | 'en'
  | 'zh-CN'
  | 'zh-TW'
  | 'fr'
  | 'ja'
  | 'ru'
  | 'vi'

export function toRelayBasesContentLocale(
  value?: string | null
): RelayBasesContentLocale {
  const normalized = (value || '').trim().replaceAll('_', '-').toLowerCase()

  if (
    normalized === 'zhtw' ||
    normalized === 'zh-tw' ||
    normalized === 'zh-hk' ||
    normalized === 'zh-mo' ||
    normalized.startsWith('zh-hant')
  ) {
    return 'zh-TW'
  }
  if (
    normalized === 'zhcn' ||
    normalized === 'zh' ||
    normalized === 'zh-cn' ||
    normalized === 'zh-sg' ||
    normalized.startsWith('zh-hans')
  ) {
    return 'zh-CN'
  }
  if (normalized === 'fr' || normalized.startsWith('fr-')) return 'fr'
  if (normalized === 'ja' || normalized.startsWith('ja-')) return 'ja'
  if (normalized === 'ru' || normalized.startsWith('ru-')) return 'ru'
  if (normalized === 'vi' || normalized.startsWith('vi-')) return 'vi'
  return 'en'
}

export function currentRelayBasesContentLocale(): RelayBasesContentLocale {
  return toRelayBasesContentLocale(
    i18next.resolvedLanguage || i18next.language || 'en'
  )
}

export function relayBasesContentRequestConfig(locale?: string | null) {
  const normalized = toRelayBasesContentLocale(
    locale || currentRelayBasesContentLocale()
  )
  return {
    locale: normalized,
    params: { locale: normalized },
    headers: {
      'X-Locale': normalized,
    },
  }
}

export function relayBasesContentQueryKey(
  resource: 'status' | 'notice',
  locale: RelayBasesContentLocale
) {
  return [resource, locale] as const
}
