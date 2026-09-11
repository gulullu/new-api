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
import { describe, expect, test } from 'vitest'

import {
  DEFAULT_FIELDS,
  importCSV,
  importExpiry,
  importPayload,
  importRowErrors,
  newImportRow,
  parseImportText,
  resolveImportRow,
  templateFields,
  templatePayload,
} from '../data'

const defaults = {
  ...DEFAULT_FIELDS,
  group: 'default',
  quota: '10',
  expiry: 'never',
}
const now = new Date('2026-09-11T12:00:00Z').getTime()

describe('table import', () => {
  test('accepts a name list, Unicode BOM and spreadsheet columns in any supported order', () => {
    expect(
      parseImportText('\uFEFFAlice\r\n张三\r\n').map((r) => r.name)
    ).toEqual(['Alice', '张三'])
    const rows = parseImportText(
      '分组\t名称\t额度\t有效期\nvip\t研发组\t不限额\t永不过期\n\t另一个项目\t0\t30'
    )
    expect(rows[0]).toMatchObject({
      name: '研发组',
      group: 'vip',
      quota: 'unlimited',
      expiry: 'never',
    })
    expect(rows[1]).toMatchObject({
      name: '另一个项目',
      group: '',
      quota: '0',
      expiry: '30',
    })
  })
  test('handles quoted commas, escaped quotes, tabs and multiline fields', () => {
    const rows = parseImportText(
      'name,group,quota,expiry,models,ips\n"Project, \\"A\\"",default,10,never,"a\tb","127.0.0.1\n10.0.0.0/8"'.replaceAll(
        '\\"',
        '""'
      )
    )
    expect(rows[0].name).toBe('Project, "A"')
    expect(rows[0].models).toBe('a\tb')
    expect(rows[0].ips).toBe('127.0.0.1\n10.0.0.0/8')
  })
  test.each([
    ['', 'No import rows'],
    ['name,wat\na,b', 'Unknown import column'],
    ['name,name\na,b', 'duplicate import columns'],
    ['name,group\na,b,c', 'Too many columns'],
    ['"unclosed', 'Unclosed quote'],
    ['a"b', 'Invalid quote'],
    ['"a"b', 'Invalid quote'],
    [
      Array.from({ length: 101 }, (_, i) => `key-${i}`).join('\n'),
      'between 1 and 100',
    ],
    ['x'.repeat(1024 * 1024 + 1), 'smaller than 1 MB'],
  ])('rejects malformed or oversized input', (input, message) => {
    expect(() => parseImportText(input)).toThrow(message)
  })
  test('inherits defaults but keeps explicit zero and unrestricted overrides', () => {
    const row = { ...newImportRow(' key '), quota: '0', models: '*', ips: '*' }
    expect(
      resolveImportRow(row, {
        ...defaults,
        models: 'restricted',
        ips: '127.0.0.1',
      })
    ).toMatchObject({
      name: 'key',
      group: 'default',
      quota: '0',
      models: '*',
      ips: '*',
    })
    expect(importPayload([row], defaults, now)[0]).toMatchObject({
      remain_quota: 0,
      unlimited_quota: false,
      model_limits: '',
      allow_ips: '',
      expired_time: -1,
    })
    expect(
      importPayload(
        [{ ...row, quota: 'unlimited', group: 'auto' }],
        defaults,
        now
      )[0]
    ).toMatchObject({ remain_quota: 0, unlimited_quota: true, group: 'auto' })
  })
  test('validates Unicode byte limits, duplicates, missing groups, dates and fractional quotas', () => {
    const row = newImportRow('a')
    expect(importRowErrors(row, [row], defaults, ['default'], now)).toEqual([])
    expect(
      importRowErrors(
        row,
        [row, newImportRow(' a ')],
        defaults,
        ['default'],
        now
      )
    ).toContain('Duplicate name in this import')
    expect(
      importRowErrors(
        { ...row, name: '中'.repeat(17) },
        [row],
        defaults,
        ['default'],
        now
      )
    ).toContain('Name must contain 1 to 50 bytes')
    expect(
      importRowErrors(
        { ...row, group: 'private' },
        [row],
        defaults,
        ['default'],
        now
      )
    ).toContain('Group is not available')
    for (const quota of ['-1', 'NaN', 'Infinity', '0.0000000000001']) {
      expect(
        importRowErrors({ ...row, quota }, [row], defaults, ['default'], now)
      ).toContain('Invalid quota')
    }
    expect(importExpiry('2026-02-30', now)).toBeNaN()
    expect(importExpiry('7', now)).toBe(now / 1000 + 7 * 86400)
    expect(
      importRowErrors(
        { ...row, expiry: '2026-09-01' },
        [row],
        defaults,
        ['default'],
        now
      )
    ).toContain('Expiration must be in the future')
  })
  test('persists quotas in canonical units and safely exports spreadsheet cells', () => {
    const stored = templatePayload(defaults)
    expect(stored.remain_quota).toBeGreaterThan(0)
    expect(templateFields(stored)).toEqual(defaults)
    const csv = importCSV([
      ['name', 'key'],
      ['=HYPERLINK("bad")', 'sk-test'],
      ['@formula', 'normal'],
    ])
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"')
    expect(csv).toContain('"\'@formula"')
    expect(csv.startsWith('\uFEFF')).toBe(true)
  })
})
