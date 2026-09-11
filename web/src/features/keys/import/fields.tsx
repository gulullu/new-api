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
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { MultiSelect } from '@/components/multi-select'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getCurrencyLabel } from '@/lib/currency'

import { ImportSelect, ImportGroupSelect } from './selects'
import type { GroupOption, ImportFields } from './types'

type Props = {
  value: ImportFields
  onChange: (value: ImportFields) => void
  groups: GroupOption[]
  models: string[]
  disabled?: boolean
  inherit?: ImportFields
}

export function ImportFieldsEditor(props: Props) {
  const { t } = useTranslation()
  const id = useId()
  const update = (key: keyof ImportFields, value: string): void =>
    props.onChange({ ...props.value, [key]: value })
  const expiryMode = ['', '7', '30', 'never'].includes(props.value.expiry)
    ? props.value.expiry
    : 'date'
  const inheritLabel = t('Inherit template')
  const selectedModels =
    props.value.models === '*'
      ? []
      : props.value.models.split(',').filter(Boolean)
  return (
    <fieldset disabled={props.disabled} className='min-w-0 space-y-4'>
      <div className='grid gap-4 sm:grid-cols-3'>
        <div className='space-y-2'>
          <Label htmlFor={`${id}-group`}>{t('Group')}</Label>
          <ImportGroupSelect
            id={`${id}-group`}
            label={t('Group')}
            value={props.value.group}
            onValueChange={(value) => update('group', value)}
            groups={props.groups}
            inherited={props.inherit?.group}
            disabled={props.disabled}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor={`${id}-quota`}>
            {t('Quota ({{currency}})', { currency: getCurrencyLabel() })}
          </Label>
          <ImportQuotaInput
            label={t('Quota')}
            id={`${id}-quota`}
            value={props.value.quota}
            inherited={props.inherit?.quota}
            onChange={(quota) => update('quota', quota)}
          />
          <p className='text-muted-foreground text-xs'>
            {t('Quota applies to each key.')}
          </p>
        </div>
        <div className='space-y-2'>
          <Label htmlFor={`${id}-expiry`}>{t('Expiration')}</Label>
          <ImportSelect
            id={`${id}-expiry`}
            label={t('Expiration')}
            value={expiryMode}
            onValueChange={(value) => update('expiry', value)}
            disabled={props.disabled}
            options={[
              ...(props.inherit ? [{ value: '', label: inheritLabel }] : []),
              { value: '7', label: t('7 days after creation') },
              { value: '30', label: t('30 days after creation') },
              { value: 'never', label: t('Never') },
              { value: 'date', label: t('Custom date') },
            ]}
          />
          {expiryMode === 'date' && (
            <Input
              type='date'
              aria-label={t('Expiration date')}
              value={props.value.expiry === 'date' ? '' : props.value.expiry}
              onChange={(e) => update('expiry', e.target.value || 'date')}
            />
          )}
        </div>
      </div>
      <details className='rounded-lg border p-3'>
        <summary className='text-muted-foreground cursor-pointer text-sm'>
          {t('More settings: models and IP restrictions')}
        </summary>
        <div className='mt-4 grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor={`${id}-models`}>{t('Model Limits')}</Label>
            {props.inherit && (
              <ImportSelect
                label={t('Model inheritance')}
                value={props.value.models === '' ? 'inherit' : 'custom'}
                onValueChange={(value) =>
                  update('models', value === 'inherit' ? '' : '*')
                }
                disabled={props.disabled}
                options={[
                  { value: 'inherit', label: inheritLabel },
                  { value: 'custom', label: t('Custom') },
                ]}
              />
            )}
            {(!props.inherit || props.value.models !== '') && (
              <MultiSelect
                id={`${id}-models`}
                disabled={props.disabled}
                options={props.models.map((m) => ({ label: m, value: m }))}
                selected={selectedModels}
                onChange={(models) => update('models', models.join(',') || '*')}
                placeholder={t('Select models (empty for allow all)')}
              />
            )}
          </div>
          <div className='space-y-2'>
            <Label htmlFor={`${id}-ips`}>{t('IP Whitelist')}</Label>
            <Textarea
              id={`${id}-ips`}
              value={props.value.ips}
              onChange={(e) => update('ips', e.target.value)}
              placeholder={
                props.inherit
                  ? inheritLabel
                  : t('One IP address or CIDR per line')
              }
            />
            <p className='text-muted-foreground text-xs'>
              {t('Use * for unrestricted access; empty inherits the template.')}
            </p>
          </div>
        </div>
      </details>
    </fieldset>
  )
}

export function ImportQuotaInput(props: {
  id?: string
  label: string
  value: string
  inherited?: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const checkboxId = useId()
  const unlimited = props.value === 'unlimited'
  return (
    <div className='space-y-2'>
      <Input
        id={props.id}
        aria-label={props.label}
        inputMode='decimal'
        disabled={unlimited}
        value={unlimited ? '' : props.value}
        placeholder={
          unlimited || props.inherited === 'unlimited'
            ? t('Unlimited')
            : props.inherited || '0'
        }
        onChange={(event) => props.onChange(event.target.value)}
      />
      <div className='flex items-center gap-2 text-xs'>
        <Checkbox
          id={checkboxId}
          checked={unlimited}
          onCheckedChange={(checked) =>
            props.onChange(checked ? 'unlimited' : '')
          }
        />
        <Label htmlFor={checkboxId} className='text-xs'>
          {t('Unlimited')}
        </Label>
      </div>
    </div>
  )
}
