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
  formatAdminReferralCount,
  formatAdminReferralCredits,
  formatAdminReferralPaidAmount,
} from '../format'

describe('admin referral reward formatting', () => {
  test('accepts the simplified Chinese interface language code', () => {
    assert.doesNotThrow(() =>
      formatAdminReferralPaidAmount('1234.5', 'USD', 'zhCN')
    )
    assert.equal(
      formatAdminReferralPaidAmount('1234.5', 'USD', 'zhCN'),
      'USD 1,234.50'
    )
    assert.equal(
      formatAdminReferralCredits(625000, 'zhCN').includes('1.25'),
      true
    )
    assert.equal(formatAdminReferralCount(1234, 'zhCN'), '1,234')
  })

  test('accepts the traditional Chinese interface language code', () => {
    assert.doesNotThrow(() =>
      formatAdminReferralPaidAmount('90', 'CNY', 'zhTW')
    )
    assert.equal(
      formatAdminReferralPaidAmount('90', 'CNY', 'zhTW'),
      'CNY 90.00'
    )
  })
})
