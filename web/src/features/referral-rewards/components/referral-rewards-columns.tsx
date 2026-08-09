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
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import {
  formatReferralPaidAmount,
  formatReferralRewardRate,
  getReferralPaymentProviderLabel,
  getReferralRewardStatusDisplay,
} from '../lib'
import type { ReferralReward } from '../types'

const WRAPPED_VALUE_CLASS =
  'min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]'

export function useReferralRewardsColumns(): ColumnDef<ReferralReward>[] {
  const { t, i18n } = useTranslation()

  return [
    {
      accessorKey: 'invitee_label',
      header: t('Invitee'),
      cell: ({ row }) => (
        <span
          data-referral-invitee
          className={`${WRAPPED_VALUE_CLASS} font-medium`}
        >
          {row.original.invitee_label || t('Private invitee')}
        </span>
      ),
      size: 230,
    },
    {
      accessorKey: 'payment_provider',
      header: t('Payment method'),
      cell: ({ row }) => (
        <span className={WRAPPED_VALUE_CLASS}>
          {getReferralPaymentProviderLabel(row.original.payment_provider)}
        </span>
      ),
      size: 160,
    },
    {
      accessorKey: 'paid_amount',
      header: t('Actual Amount'),
      cell: ({ row }) => (
        <span className={`${WRAPPED_VALUE_CLASS} font-medium tabular-nums`}>
          {formatReferralPaidAmount(
            row.original.paid_amount,
            row.original.paid_currency,
            i18n.resolvedLanguage
          )}
        </span>
      ),
      size: 180,
    },
    {
      accessorKey: 'rate_basis_points',
      header: t('Reward rate'),
      cell: ({ row }) => (
        <span className='font-medium tabular-nums'>
          {formatReferralRewardRate(row.original.rate_basis_points)}
        </span>
      ),
      size: 120,
    },
    {
      accessorKey: 'reward_quota',
      header: t('Reward'),
      cell: ({ row }) => (
        <span className={`${WRAPPED_VALUE_CLASS} font-semibold tabular-nums`}>
          {formatQuota(row.original.reward_quota)}
        </span>
      ),
      size: 150,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => {
        const display = getReferralRewardStatusDisplay(row.original.status, t)
        return (
          <StatusBadge
            label={display.label}
            variant={display.variant}
            copyable={false}
          />
        )
      },
      size: 120,
    },
    {
      accessorKey: 'created_at',
      header: t('Awarded at'),
      cell: ({ row }) => (
        <time
          className={`${WRAPPED_VALUE_CLASS} font-mono text-sm tabular-nums`}
          dateTime={new Date(row.original.created_at * 1000).toISOString()}
        >
          {formatTimestampToDate(row.original.created_at)}
        </time>
      ),
      size: 190,
    },
  ]
}
