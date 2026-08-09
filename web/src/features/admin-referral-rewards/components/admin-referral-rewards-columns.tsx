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
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { formatTimestampToDate } from '@/lib/format'

import {
  formatAdminReferralCredits,
  formatAdminReferralPaidAmount,
  formatAdminReferralRate,
  getAdminReferralProviderLabel,
  getAdminReferralStatusDisplay,
} from '../lib'
import type { AdminReferralReward } from '../types'
import { AdminReferralUserIdentity } from './admin-referral-user-identity'

const WRAP_CLASS =
  'min-w-0 [overflow-wrap:anywhere] break-words whitespace-normal'

export function useAdminReferralRewardsColumns(): ColumnDef<AdminReferralReward>[] {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage

  return [
    {
      id: 'relationship',
      header: t('Referral relationship'),
      cell: ({ row }) => (
        <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2'>
          <AdminReferralUserIdentity
            label={row.original.inviter_label}
            id={row.original.inviter_id}
          />
          <ArrowRight
            aria-label={t('Invited')}
            className='text-muted-foreground size-4 shrink-0'
          />
          <AdminReferralUserIdentity
            label={row.original.invitee_label}
            id={row.original.invitee_id}
          />
        </div>
      ),
      size: 330,
    },
    {
      accessorKey: 'payment_provider',
      header: t('Payment method'),
      cell: ({ row }) => (
        <span className={WRAP_CLASS}>
          {getAdminReferralProviderLabel(row.original.payment_provider)}
        </span>
      ),
      size: 140,
    },
    {
      accessorKey: 'paid_amount',
      header: t('Actual Amount'),
      cell: ({ row }) => (
        <span className={`${WRAP_CLASS} font-medium tabular-nums`}>
          {formatAdminReferralPaidAmount(
            row.original.paid_amount,
            row.original.paid_currency,
            locale
          )}
        </span>
      ),
      size: 130,
    },
    {
      accessorKey: 'reward_quota',
      header: t('Reward credits'),
      cell: ({ row }) => (
        <div className='min-w-0'>
          <div className={`${WRAP_CLASS} font-semibold tabular-nums`}>
            {formatAdminReferralCredits(row.original.reward_quota, locale)}
          </div>
          <div className='text-muted-foreground mt-0.5 text-xs tabular-nums'>
            {formatAdminReferralRate(row.original.rate_basis_points)}
          </div>
        </div>
      ),
      size: 140,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => {
        const display = getAdminReferralStatusDisplay(row.original.status, t)
        return (
          <div className='min-w-0'>
            <StatusBadge
              label={display.label}
              variant={display.variant}
              copyable={false}
            />
            {row.original.reversal_reason && (
              <div
                className={`text-muted-foreground mt-1.5 text-xs leading-relaxed ${WRAP_CLASS}`}
              >
                {row.original.reversal_reason}
              </div>
            )}
          </div>
        )
      },
      size: 170,
    },
    {
      accessorKey: 'created_at',
      header: t('Created at'),
      cell: ({ row }) => (
        <time
          className={`${WRAP_CLASS} font-mono text-xs tabular-nums`}
          dateTime={new Date(row.original.created_at * 1000).toISOString()}
        >
          {formatTimestampToDate(row.original.created_at)}
        </time>
      ),
      size: 175,
    },
  ]
}
