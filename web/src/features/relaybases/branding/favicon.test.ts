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

import { RELAYBASES_FAVICON_URL } from './favicon'

const mainSource = await readFile(
  new URL('../../../main.tsx', import.meta.url),
  'utf8'
)
const systemConfigSource = await readFile(
  new URL('../../../hooks/use-system-config.ts', import.meta.url),
  'utf8'
)
const indexSource = await readFile(
  new URL('../../../../index.html', import.meta.url),
  'utf8'
)
const manifestSource = await readFile(
  new URL('../../../../public/site.webmanifest', import.meta.url),
  'utf8'
)

describe('RelayBases favicon ownership', () => {
  test('uses one versioned circular favicon across runtime and static metadata', () => {
    assert.equal(RELAYBASES_FAVICON_URL, '/relaybases-favicon-circle-v1.svg')
    assert.match(mainSource, /applyRelayBasesFaviconToDom\(\)/)
    assert.match(indexSource, /\/relaybases-favicon-circle-v1\.svg/)
    assert.match(manifestSource, /\/relaybases-favicon-circle-v1\.svg/)
  })

  test('does not replace the favicon with the configurable square site logo', () => {
    assert.doesNotMatch(mainSource, /applyFaviconToDom\(s\.logo/)
    assert.doesNotMatch(systemConfigSource, /applyFaviconToDom/)
  })
})
