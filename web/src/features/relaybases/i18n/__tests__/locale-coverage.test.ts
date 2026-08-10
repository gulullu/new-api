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

const localeNames = ['en', 'zh', 'zh-TW', 'fr', 'ja', 'ru', 'vi'] as const

type LocaleTree = string | { [key: string]: LocaleTree }

async function readLocale(locale: (typeof localeNames)[number]) {
  const source = await readFile(
    new URL(`../locales/${locale}.json`, import.meta.url),
    'utf8'
  )
  return JSON.parse(source) as Record<string, LocaleTree>
}

function flattenLocale(
  value: Record<string, LocaleTree>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof child === 'string') {
      result[path] = child
    } else {
      Object.assign(result, flattenLocale(child, path))
    }
  }
  return result
}

const localeEntries = await Promise.all(
  localeNames.map(
    async (locale) => [locale, flattenLocale(await readLocale(locale))] as const
  )
)
const locales = Object.fromEntries(localeEntries) as Record<
  (typeof localeNames)[number],
  Record<string, string>
>

describe('RelayBases locale coverage', () => {
  test('keeps the same non-empty namespace keys in all seven locales', () => {
    const expectedKeys = Object.keys(locales.en).sort()
    assert.ok(expectedKeys.length > 0)

    for (const locale of localeNames) {
      assert.deepEqual(Object.keys(locales[locale]).sort(), expectedKeys)
      for (const key of expectedKeys) {
        assert.notEqual(
          locales[locale][key].trim(),
          '',
          `${locale} has an empty ${key}`
        )
      }
    }
  })

  test('renders the unified Ɍ20 minimum in every locale', () => {
    const keys = [
      'wallet.minimum.placeholder',
      'wallet.minimum.notice',
      'wallet.minimum.card',
    ]
    for (const locale of localeNames) {
      for (const key of keys) {
        assert.match(locales[locale][key], /\{\{amount\}\}/)
        const rendered = locales[locale][key].replaceAll('{{amount}}', '20')
        assert.match(rendered, /Ɍ20/)
        assert.doesNotMatch(rendered, /Ɍ100/)
      }
    }
  })

  test('provides the complete localized pricing catalog', () => {
    const modelPrefix = 'pricing.modelDescriptions.'
    const expectedModels = Object.keys(locales.en)
      .filter((key) => key.startsWith(modelPrefix))
      .sort()
    assert.equal(expectedModels.length, 61)

    for (const locale of localeNames) {
      const modelKeys = Object.keys(locales[locale])
        .filter((key) => key.startsWith(modelPrefix))
        .sort()
      assert.deepEqual(modelKeys, expectedModels)
      assert.match(locales[locale]['pricing.creditNote.body'], /Ɍ/)
      assert.match(locales[locale]['pricing.creditNote.body'], /USD/)
    }
  })

  test('preserves API paths in every localized model description', () => {
    const modelPrefix = 'pricing.modelDescriptions.'
    for (const [key, english] of Object.entries(locales.en)) {
      if (!key.startsWith(modelPrefix)) continue
      const expectedPaths = english.match(/\/v1\/[A-Za-z0-9_./-]+/g) || []
      if (expectedPaths.length === 0) continue

      for (const locale of localeNames) {
        const localizedPaths =
          locales[locale][key].match(/\/v1\/[A-Za-z0-9_./-]+/g) || []
        assert.deepEqual(localizedPaths, expectedPaths, `${locale}: ${key}`)
      }
    }
  })
})
