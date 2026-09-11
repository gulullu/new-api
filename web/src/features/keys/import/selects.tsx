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
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

import { ApiKeyGroupCombobox } from '../components/api-key-group-combobox'
import type { GroupOption } from './types'

export function ImportSelect(props: {
  id?: string
  label: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  className?: string
}) {
  return (
    <Select
      value={props.value}
      onValueChange={(value) => {
        if (value !== null) props.onValueChange(value)
      }}
      disabled={props.disabled}
      items={props.options}
    >
      <SelectTrigger
        id={props.id}
        aria-label={props.label}
        className={props.className || 'w-full'}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align='start' alignItemWithTrigger={false}>
        {props.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ImportGroupSelect(props: {
  id?: string
  label: string
  value: string
  onValueChange: (value: string) => void
  groups: GroupOption[]
  inherited?: string
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const groups = props.groups.filter(
    (group) => group.value.trim().toLowerCase() !== 'parnter'
  )
  const inherited = groups.find((group) => group.value === props.inherited)
  const options =
    props.inherited === undefined
      ? groups
      : [
          {
            value: '',
            label: `${t('Inherit template')} · ${inherited?.label || props.inherited}`,
            desc: inherited?.desc,
            ratio: inherited?.ratio,
          },
          ...groups,
        ]
  return (
    <ApiKeyGroupCombobox
      id={props.id}
      ariaLabel={props.label}
      compact
      options={options}
      value={props.value}
      onValueChange={props.onValueChange}
      placeholder={t('Select a group')}
      disabled={props.disabled}
    />
  )
}
