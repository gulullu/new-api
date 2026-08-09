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

import { resolveRelayBasesOidcDisplayName } from './oidc-presentation'

describe('RelayBases OIDC presentation', () => {
  test('identifies only the configured Google authorization endpoint', () => {
    assert.equal(
      resolveRelayBasesOidcDisplayName(
        'OIDC',
        'https://accounts.google.com/o/oauth2/v2/auth'
      ),
      'Google'
    )
    assert.equal(
      resolveRelayBasesOidcDisplayName(
        'OIDC',
        'https://login.example.com/authorize'
      ),
      'OIDC'
    )
    assert.equal(
      resolveRelayBasesOidcDisplayName(
        'Company SSO',
        'https://accounts.google.com/o/oauth2/v2/auth'
      ),
      'Company SSO'
    )
  })
})
