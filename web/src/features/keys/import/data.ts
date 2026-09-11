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
import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'

import type {
  ImportFields,
  ImportItem,
  ImportResult,
  ImportRow,
  TemplateDefaults,
} from './types'

export const EMPTY_FIELDS: ImportFields = {
  group: '',
  quota: '',
  expiry: '',
  models: '',
  ips: '',
}
export const DEFAULT_FIELDS: ImportFields = {
  group: '',
  quota: 'unlimited',
  expiry: 'never',
  models: '*',
  ips: '*',
}
export const MAX_IMPORT_ROWS = 100
export const MAX_IMPORT_BYTES = 1024 * 1024

export function newImportRow(name = ''): ImportRow {
  return { ...EMPTY_FIELDS, id: crypto.randomUUID(), name }
}

export function resolveImportRow(
  row: ImportRow,
  defaults: ImportFields
): ImportRow {
  const result = { ...row }
  for (const field of Object.keys(EMPTY_FIELDS) as (keyof ImportFields)[]) {
    result[field] = row[field].trim() || defaults[field].trim()
  }
  result.name = row.name.trim()
  return result
}

export function parseImportText(text: string): ImportRow[] {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    throw new Error('Import file must be smaller than 1 MB')
  }
  text = text.replace(/^\uFEFF/, '')
  // Choose the separator from the first unquoted record; tabs inside quoted CSV are data.
  let inQuotes = false
  let delimiter = ','
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++
        continue
      }
      inQuotes = !inQuotes
    } else if (!inQuotes) {
      if (text[i] === '\t') {
        delimiter = '\t'
        break
      }
      if (text[i] === ',' || text[i] === '\n' || text[i] === '\r') {
        break
      }
    }
  }
  const records: string[][] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let closedQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (quoted) {
        quoted = false
        closedQuote = true
      } else if (cell.length === 0 && !closedQuote) {
        quoted = true
      } else {
        throw new Error('Invalid quote in CSV data')
      }
    } else if (!quoted && (ch === delimiter || ch === '\n' || ch === '\r')) {
      cells.push(cell.trim())
      cell = ''
      closedQuote = false
      if (ch !== delimiter) {
        if (cells.some(Boolean)) records.push(cells)
        cells = []
        if (ch === '\r' && text[i + 1] === '\n') i++
        if (records.length > MAX_IMPORT_ROWS + 1) {
          throw new Error('Import between 1 and 100 API keys')
        }
      }
    } else {
      if (closedQuote && ch.trim()) {
        throw new Error('Invalid quote in CSV data')
      }
      cell += ch
    }
  }
  if (quoted) throw new Error('Unclosed quote in CSV data')
  cells.push(cell.trim())
  if (cells.some(Boolean)) records.push(cells)
  if (!records.length) throw new Error('No import rows found')
  const aliases: Record<string, keyof Omit<ImportRow, 'id'>> = {
    name: 'name',
    名称: 'name',
    group: 'group',
    分组: 'group',
    quota: 'quota',
    额度: 'quota',
    expiry: 'expiry',
    有效期: 'expiry',
    models: 'models',
    模型限制: 'models',
    ips: 'ips',
    ip白名单: 'ips',
  }
  let fields: (keyof Omit<ImportRow, 'id'>)[] = [
    'name',
    'group',
    'quota',
    'expiry',
    'models',
    'ips',
  ]
  if (aliases[records[0][0].toLowerCase()]) {
    const header = records[0]
    records.shift()
    if (header.some((h) => !aliases[h.toLowerCase()])) {
      throw new Error('Unknown import column')
    }
    fields = header.map((h) => aliases[h.toLowerCase()])
    if (new Set(fields).size !== fields.length || !fields.includes('name')) {
      throw new Error('Invalid or duplicate import columns')
    }
  }
  if (!records.length || records.length > MAX_IMPORT_ROWS) {
    throw new Error('Import between 1 and 100 API keys')
  }
  return records.map((values) => {
    if (values.length > fields.length) {
      throw new Error('Too many columns in import row')
    }
    const row = newImportRow()
    fields.forEach((field, i) => {
      row[field] = values[i] || ''
    })
    if (row.group === '跨分组') row.group = 'auto'
    if (row.quota === '不限额') row.quota = 'unlimited'
    if (row.expiry === '永不过期') row.expiry = 'never'
    return row
  })
}

export function importExpiry(value: string, now: number): number {
  if (value === 'never') return -1
  if (value === '7' || value === '30') {
    return Math.floor(now / 1000) + Number(value) * 86400
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN
  const date = new Date(`${value}T23:59:59`)
  const [year, month, day] = value.split('-').map(Number)
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return Number.NaN
  }
  return Math.floor(date.getTime() / 1000)
}

export function importRowErrors(
  row: ImportRow,
  rows: ImportRow[],
  defaults: ImportFields,
  groups: string[],
  now: number
): string[] {
  const value = resolveImportRow(row, defaults)
  const errors: string[] = []
  if (!value.name || new TextEncoder().encode(value.name).length > 50) {
    errors.push('Name must contain 1 to 50 bytes')
  }
  if (
    value.name &&
    rows.filter((r) => r.name.trim() === value.name).length > 1
  ) {
    errors.push('Duplicate name in this import')
  }
  if (!groups.includes(value.group)) errors.push('Group is not available')
  const amount = Number(value.quota)
  const units = parseQuotaFromDollars(amount)
  if (
    value.quota !== 'unlimited' &&
    (!value.quota ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isSafeInteger(units) ||
      units < 0 ||
      (amount > 0 && units === 0))
  ) {
    errors.push('Invalid quota')
  }
  const expiry = importExpiry(value.expiry, now)
  if (!Number.isFinite(expiry) || (expiry !== -1 && expiry <= now / 1000)) {
    errors.push('Expiration must be in the future')
  }
  if (value.models.length > 10000 || value.ips.length > 4000) {
    errors.push('Model or IP list is too long')
  }
  return errors
}

export function importPayload(
  rows: ImportRow[],
  defaults: ImportFields,
  now: number
): ImportItem[] {
  return rows.map((row) => {
    const value = resolveImportRow(row, defaults)
    const unlimited = value.quota === 'unlimited'
    return {
      name: value.name,
      group: value.group,
      unlimited_quota: unlimited,
      remain_quota: unlimited ? 0 : parseQuotaFromDollars(Number(value.quota)),
      expired_time: importExpiry(value.expiry, now),
      model_limits:
        value.models === '*'
          ? ''
          : value.models
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .join(','),
      allow_ips:
        value.ips === '*'
          ? ''
          : value.ips
              .split(/[,\n]/)
              .map((s) => s.trim())
              .filter(Boolean)
              .join('\n'),
    }
  })
}

export function templatePayload(fields: ImportFields): TemplateDefaults {
  return {
    group: fields.group,
    remain_quota:
      fields.quota === 'unlimited'
        ? 0
        : parseQuotaFromDollars(Number(fields.quota)),
    unlimited_quota: fields.quota === 'unlimited',
    expiry: fields.expiry,
    model_limits: fields.models === '*' ? '' : fields.models,
    allow_ips: fields.ips === '*' ? '' : fields.ips,
  }
}

export function templateFields(defaults: TemplateDefaults): ImportFields {
  return {
    group: defaults.group,
    quota: defaults.unlimited_quota
      ? 'unlimited'
      : String(quotaUnitsToDollars(defaults.remain_quota)),
    expiry: defaults.expiry,
    models: defaults.model_limits || '*',
    ips: defaults.allow_ips || '*',
  }
}

export function importCSV(records: string[][]): string {
  return `\uFEFF${records
    .map((row) =>
      row
        .map((cell) => {
          const safe = /^\s*[=+\-@]|^[\t\r\n]/.test(cell) ? `'${cell}` : cell
          return `"${safe.replaceAll('"', '""')}"`
        })
        .join(',')
    )
    .join('\r\n')}`
}

export function exportImportResults(results: ImportResult[]): string {
  return importCSV([
    ['name', 'group', 'quota', 'expiry', 'models', 'ips', 'api_key'],
    ...results.map((r) => [
      r.name,
      r.group,
      r.unlimited_quota
        ? 'unlimited'
        : String(quotaUnitsToDollars(r.remain_quota)),
      r.expired_time === -1
        ? 'never'
        : new Date(r.expired_time * 1000).toISOString(),
      r.model_limits,
      r.allow_ips,
      r.key,
    ]),
  ])
}

export function downloadImportCSV(name: string, content: string): void {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/csv;charset=utf-8' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
