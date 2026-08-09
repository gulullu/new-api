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

import {
  getPaymentAmountLabelKey,
  getPaymentMethodName,
  getStatusConfig,
} from '../billing'

describe('billing history payment labels', () => {
  test('labels a successful order as an amount paid', () => {
    assert.equal(getPaymentAmountLabelKey('success'), 'Amount paid')
  })

  test('uses due only for open orders and a neutral checkout label otherwise', () => {
    assert.equal(getPaymentAmountLabelKey('pending'), 'Amount due')
    assert.equal(getPaymentAmountLabelKey('expired'), 'Checkout amount')
    assert.equal(getPaymentAmountLabelKey('failed'), 'Checkout amount')
  })

  test('shows failed orders and the Waffo Pancake provider explicitly', () => {
    assert.deepEqual(getStatusConfig('failed'), {
      variant: 'danger',
      label: 'Failed',
    })
    assert.equal(getPaymentMethodName('waffo_pancake'), 'Waffo Pancake')
  })

  test('keeps billing amount labels translated in both Chinese locales', async () => {
    const keys = [
      'Top-up credits',
      'Amount paid',
      'Amount due',
      'Checkout amount',
      'Payment currency unavailable',
    ]
    const locales = await Promise.all(
      ['en', 'zh', 'zh-TW'].map(async (locale) => {
        const source = await readFile(
          new URL(`../../../../i18n/locales/${locale}.json`, import.meta.url),
          'utf8'
        )
        return JSON.parse(source) as {
          translation: Record<string, string>
        }
      })
    )

    for (const key of keys) {
      assert.equal(typeof locales[0].translation[key], 'string')
      assert.notEqual(locales[1].translation[key], key)
      assert.notEqual(locales[2].translation[key], key)
    }
  })
})
