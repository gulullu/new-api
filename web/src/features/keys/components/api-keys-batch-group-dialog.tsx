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
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { toRelayBasesContentLocale } from '@/features/relaybases/content/locale'
import { getUserGroups } from '@/lib/api'

import { batchUpdateApiKeyGroup } from '../api'
import { ApiKeyGroupCombobox } from './api-key-group-combobox'
import { useApiKeys } from './api-keys-provider'

type Props = {
  ids: number[]
  onClose: () => void
  onSuccess: () => void
}

export function ApiKeysBatchGroupDialog(props: Props) {
  const { t, i18n } = useTranslation()
  const { triggerRefresh } = useApiKeys()
  const [group, setGroup] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const locale = toRelayBasesContentLocale(
    i18n.resolvedLanguage || i18n.language
  )
  const groups = useQuery({
    queryKey: ['user-groups', locale],
    queryFn: () => getUserGroups(locale),
    staleTime: 0,
  })
  const options = Object.entries(
    groups.data?.success ? groups.data.data || {} : {}
  ).map(([value, info]) => ({
    value,
    label: value === 'auto' ? t('Cross-group') : value,
    desc: info.desc,
    ratio: info.ratio,
  }))
  const loadFailed = groups.isError || groups.data?.success === false
  const canSubmit =
    props.ids.length > 0 &&
    props.ids.length <= 100 &&
    !groups.isFetching &&
    !loadFailed &&
    options.some((option) => option.value === group)

  const handleConfirm = async (): Promise<void> => {
    if (!canSubmit || saving.current) return
    saving.current = true
    setIsSaving(true)
    setError('')
    try {
      const result = await batchUpdateApiKeyGroup(props.ids, group)
      if (!result.success) {
        setError(result.message || t('Failed to switch API key groups'))
        return
      }
      toast.success(
        t('Switched group for {{count}} API key(s)', {
          count: result.data ?? 0,
        })
      )
      props.onSuccess()
      triggerRefresh()
      props.onClose()
    } catch {
      setError(t('Failed to switch API key groups'))
    } finally {
      saving.current = false
      setIsSaving(false)
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open && !saving.current) props.onClose()
      }}
      title={t('Switch group')}
      desc={t('Choose a group for {{count}} selected API key(s).', {
        count: props.ids.length,
      })}
      confirmText={t('Confirm')}
      handleConfirm={handleConfirm}
      isLoading={isSaving}
      disabled={!canSubmit}
      className='max-w-lg'
    >
      <ApiKeyGroupCombobox
        value={group}
        options={options}
        onValueChange={setGroup}
        disabled={isSaving || groups.isFetching || loadFailed}
        placeholder={t('Select a group')}
      />
      {group === 'auto' && (
        <p className='text-muted-foreground text-sm'>
          {t('Switching to Cross-group uses the global group order.')}
        </p>
      )}
      {groups.isFetching && <p role='status'>{t('Loading...')}</p>}
      {loadFailed && <p role='alert'>{t('Failed to load groups')}</p>}
      {!groups.isFetching && !loadFailed && options.length === 0 && (
        <p>{t('No group found.')}</p>
      )}
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
    </ConfirmDialog>
  )
}
