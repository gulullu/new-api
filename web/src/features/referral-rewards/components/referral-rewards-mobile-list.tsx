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
import type { Table as TanstackTable } from '@tanstack/react-table'
import { BadgePercent } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import {
  formatReferralPaidAmount,
  formatReferralRewardRate,
  getReferralPaymentProviderLabel,
  getReferralRewardStatusDisplay,
} from '../lib'
import type { ReferralReward } from '../types'

const MOBILE_SKELETON_KEYS = [
  'referral-reward-skeleton-1',
  'referral-reward-skeleton-2',
  'referral-reward-skeleton-3',
  'referral-reward-skeleton-4',
  'referral-reward-skeleton-5',
]

function ReferralRewardsMobileSkeleton() {
  return (
    <div className='divide-border overflow-hidden rounded-lg border'>
      {MOBILE_SKELETON_KEYS.map((key) => (
        <div key={key} className='space-y-3 border-b p-3 last:border-b-0'>
          <div className='flex items-start justify-between gap-3'>
            <Skeleton className='h-4 w-40' />
            <Skeleton className='h-5 w-16 rounded-full' />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <Skeleton className='h-9 w-full' />
            <Skeleton className='h-9 w-full' />
            <Skeleton className='h-9 w-full' />
            <Skeleton className='h-9 w-full' />
          </div>
        </div>
      ))}
    </div>
  )
}

interface ReferralRewardFieldProps {
  label: string
  children: React.ReactNode
}

function ReferralRewardField(props: ReferralRewardFieldProps) {
  return (
    <div className='min-w-0 space-y-0.5'>
      <dt className='text-muted-foreground text-xs'>{props.label}</dt>
      <dd className='min-w-0 text-sm [overflow-wrap:anywhere] break-words whitespace-normal'>
        {props.children}
      </dd>
    </div>
  )
}

interface ReferralRewardMobileCardProps {
  reward: ReferralReward
}

export function ReferralRewardMobileCard(props: ReferralRewardMobileCardProps) {
  const { t, i18n } = useTranslation()
  const status = getReferralRewardStatusDisplay(props.reward.status, t)

  return (
    <article
      data-referral-reward-card
      className='bg-card min-w-0 space-y-3 border-b p-3 last:border-b-0'
    >
      <header className='flex min-w-0 items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <div className='text-muted-foreground text-xs'>{t('Invitee')}</div>
          <div
            data-referral-invitee
            className='min-w-0 text-sm font-semibold [overflow-wrap:anywhere] break-words whitespace-normal'
          >
            {props.reward.invitee_label || t('Private invitee')}
          </div>
        </div>
        <StatusBadge
          label={status.label}
          variant={status.variant}
          copyable={false}
        />
      </header>

      <dl className='grid min-w-0 grid-cols-2 gap-x-4 gap-y-3'>
        <ReferralRewardField label={t('Payment method')}>
          {getReferralPaymentProviderLabel(props.reward.payment_provider)}
        </ReferralRewardField>
        <ReferralRewardField label={t('Amount paid')}>
          <span className='font-medium tabular-nums'>
            {formatReferralPaidAmount(
              props.reward.paid_amount,
              props.reward.paid_currency,
              i18n.resolvedLanguage
            )}
          </span>
        </ReferralRewardField>
        <ReferralRewardField label={t('Reward rate')}>
          <span className='font-medium tabular-nums'>
            {formatReferralRewardRate(props.reward.rate_basis_points)}
          </span>
        </ReferralRewardField>
        <ReferralRewardField label={t('Reward')}>
          <span className='font-semibold tabular-nums'>
            {formatQuota(props.reward.reward_quota)}
          </span>
        </ReferralRewardField>
        <ReferralRewardField label={t('Awarded at')}>
          <time
            className='font-mono text-xs tabular-nums'
            dateTime={new Date(props.reward.created_at * 1000).toISOString()}
          >
            {formatTimestampToDate(props.reward.created_at)}
          </time>
        </ReferralRewardField>
      </dl>
    </article>
  )
}

interface ReferralRewardsMobileListProps {
  table: TanstackTable<ReferralReward>
  isLoading: boolean
}

export function ReferralRewardsMobileList(
  props: ReferralRewardsMobileListProps
) {
  const { t } = useTranslation()

  if (props.isLoading) return <ReferralRewardsMobileSkeleton />

  const rows = props.table.getRowModel().rows
  if (!rows.length) {
    return (
      <div className='rounded-lg border p-8'>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <BadgePercent className='size-6' />
            </EmptyMedia>
            <EmptyTitle>{t('No Referral Rewards Yet')}</EmptyTitle>
            <EmptyDescription className='break-words whitespace-normal'>
              {t(
                "Rewards will appear here after a referred user's first eligible paid top-up is confirmed."
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className='divide-border min-w-0 overflow-hidden rounded-lg border'>
      {rows.map((row) => (
        <ReferralRewardMobileCard key={row.original.id} reward={row.original} />
      ))}
    </div>
  )
}
