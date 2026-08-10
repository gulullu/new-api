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

import { renderAuditContent } from '../format'

const actions = {
  'partner.configure': 'relaybases:partner.audit.configure',
  'partner.balance_transfer': 'relaybases:partner.audit.balanceTransfer',
  'partner.withdrawal_create': 'relaybases:partner.audit.withdrawalCreate',
  'partner.withdrawal_reveal': 'relaybases:partner.audit.withdrawalReveal',
  'partner.withdrawal_paid': 'relaybases:partner.audit.withdrawalPaid',
  'partner.withdrawal_reject': 'relaybases:partner.audit.withdrawalReject',
} as const

describe('Partner audit localization', () => {
  for (const [action, expectedKey] of Object.entries(actions)) {
    test(`maps ${action} to its RelayBases locale key`, () => {
      const seen: Array<{ key: string; params?: Record<string, unknown> }> = []
      const result = renderAuditContent(
        {
          op: {
            action,
            params: { withdrawal_id: 42, commission_rate_percent: 30 },
          },
        },
        (key, params) => {
          seen.push({ key, params })
          return key
        }
      )
      assert.equal(result, expectedKey)
      assert.deepEqual(seen, [
        {
          key: expectedKey,
          params: { withdrawal_id: 42, commission_rate_percent: 30 },
        },
      ])
    })
  }
})
