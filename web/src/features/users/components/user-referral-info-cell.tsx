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

import { StatusBadge } from '@/components/status-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatQuota } from '@/lib/format'

import type { User } from '../types'

interface UserReferralInfoCellProps {
  user: User
}

export function UserReferralInfoCell(props: UserReferralInfoCellProps) {
  const { t } = useTranslation()
  const inviterId = props.user.inviter_id ?? 0
  const qualifiedInvitees = props.user.qualified_referral_invitees ?? 0
  const affHistoryQuota = props.user.aff_history_quota ?? 0
  const inviteeCountLabel =
    qualifiedInvitees === 1
      ? t('{{count}} eligible invitee', { count: qualifiedInvitees })
      : t('{{count}} eligible invitees', { count: qualifiedInvitees })

  return (
    <div
      data-user-referral-info
      className='flex max-w-full min-w-0 flex-wrap items-center gap-1'
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <StatusBadge
              label={inviteeCountLabel}
              variant='neutral'
              copyable={false}
              className='cursor-help'
            />
          }
        />
        <TooltipContent>
          <p className='max-w-64 text-xs leading-relaxed whitespace-normal'>
            {t(
              'Invitees whose first verified paid top-up produced a reward; reversed rewards are excluded.'
            )}
          </p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <StatusBadge
              label={`${t('Rewards')} ${formatQuota(affHistoryQuota)}`}
              variant='neutral'
              copyable={false}
              className='cursor-help'
            />
          }
        />
        <TooltipContent>
          <p className='text-xs'>
            {t(
              'Cumulative referral reward credits, net of refunds and disputes.'
            )}
          </p>
        </TooltipContent>
      </Tooltip>
      {inviterId > 0 ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <StatusBadge
                label={t('Inviter #{{id}}', { id: inviterId })}
                variant='neutral'
                copyable={false}
                className='cursor-help'
              />
            }
          />
          <TooltipContent>
            <p className='text-xs'>
              {t('Invited by user ID')} {inviterId}
            </p>
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}
