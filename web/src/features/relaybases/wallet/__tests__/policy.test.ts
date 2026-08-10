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

import type { PaymentMethod } from '../../../wallet/types'
import {
  formatRelayBasesCredits,
  formatRelayBasesUsd,
  getRelayBasesChinesePaymentHint,
  getRelayBasesCreditsDocsUrl,
  getRelayBasesPaymentCopyKey,
  getRelayBasesPaymentGridClass,
  getRelayBasesTopupLanguageTier,
  isRelayBasesChineseLanguage,
  orderRelayBasesPaymentMethods,
} from '../policy'

describe('RelayBases wallet policy', () => {
  test('recognizes both interface Chinese language codes', () => {
    assert.equal(isRelayBasesChineseLanguage('zhCN'), true)
    assert.equal(isRelayBasesChineseLanguage('zhTW'), true)
    assert.equal(isRelayBasesChineseLanguage('zh-TW'), true)
    assert.equal(isRelayBasesChineseLanguage('en'), false)
    assert.equal(getRelayBasesTopupLanguageTier('zhCN'), 'chinese')
    assert.equal(getRelayBasesTopupLanguageTier('fr'), 'non-chinese')
    assert.equal(getRelayBasesTopupLanguageTier(), 'unknown')
  })

  test('orders gateways without mutating the backend response', () => {
    const methods: PaymentMethod[] = [
      { name: 'Custom', type: 'custom' },
      { name: 'WeChat Pay', type: 'wxpay' },
      { name: 'Waffo', type: 'waffo_pancake' },
      { name: 'Stripe', type: 'stripe' },
      { name: 'Alipay', type: 'alipay' },
    ]

    const ordered = orderRelayBasesPaymentMethods(methods)
    assert.deepEqual(
      ordered.map((method) => method.type),
      ['stripe', 'waffo_pancake', 'alipay', 'wxpay', 'custom']
    )
    assert.equal(methods[0]?.type, 'custom')
  })

  test('maps gateway copy and Chinese payment hints', () => {
    assert.equal(getRelayBasesPaymentCopyKey('stripe'), 'wallet.payment.stripe')
    assert.equal(
      getRelayBasesPaymentCopyKey('waffo_pancake'),
      'wallet.payment.waffo'
    )
    assert.equal(
      getRelayBasesPaymentCopyKey('custom'),
      'wallet.payment.generic'
    )
    assert.equal(getRelayBasesChinesePaymentHint('stripe', 'zhCN'), 'alipay')
    assert.equal(
      getRelayBasesChinesePaymentHint('waffo_pancake', 'zhTW'),
      'wechat'
    )
    assert.equal(getRelayBasesChinesePaymentHint('stripe', 'en'), null)
  })

  test('formats credits and payment money with explicit units', () => {
    assert.equal(formatRelayBasesCredits(20, 'en'), 'Ɍ 20')
    assert.equal(formatRelayBasesUsd(2.8, 'en'), 'USD 2.80')
    assert.equal(formatRelayBasesCredits('invalid', 'en'), 'Ɍ —')
  })

  test('selects locale-aware docs anchors and responsive grid classes', () => {
    assert.match(getRelayBasesCreditsDocsUrl('zhCN'), /lang=zh#zh-credits$/)
    assert.match(getRelayBasesCreditsDocsUrl('fr'), /lang=en#en-credits$/)
    assert.match(getRelayBasesPaymentGridClass(1), /grid-cols-1/)
    assert.match(getRelayBasesPaymentGridClass(2), /grid-cols-1/)
    assert.match(getRelayBasesPaymentGridClass(2), /sm:grid-cols-2/)
    assert.match(getRelayBasesPaymentGridClass(4), /xl:grid-cols-4/)
  })
})
