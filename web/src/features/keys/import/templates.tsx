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
import { BookmarkPlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'

import {
  deleteImportTemplate,
  importErrorMessage,
  getImportTemplates,
  saveImportTemplate,
} from './api'
import {
  importRowErrors,
  newImportRow,
  templateFields,
  templatePayload,
} from './data'
import { ImportFieldsEditor } from './fields'
import { ImportSelect } from './selects'
import type { GroupOption, ImportFields } from './types'

type Props = {
  value: ImportFields
  onChange: (value: ImportFields) => void
  groups: GroupOption[]
  models: string[]
  disabled: boolean
}

export function ImportTemplates(props: Props) {
  const { t } = useTranslation()
  const userID = useAuthStore((s) => s.auth.user?.id)
  const templates = useQuery({
    queryKey: ['key-import-templates', userID],
    queryFn: getImportTemplates,
  })
  const [selected, setSelected] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const current = templates.data?.data?.find(
    (item) => String(item.id) === selected
  )
  const save = async (): Promise<void> => {
    if (busy) return
    const fake = newImportRow('template')
    const errors = importRowErrors(
      fake,
      [fake],
      props.value,
      props.groups.map((g) => g.value),
      Date.now()
    )
    if (
      !name.trim() ||
      new TextEncoder().encode(name.trim()).length > 100 ||
      errors.length
    ) {
      setError(t(errors[0] || 'Template name must contain 1 to 100 bytes'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await saveImportTemplate(
        name.trim(),
        templatePayload(props.value)
      )
      if (!result.success || !result.data) {
        setError(
          importErrorMessage(result.message || 'Failed to save template', t)
        )
        return
      }
      await templates.refetch()
      setSelected(String(result.data.id))
      setSaveOpen(false)
      setName('')
    } catch {
      setError(t('Failed to save template'))
    } finally {
      setBusy(false)
    }
  }
  const remove = async (): Promise<void> => {
    if (!current || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await deleteImportTemplate(current.id)
      if (!result.success) {
        setError(
          importErrorMessage(result.message || 'Failed to delete template', t)
        )
        return
      }
      setSelected('')
      setDeleteOpen(false)
      await templates.refetch()
    } catch {
      setError(t('Failed to delete template'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className='space-y-4 rounded-lg border p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <h3 className='text-sm font-medium'>{t('Template defaults')}</h3>
          <ImportSelect
            label={t('Select import template')}
            className='w-full sm:w-56'
            disabled={props.disabled || busy || templates.isFetching}
            value={selected}
            onValueChange={(value) => {
              setSelected(value)
              const entry = templates.data?.data?.find(
                (item) => String(item.id) === value
              )
              if (entry) props.onChange(templateFields(entry.defaults))
            }}
            options={[
              { value: '', label: t('Custom configuration') },
              ...(templates.data?.data || []).map((item) => ({
                value: String(item.id),
                label: item.name,
              })),
            ]}
          />
        </div>
        <div className='flex gap-2'>
          {current && (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              disabled={props.disabled || busy}
              onClick={() => setDeleteOpen(true)}
              aria-label={t('Delete template')}
            >
              <Trash2 />
            </Button>
          )}
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={props.disabled || busy}
            onClick={() => setSaveOpen(!saveOpen)}
          >
            <BookmarkPlus />
            {t('Save as template')}
          </Button>
        </div>
      </div>
      {(templates.isError || templates.data?.success === false) && (
        <div className='flex items-center gap-2 text-sm'>
          <p role='alert'>{t('Failed to load templates')}</p>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => void templates.refetch()}
          >
            {t('Retry')}
          </Button>
        </div>
      )}
      {saveOpen && (
        <div className='flex flex-wrap gap-2'>
          <Input
            className='flex-1'
            aria-label={t('Template name')}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Template name')}
            disabled={busy || props.disabled}
          />
          <Button
            type='button'
            size='sm'
            disabled={busy || props.disabled}
            onClick={() => void save()}
          >
            {t('Save')}
          </Button>
        </div>
      )}
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
      <ImportFieldsEditor
        value={props.value}
        onChange={(value) => {
          props.onChange(value)
          setSelected('')
        }}
        groups={props.groups}
        models={props.models}
        disabled={props.disabled || busy}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!busy) setDeleteOpen(open)
        }}
        title={t('Delete template')}
        desc={current?.name || ''}
        handleConfirm={() => void remove()}
        isLoading={busy}
        confirmText={t('Delete')}
        destructive
      />
    </section>
  )
}
