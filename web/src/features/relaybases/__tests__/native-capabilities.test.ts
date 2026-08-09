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
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, test } from 'node:test'

import type { AxiosInstance } from 'axios'

import {
  RELAYBASES_NATIVE_FEATURES,
  RELAYBASES_NATIVE_FEATURES_HEADER,
  RELAYBASES_NATIVE_FEATURES_META,
  RELAYBASES_NATIVE_FEATURES_VALUE,
  installRelayBasesNativeCapabilityInterceptor,
} from '../native-capabilities'

describe('RelayBases native capability manifest', () => {
  test('declares only capabilities implemented by the application', () => {
    assert.deepEqual(RELAYBASES_NATIVE_FEATURES, [
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
    ])
    assert.equal(
      RELAYBASES_NATIVE_FEATURES_VALUE,
      'language,wallet,auth,navigation,pricing,favicon,iframe-preferences,supporting-copy,log-export-ui,content'
    )
  })

  test('keeps the server-readable HTML marker synchronized with the manifest', async () => {
    const html = await readFile(
      new URL('../../../../index.html', import.meta.url),
      'utf8'
    )
    const marker = html.match(
      new RegExp(
        `<meta\\s+name=["']${RELAYBASES_NATIVE_FEATURES_META}["']\\s+content=["']([^"']+)["']`
      )
    )

    assert.ok(marker)
    assert.equal(marker[1], RELAYBASES_NATIVE_FEATURES_VALUE)
  })

  test('attaches the complete manifest after per-request headers are merged', () => {
    let handler:
      | ((config: {
          headers: { set: (name: string, value: string) => void }
        }) => unknown)
      | undefined
    const fakeClient = {
      interceptors: {
        request: {
          use(value: unknown) {
            handler = value as typeof handler
            return 7
          },
        },
      },
    } as unknown as AxiosInstance
    const headers = new Map<string, string>()

    const interceptorId =
      installRelayBasesNativeCapabilityInterceptor(fakeClient)
    assert.equal(interceptorId, 7)
    assert.ok(handler)
    handler({
      headers: {
        set(name, value) {
          headers.set(name, value)
        },
      },
    })

    assert.equal(
      headers.get(RELAYBASES_NATIVE_FEATURES_HEADER),
      RELAYBASES_NATIVE_FEATURES_VALUE
    )
  })
})
