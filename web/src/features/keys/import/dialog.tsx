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
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toRelayBasesContentLocale } from '@/features/relaybases/content/locale'
import { getUserGroups, getUserModels } from '@/lib/api'

import { useApiKeys } from '../components/api-keys-provider'
import { createImport, previewImport, importErrorMessage } from './api'
import { DEFAULT_FIELDS, importPayload, importRowErrors } from './data'
import { ImportRowsEditor } from './editor'
import { ImportReview } from './review'
import { ImportTemplates } from './templates'
import type {
  ImportFields,
  ImportItem,
  ImportPreview,
  ImportResult,
  ImportRow,
} from './types'

type Props = { onClose: () => void }

export function ApiKeysImportDialog(props: Props) {
  const { t, i18n } = useTranslation()
  const { triggerRefresh } = useApiKeys()
  const locale = toRelayBasesContentLocale(
    i18n.resolvedLanguage || i18n.language
  )
  const groups = useQuery({
    queryKey: ['user-groups', locale],
    queryFn: () => getUserGroups(locale),
    staleTime: 0,
  })
  const models = useQuery({ queryKey: ['user-models'], queryFn: getUserModels })
  const [configuredDefaults, setDefaults] = useState<ImportFields>({
    ...DEFAULT_FIELDS,
  })
  const [rows, setRows] = useState<ImportRow[]>([])
  const [stage, setStage] = useState(0)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [items, setItems] = useState<ImportItem[]>([])
  const [preview, setPreview] = useState<ImportPreview>({
    existing_names: [],
    remaining: 0,
  })
  const [allowExisting, setAllowExisting] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const submitted = useRef<{
    id: string
    items: ImportItem[]
    allow: boolean
  } | null>(null)
  const [attempted, setAttempted] = useState(false)
  const groupOptions = Object.keys(
    groups.data?.success ? groups.data.data || {} : {}
  ).map((value) => ({
    value,
    label: value === 'auto' ? t('Cross-group') : value,
  }))
  const defaults = {
    ...configuredDefaults,
    group:
      configuredDefaults.group ||
      (groupOptions.some((g) => g.value === 'default')
        ? 'default'
        : groupOptions[0]?.value || ''),
  }
  const [validationTime] = useState(() => Date.now())
  const groupsFailed = groups.isError || groups.data?.success === false
  const valid =
    rows.length > 0 &&
    rows.length <= 100 &&
    !rows.some(
      (row) =>
        importRowErrors(
          row,
          rows,
          defaults,
          groupOptions.map((g) => g.value),
          validationTime
        ).length
    )
  const next = async (): Promise<void> => {
    if (!valid || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const frozen = importPayload(rows, defaults, Date.now())
      const response = await previewImport(frozen)
      if (!response.success || !response.data) {
        setError(
          importErrorMessage(response.message || 'Failed to validate import', t)
        )
        return
      }
      if (response.data.remaining < frozen.length) {
        setError(t('API key limit exceeded'))
        return
      }
      setItems(frozen)
      setPreview(response.data)
      setAllowExisting(false)
      submitted.current = null
      setAttempted(false)
      setStage(1)
    } catch {
      setError(t('Failed to validate import'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const create = async (): Promise<void> => {
    if (
      busyRef.current ||
      (!allowExisting && preview.existing_names.length > 0)
    ) {
      return
    }
    if (!submitted.current) {
      submitted.current = {
        id: crypto.randomUUID(),
        items,
        allow: allowExisting,
      }
    }
    busyRef.current = true
    setBusy(true)
    setAttempted(true)
    setError('')
    try {
      const request = submitted.current
      const response = await createImport(
        request.id,
        request.items,
        request.allow
      )
      if (!response.success || !response.data) {
        submitted.current = null
        setAttempted(false)
        setError(
          importErrorMessage(response.message || 'Failed to create API keys', t)
        )
        return
      }
      setResults(response.data)
      setItems(response.data)
      setStage(2)
      triggerRefresh()
    } catch {
      setError(
        t(
          'Creation result could not be confirmed. Retry this import to avoid duplicates.'
        )
      )
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busyRef.current) props.onClose()
      }}
    >
      <DialogContent
        className='flex max-h-[90dvh] flex-col sm:max-w-5xl'
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>{t('Import API keys')}</DialogTitle>
          <DialogDescription>
            {t('Use a template or configure each key individually.')}
          </DialogDescription>
        </DialogHeader>
        <div
          className='flex flex-wrap items-center gap-3 text-xs'
          aria-label={t('Import steps')}
        >
          {['Import and edit', 'Confirm configuration', 'Get API keys'].map(
            (label, index) => (
              <span
                key={label}
                className='flex items-center gap-1.5'
                aria-current={stage === index ? 'step' : undefined}
              >
                <Badge variant={stage === index ? 'default' : 'outline'}>
                  {index + 1}
                </Badge>
                {t(label)}
              </span>
            )
          )}
        </div>
        <div className='min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-1 py-1'>
          {stage === 0 && (
            <>
              <ImportTemplates
                value={defaults}
                onChange={setDefaults}
                groups={groupOptions}
                models={models.data?.data || []}
                disabled={busy || groups.isFetching || groupsFailed}
              />
              {groupsFailed && (
                <div role='alert' className='flex items-center gap-2 text-sm'>
                  <p>{t('Failed to load groups')}</p>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => void groups.refetch()}
                  >
                    {t('Retry')}
                  </Button>
                </div>
              )}
              <ImportRowsEditor
                rows={rows}
                onChange={setRows}
                defaults={defaults}
                groups={groupOptions}
                models={models.data?.data || []}
                disabled={busy}
                onError={setError}
              />
            </>
          )}
          {stage > 0 && (
            <ImportReview
              items={items}
              results={stage === 2 ? results : undefined}
              onMessage={setNotice}
            />
          )}
          {stage === 1 && preview.existing_names.length > 0 && (
            <div className='space-y-2 rounded-lg border p-3 text-sm'>
              <p>{t('Existing keys have the following names:')}</p>
              <p className='break-words'>{preview.existing_names.join(', ')}</p>
              <div className='flex items-center gap-2'>
                <Checkbox
                  id='key-import-allow-existing'
                  disabled={busy || attempted}
                  checked={allowExisting}
                  onCheckedChange={(checked) =>
                    setAllowExisting(Boolean(checked))
                  }
                />
                <Label htmlFor='key-import-allow-existing'>
                  {t(
                    'Create additional keys with these names; keep existing keys unchanged.'
                  )}
                </Label>
              </div>
            </div>
          )}
          {stage === 1 && items.some((item) => item.group === 'auto') && (
            <p className='text-muted-foreground text-xs'>
              {t('Switching to Cross-group uses the global group order.')}
            </p>
          )}
          {error && (
            <p
              role='alert'
              className='text-destructive text-sm whitespace-pre-wrap'
            >
              {error}
            </p>
          )}
          {notice && (
            <p role='status' className='text-muted-foreground text-sm'>
              {notice}
            </p>
          )}
        </div>
        <DialogFooter className='border-t pt-4'>
          {stage === 0 && (
            <>
              <span className='text-muted-foreground mr-auto self-center text-xs'>
                {t('{{count}} keys to create', { count: rows.length })}
              </span>
              <Button variant='outline' disabled={busy} onClick={props.onClose}>
                {t('Cancel')}
              </Button>
              <Button
                disabled={!valid || busy || groups.isFetching || groupsFailed}
                onClick={() => void next()}
              >
                {busy ? t('Loading...') : t('Next: confirm configuration')}
              </Button>
            </>
          )}
          {stage === 1 && (
            <>
              <Button
                variant='outline'
                disabled={busy || attempted}
                onClick={() => {
                  setStage(0)
                  setError('')
                }}
              >
                {t('Back to edit')}
              </Button>
              <Button
                disabled={
                  busy || (!allowExisting && preview.existing_names.length > 0)
                }
                onClick={() => void create()}
              >
                {busy
                  ? t('Creating...')
                  : t(attempted ? 'Retry this import' : 'Confirm creation')}
              </Button>
            </>
          )}
          {stage === 2 && <Button onClick={props.onClose}>{t('Done')}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
