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

interface AdminReferralUserIdentityProps {
  label: string
  id: number
}

export function AdminReferralUserIdentity(
  props: AdminReferralUserIdentityProps
) {
  const { t } = useTranslation()

  return (
    <div className='min-w-0'>
      <div className='min-w-0 font-medium [overflow-wrap:anywhere] break-words whitespace-normal'>
        {props.label || t('Deleted user')}
      </div>
      <div className='text-muted-foreground mt-0.5 text-xs tabular-nums'>
        {t('User ID')}: {props.id}
      </div>
    </div>
  )
}
