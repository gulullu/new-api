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

import { formatPaymentAmount } from '../payment-amount'

describe('payment amount formatting', () => {
  test('keeps the recorded ISO currency beside the payment amount', () => {
    assert.equal(formatPaymentAmount('13.54', 'usd', 'en'), 'USD 13.54')
    assert.equal(formatPaymentAmount('100', 'CNY', 'zhCN'), 'CNY 100.00')
  })

  test('does not guess a currency when the payment snapshot is incomplete', () => {
    assert.equal(formatPaymentAmount('13.54', '', 'en'), null)
    assert.equal(formatPaymentAmount(undefined, 'USD', 'en'), null)
  })
})
