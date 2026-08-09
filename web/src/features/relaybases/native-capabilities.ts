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
import type { AxiosInstance } from 'axios'

export const RELAYBASES_NATIVE_FEATURES_META = 'relaybases-native-features'
export const RELAYBASES_NATIVE_FEATURES_HEADER = 'X-RelayBases-Native-Features'

/**
 * Only capabilities fully owned by this application belong here. Adding a
 * value disables the matching compatibility fallback in the edge Worker.
 */
export const RELAYBASES_NATIVE_FEATURES = [
  'language',
  'wallet',
  'auth',
  'navigation',
  'pricing',
  'favicon',
  'iframe-preferences',
  'supporting-copy',
  'log-export-ui',
  'content',
] as const

export const RELAYBASES_NATIVE_FEATURES_VALUE =
  RELAYBASES_NATIVE_FEATURES.join(',')

export function installRelayBasesNativeCapabilityInterceptor(
  client: AxiosInstance
): number {
  return client.interceptors.request.use((config) => {
    config.headers.set(
      RELAYBASES_NATIVE_FEATURES_HEADER,
      RELAYBASES_NATIVE_FEATURES_VALUE
    )
    return config
  })
}
