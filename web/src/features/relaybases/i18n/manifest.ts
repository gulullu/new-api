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
import en from './locales/en.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh.json'

export const RELAYBASES_I18N_NAMESPACE = 'relaybases'

export const relayBasesI18nResources = {
  en,
  zhCN,
  fr,
  ru,
  ja,
  vi,
  zhTW,
} as const

export type RelayBasesLocaleCode = keyof typeof relayBasesI18nResources

export function toRelayBasesLocaleCode(
  value?: string | null
): RelayBasesLocaleCode {
  const normalized = (value || '').trim().replaceAll('_', '-').toLowerCase()

  if (
    normalized === 'zhtw' ||
    normalized === 'zh-tw' ||
    normalized === 'zh-hk' ||
    normalized === 'zh-mo' ||
    normalized.startsWith('zh-hant')
  ) {
    return 'zhTW'
  }
  if (
    normalized === 'zhcn' ||
    normalized === 'zh' ||
    normalized === 'zh-cn' ||
    normalized === 'zh-sg' ||
    normalized.startsWith('zh-hans')
  ) {
    return 'zhCN'
  }
  if (normalized === 'fr' || normalized.startsWith('fr-')) return 'fr'
  if (normalized === 'ja' || normalized.startsWith('ja-')) return 'ja'
  if (normalized === 'ru' || normalized.startsWith('ru-')) return 'ru'
  if (normalized === 'vi' || normalized.startsWith('vi-')) return 'vi'
  return 'en'
}

export function getRelayBasesI18nResource(value?: string | null) {
  return relayBasesI18nResources[toRelayBasesLocaleCode(value)]
}
