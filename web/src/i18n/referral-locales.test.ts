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

import { REFERRAL_I18N_KEYS } from './static-keys'

const localeNames = ['en', 'zh', 'zh-TW', 'fr', 'ja', 'ru', 'vi'] as const

type LocaleResource = {
  translation: Record<string, string>
}

const localeEntries = await Promise.all(
  localeNames.map(async (locale) => {
    const source = await readFile(
      new URL(`./locales/${locale}.json`, import.meta.url),
      'utf8'
    )
    return [locale, JSON.parse(source) as LocaleResource] as const
  })
)

const locales = Object.fromEntries(localeEntries) as Record<
  (typeof localeNames)[number],
  LocaleResource
>

describe('referral locale coverage', () => {
  test('provides a native value for every supported locale', () => {
    for (const key of REFERRAL_I18N_KEYS) {
      for (const locale of localeNames) {
        const value = locales[locale].translation[key]
        assert.equal(
          typeof value,
          'string',
          `${locale} is missing referral key: ${key}`
        )
        assert.notEqual(
          value.trim(),
          '',
          `${locale} has an empty value: ${key}`
        )
        if (locale !== 'en') {
          assert.notEqual(
            value,
            key,
            `${locale} falls back to English for: ${key}`
          )
        }
      }
    }
  })
})
