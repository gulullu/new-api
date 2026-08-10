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
  postRelayBasesDocumentPreferences,
  relayBasesDocumentFrameSandbox,
  relayBasesDocumentLanguage,
  withRelayBasesDocumentPreferences,
} from './document-preferences'

describe('RelayBases document preferences', () => {
  test('preserves every supported interface locale for linked documents', () => {
    assert.equal(relayBasesDocumentLanguage('zhCN'), 'zh-CN')
    assert.equal(relayBasesDocumentLanguage('zh-Hans-CN'), 'zh-CN')
    assert.equal(relayBasesDocumentLanguage('zhTW'), 'zh-TW')
    assert.equal(relayBasesDocumentLanguage('zh-Hant-TW'), 'zh-TW')
    assert.equal(relayBasesDocumentLanguage('zh-HK'), 'zh-TW')
    assert.equal(relayBasesDocumentLanguage('zh-MO'), 'zh-TW')
    assert.equal(relayBasesDocumentLanguage('fr-FR'), 'fr')
    assert.equal(relayBasesDocumentLanguage('ja-JP'), 'ja')
    assert.equal(relayBasesDocumentLanguage('ru-RU'), 'ru')
    assert.equal(relayBasesDocumentLanguage('vi-VN'), 'vi')
    assert.equal(relayBasesDocumentLanguage('de-DE'), 'en')
  })

  test('adds language and theme only to RelayBases URLs', () => {
    assert.equal(
      withRelayBasesDocumentPreferences(
        'https://site.relaybases.com/usage-doc.html?section=keys',
        'zhCN',
        'dark'
      ),
      'https://site.relaybases.com/usage-doc.html?section=keys&lang=zh-CN&theme=dark'
    )
    assert.equal(
      withRelayBasesDocumentPreferences(
        'https://example.com/docs?section=keys',
        'fr',
        'light'
      ),
      'https://example.com/docs?section=keys'
    )
    assert.equal(
      withRelayBasesDocumentPreferences(
        'https://canvas.relaybases.com/',
        'fr-FR',
        'light'
      ),
      'https://canvas.relaybases.com/?lang=fr&theme=light'
    )
  })

  test('keeps the trusted site homepage preference bridge compatible', () => {
    assert.match(
      relayBasesDocumentFrameSandbox(
        'https://site.relaybases.com/index.html',
        'allow-scripts allow-forms'
      ),
      /allow-same-origin/
    )
    assert.equal(
      relayBasesDocumentFrameSandbox(
        'https://example.com/index.html',
        'allow-scripts allow-forms'
      ),
      'allow-scripts allow-forms'
    )

    const calls: Array<{ message: unknown; origin: string }> = []
    const frame = {
      contentWindow: {
        postMessage: (message: unknown, origin: string) => {
          calls.push({ message, origin })
        },
      },
    } as unknown as HTMLIFrameElement
    postRelayBasesDocumentPreferences(
      frame,
      'https://site.relaybases.com/index.html',
      'zhTW',
      'dark'
    )
    assert.deepEqual(calls, [
      {
        message: {
          type: 'relaybases:prefs',
          theme: 'dark',
          lang: 'zh-TW',
          market: '',
        },
        origin: 'https://site.relaybases.com',
      },
    ])
  })
})
