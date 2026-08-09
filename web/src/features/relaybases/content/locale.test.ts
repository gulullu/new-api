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
import { describe, test } from 'node:test'

import {
  relayBasesContentQueryKey,
  relayBasesContentRequestConfig,
  toRelayBasesContentLocale,
} from './locale'

describe('RelayBases content locale', () => {
  test('normalizes all seven interface languages', () => {
    assert.equal(toRelayBasesContentLocale('en-US'), 'en')
    assert.equal(toRelayBasesContentLocale('zhCN'), 'zh-CN')
    assert.equal(toRelayBasesContentLocale('zh-Hant'), 'zh-TW')
    assert.equal(toRelayBasesContentLocale('fr-FR'), 'fr')
    assert.equal(toRelayBasesContentLocale('ja-JP'), 'ja')
    assert.equal(toRelayBasesContentLocale('ru-RU'), 'ru')
    assert.equal(toRelayBasesContentLocale('vi-VN'), 'vi')
  })

  test('sends a normalized explicit locale to content endpoints', () => {
    const request = relayBasesContentRequestConfig('zhTW')
    assert.deepEqual(request.params, { locale: 'zh-TW' })
    assert.deepEqual(request.headers, { 'X-Locale': 'zh-TW' })
  })

  test('separates status and notice caches by locale', () => {
    assert.deepEqual(relayBasesContentQueryKey('status', 'fr'), [
      'status',
      'fr',
    ])
    assert.notDeepEqual(
      relayBasesContentQueryKey('notice', 'ja'),
      relayBasesContentQueryKey('notice', 'en')
    )
  })
})
