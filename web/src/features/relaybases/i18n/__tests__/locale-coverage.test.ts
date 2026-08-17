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

  test('keeps every Partner rule and withdrawal label localized', () => {
    const partnerKeys = Object.keys(locales.en).filter((key) =>
      key.startsWith('partner.')
    )
    assert.ok(partnerKeys.length > 70)
    for (const locale of localeNames) {
      assert.deepEqual(
        Object.keys(locales[locale]).filter((key) =>
          key.startsWith('partner.')
        ),
        partnerKeys
      )
    }
  })

  test('localizes every Partner audit action in all seven locales', () => {
    const auditKeys = [
      'partner.audit.configure',
      'partner.audit.balanceTransfer',
      'partner.audit.withdrawalCreate',
      'partner.audit.withdrawalReveal',
      'partner.audit.withdrawalPaid',
      'partner.audit.withdrawalReject',
    ]
    for (const locale of localeNames) {
      for (const key of auditKeys) {
        assert.ok(locales[locale][key]?.trim(), `${locale} is missing ${key}`)
      }
      assert.match(
        locales[locale]['partner.audit.configure'],
        /\{\{commission_rate_percent\}\}/
      )
      for (const key of auditKeys.slice(2)) {
        assert.match(locales[locale][key], /\{\{withdrawal_id\}\}/)
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

  test('keeps wallet payment copy reassuring without leaking China-only methods', () => {
    const paymentKeys = ['wallet.payment.stripe', 'wallet.payment.waffo']
    for (const locale of localeNames) {
      for (const key of paymentKeys) {
        assert.ok(
          locales[locale][key].length <= 120,
          `${locale}: ${key} is too long for the wallet payment card`
        )
      }
      assert.ok(
        locales[locale]['wallet.payment.action'].length <= 10,
        `${locale}: wallet.payment.action is too long`
      )
    }
    assert.equal(
      locales.zh['wallet.payment.stripe'],
      '支持银行卡和支付宝。跳转 Stripe 安全结账页，可先核对应付金额再付款。'
    )
    assert.equal(
      locales.zh['wallet.payment.waffo'],
      '支持银行卡和微信支付。跳转 Waffo 安全结账页，可先核对应付金额再付款。'
    )
    assert.equal(locales.zh['wallet.payment.action'], '去支付')

    for (const locale of ['en', 'fr', 'ja', 'ru', 'vi'] as const) {
      for (const key of paymentKeys) {
        assert.doesNotMatch(locales[locale][key], /Alipay|WeChat|支付宝|微信/)
      }
    }
  })

  test('keeps wallet discount badges compact in every locale', () => {
    for (const locale of localeNames) {
      const value = locales[locale]['wallet.labels.discountPercent']
      assert.match(value, /\{\{percent\}\}/)
      assert.ok(value.replaceAll('{{percent}}', '10').length <= 6)
    }
    assert.equal(
      locales.zh['wallet.labels.discountPercent'].replaceAll(
        '{{percent}}',
        '10'
      ),
      '省10%'
    )
  })

  test('provides the complete localized pricing catalog', () => {
    const modelPrefix = 'pricing.modelDescriptions.'
    const expectedModels = Object.keys(locales.en)
      .filter((key) => key.startsWith(modelPrefix))
      .sort()
    assert.equal(expectedModels.length, 60)
    assert.ok(expectedModels.includes('pricing.modelDescriptions.grok-4.6'))
    assert.ok(expectedModels.includes('pricing.modelDescriptions.glm-5.3'))
    assert.equal(
      expectedModels.some((key) => key.endsWith('-openai-compact')),
      false
    )

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
