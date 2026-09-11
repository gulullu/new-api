import {
  Download,
  Plus,
  Upload,
  ClipboardPaste,
  Ellipsis,
  Trash2,
} from 'lucide-react'
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
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { getCurrencyLabel } from '@/lib/currency'

import { downloadImportWorkbook, readImportWorkbook } from './api'
import {
  EMPTY_FIELDS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  importRowErrors,
  newImportRow,
  parseImportText,
} from './data'
import { ImportFieldsEditor, ImportQuotaInput } from './fields'
import type { GroupOption, ImportFields, ImportRow } from './types'

type Props = {
  rows: ImportRow[]
  onChange: (rows: ImportRow[]) => void
  defaults: ImportFields
  groups: GroupOption[]
  models: string[]
  disabled: boolean
  onError: (message: string) => void
}

export function ImportRowsEditor(props: Props) {
  const { t } = useTranslation()
  const [fileBusy, setFileBusy] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [text, setText] = useState('')
  const [mode, setMode] = useState('replace')
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [group, setGroup] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const selected = props.rows.filter((r) => selection.has(r.id))
  const extra = props.rows.find((r) => r.id === expanded)
  const [now] = useState(() => Date.now())
  const groupNames = props.groups.map((g) => g.value)
  const change = (id: string, patch: Partial<ImportRow>): void =>
    props.onChange(
      props.rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    )
  const importText = (value: string): void => {
    try {
      const incoming = parseImportText(value)
      const next = mode === 'append' ? [...props.rows, ...incoming] : incoming
      if (next.length > MAX_IMPORT_ROWS) {
        throw new Error('Import between 1 and 100 API keys')
      }
      props.onChange(next)
      setSelection(new Set())
      setExpanded(null)
      setPasteOpen(false)
      props.onError('')
    } catch (error) {
      props.onError(
        t(error instanceof Error ? error.message : 'Invalid import data')
      )
    }
  }
  return (
    <fieldset
      disabled={props.disabled || fileBusy}
      className='min-w-0 space-y-3'
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-sm font-medium'>
          {t('Key list')}{' '}
          <span className='text-muted-foreground'>
            ({props.rows.length}/100)
          </span>
        </h3>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={async () => {
              setFileBusy(true)
              try {
                await downloadImportWorkbook({
                  title: t('API key import template'),
                  headers: [
                    t('Name'),
                    t('Group'),
                    `${t('Quota')} (${getCurrencyLabel()})`,
                    t('Expiry'),
                    t('Model limits'),
                    t('IP whitelist'),
                  ],
                })
                props.onError('')
              } catch (error) {
                props.onError(
                  t(
                    error instanceof Error
                      ? error.message
                      : 'Unable to download Excel template'
                  )
                )
              } finally {
                setFileBusy(false)
              }
            }}
          >
            <Download />
            {t('Download Excel template')}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => file.current?.click()}
          >
            <Upload />
            {t('Import Excel / CSV')}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setPasteOpen(!pasteOpen)}
          >
            <ClipboardPaste />
            {t('Paste table')}
          </Button>
          <input
            hidden
            ref={file}
            type='file'
            accept='.xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain'
            aria-label={t('Import file')}
            onChange={async (e) => {
              const input = e.currentTarget
              const selectedFile = input.files?.[0]
              if (!selectedFile) return
              setFileBusy(true)
              try {
                if (selectedFile.size > MAX_IMPORT_BYTES) {
                  throw new Error('Import file must be smaller than 1 MB')
                }
                importText(
                  selectedFile.name.toLowerCase().endsWith('.xlsx')
                    ? await readImportWorkbook(selectedFile)
                    : await selectedFile.text()
                )
              } catch (error) {
                props.onError(
                  t(
                    error instanceof Error
                      ? error.message
                      : 'Invalid import data'
                  )
                )
              } finally {
                input.value = ''
                setFileBusy(false)
              }
            }}
          />
        </div>
      </div>
      <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
        <Label htmlFor='key-import-mode'>{t('Import mode')}</Label>
        <NativeSelect
          id='key-import-mode'
          size='sm'
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value='replace'>{t('Replace current rows')}</option>
          <option value='append'>{t('Append to current rows')}</option>
        </NativeSelect>
        <span>{t('Empty cells inherit the template')}</span>
      </div>
      {pasteOpen && (
        <div className='space-y-3 rounded-lg border p-3'>
          <Label htmlFor='key-import-paste'>
            {t('Paste names or a spreadsheet table')}
          </Label>
          <Textarea
            id='key-import-paste'
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              'name\tgroup\tquota\texpiry\nproject-production\t\t50\tnever\nproject-test\t\t5\t7'
            }
          />
          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => setPasteOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='button' size='sm' onClick={() => importText(text)}>
              {t('Import into table')}
            </Button>
          </div>
        </div>
      )}
      {selected.length > 0 && (
        <div className='bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg p-2 text-sm'>
          <span>{t('{{count}} selected', { count: selected.length })}</span>
          <NativeSelect
            aria-label={t('Batch group')}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value=''>{t('Select a group')}</option>
            {props.groups.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </NativeSelect>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={!group}
            onClick={() =>
              props.onChange(
                props.rows.map((r) =>
                  selection.has(r.id) ? { ...r, group } : r
                )
              )
            }
          >
            {t('Apply group')}
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() =>
              props.onChange(
                props.rows.map((r) =>
                  selection.has(r.id) ? { ...r, ...EMPTY_FIELDS } : r
                )
              )
            }
          >
            {t('Restore template defaults')}
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => {
              props.onChange(props.rows.filter((r) => !selection.has(r.id)))
              setSelection(new Set())
            }}
          >
            <Trash2 />
            {t('Remove selected rows')}
          </Button>
        </div>
      )}
      <div className='overflow-hidden rounded-lg border'>
        <Table className='min-w-[720px]'>
          <TableHeader>
            <TableRow>
              <TableHead className='w-10'>
                <Checkbox
                  aria-label={t('Select all rows')}
                  checked={
                    props.rows.length > 0 &&
                    selected.length === props.rows.length
                  }
                  indeterminate={
                    selected.length > 0 && selected.length < props.rows.length
                  }
                  onCheckedChange={(checked) =>
                    setSelection(
                      checked ? new Set(props.rows.map((r) => r.id)) : new Set()
                    )
                  }
                />
              </TableHead>
              <TableHead className='min-w-48'>{t('Name')}</TableHead>
              <TableHead className='min-w-40'>{t('Group')}</TableHead>
              <TableHead className='min-w-32'>
                {t('Quota ({{currency}})', { currency: getCurrencyLabel() })}
              </TableHead>
              <TableHead className='min-w-36'>{t('Expiration')}</TableHead>
              <TableHead className='w-12'>{t('More')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.rows.map((row, index) => {
              const errors = importRowErrors(
                row,
                props.rows,
                props.defaults,
                groupNames,
                now
              )
              return (
                <TableRow key={row.id}>
                  <TableCell className='align-top'>
                    <Checkbox
                      aria-label={t('Select row {{row}}', { row: index + 1 })}
                      checked={selection.has(row.id)}
                      onCheckedChange={(checked) =>
                        setSelection((previous) => {
                          const next = new Set(previous)
                          if (checked) next.add(row.id)
                          else next.delete(row.id)
                          return next
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className='align-top'>
                    <Input
                      aria-label={t('Name for row {{row}}', { row: index + 1 })}
                      aria-invalid={errors.length > 0}
                      value={row.name}
                      onChange={(e) => change(row.id, { name: e.target.value })}
                    />
                    {errors.map((error) => (
                      <p
                        key={error}
                        className='text-destructive mt-1 max-w-60 text-xs whitespace-normal'
                      >
                        {t(error)}
                      </p>
                    ))}
                  </TableCell>
                  <TableCell className='align-top'>
                    <NativeSelect
                      className='w-full'
                      aria-label={t('Group for row {{row}}', {
                        row: index + 1,
                      })}
                      value={row.group}
                      onChange={(e) =>
                        change(row.id, { group: e.target.value })
                      }
                    >
                      <option value=''>
                        {t('Inherit template')} · {props.defaults.group}
                      </option>
                      {row.group && !groupNames.includes(row.group) && (
                        <option value={row.group}>{row.group}</option>
                      )}
                      {props.groups.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell className='align-top'>
                    <ImportQuotaInput
                      label={t('Quota for row {{row}}', { row: index + 1 })}
                      value={row.quota}
                      inherited={props.defaults.quota}
                      onChange={(quota) => change(row.id, { quota })}
                    />
                  </TableCell>
                  <TableCell className='align-top'>
                    <NativeSelect
                      className='w-full'
                      aria-label={t('Expiration for row {{row}}', {
                        row: index + 1,
                      })}
                      value={
                        ['', '7', '30', 'never'].includes(row.expiry)
                          ? row.expiry
                          : 'date'
                      }
                      onChange={(e) =>
                        change(row.id, { expiry: e.target.value })
                      }
                    >
                      <option value=''>{t('Inherit template')}</option>
                      <option value='7'>{t('7 days after creation')}</option>
                      <option value='30'>{t('30 days after creation')}</option>
                      <option value='never'>{t('Never')}</option>
                      <option value='date'>{t('Custom date')}</option>
                    </NativeSelect>
                    {!['', '7', '30', 'never'].includes(row.expiry) && (
                      <Input
                        className='mt-2'
                        type='date'
                        aria-label={t('Date for row {{row}}', {
                          row: index + 1,
                        })}
                        value={row.expiry === 'date' ? '' : row.expiry}
                        onChange={(e) =>
                          change(row.id, { expiry: e.target.value || 'date' })
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell className='align-top'>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      aria-label={t('More settings for row {{row}}', {
                        row: index + 1,
                      })}
                      onClick={() =>
                        setExpanded(expanded === row.id ? null : row.id)
                      }
                    >
                      <Ellipsis />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {props.rows.length === 0 && (
          <p className='text-muted-foreground px-4 py-10 text-center text-sm'>
            {t('Paste data, import a CSV file, or add a row')}
          </p>
        )}
      </div>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        disabled={props.rows.length >= MAX_IMPORT_ROWS}
        onClick={() => props.onChange([...props.rows, newImportRow()])}
      >
        <Plus />
        {t('Add row')}
      </Button>
      {extra && (
        <div className='space-y-3 rounded-lg border p-4'>
          <div className='flex items-center justify-between'>
            <h4 className='text-sm font-medium'>
              {extra.name || t('Unnamed key')}
            </h4>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => setExpanded(null)}
            >
              {t('Close')}
            </Button>
          </div>
          <ImportFieldsEditor
            value={extra}
            onChange={(value) => change(extra.id, value)}
            inherit={props.defaults}
            groups={props.groups}
            models={props.models}
          />
        </div>
      )}
    </fieldset>
  )
}
