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
import { ArrowRight, Database } from 'lucide-react'
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
import { formatTimestampToDate } from '@/lib/format'

import {
  formatAdminReferralCredits,
  formatAdminReferralPaidAmount,
  formatAdminReferralRate,
  getAdminReferralProviderLabel,
  getAdminReferralStatusDisplay,
} from '../lib'
import type { AdminReferralReward } from '../types'

function AdminReferralMobileSkeleton() {
  return (
    <div className='divide-border overflow-hidden rounded-lg border'>
      {[1, 2, 3, 4].map((key) => (
        <div key={key} className='space-y-3 border-b p-3 last:border-b-0'>
          <div className='flex items-center justify-between gap-3'>
            <Skeleton className='h-4 w-48' />
            <Skeleton className='h-5 w-16 rounded-md' />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
        </div>
      ))}
    </div>
  )
}

interface MobileFieldProps {
  label: string
  children: React.ReactNode
}

function MobileField(props: MobileFieldProps) {
  return (
    <div className='min-w-0'>
      <dt className='text-muted-foreground text-[11px] leading-relaxed [overflow-wrap:anywhere] break-words whitespace-normal'>
        {props.label}
      </dt>
      <dd className='mt-0.5 text-sm [overflow-wrap:anywhere] break-words whitespace-normal'>
        {props.children}
      </dd>
    </div>
  )
}

export function AdminReferralRewardMobileCard(props: {
  reward: AdminReferralReward
}) {
  const { t, i18n } = useTranslation()
  const reward = props.reward
  const status = getAdminReferralStatusDisplay(reward.status, t)
  const locale = i18n.resolvedLanguage

  return (
    <article
      data-admin-referral-card
      className='bg-card min-w-0 space-y-3 border-b p-3 last:border-b-0'
    >
      <header className='flex min-w-0 items-start justify-between gap-3'>
        <div className='grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2'>
          <div className='min-w-0'>
            <div
              data-admin-referral-inviter
              className='font-medium [overflow-wrap:anywhere] break-words whitespace-normal'
            >
              {reward.inviter_label || t('Deleted user')}
            </div>
            <div className='text-muted-foreground text-[11px] tabular-nums'>
              #{reward.inviter_id}
            </div>
          </div>
          <ArrowRight
            aria-label={t('Invited')}
            className='text-muted-foreground size-4 shrink-0'
          />
          <div className='min-w-0'>
            <div
              data-admin-referral-invitee
              className='font-medium [overflow-wrap:anywhere] break-words whitespace-normal'
            >
              {reward.invitee_label || t('Deleted user')}
            </div>
            <div className='text-muted-foreground text-[11px] tabular-nums'>
              #{reward.invitee_id}
            </div>
          </div>
        </div>
        <StatusBadge
          label={status.label}
          variant={status.variant}
          copyable={false}
        />
      </header>

      <dl className='grid min-w-0 grid-cols-2 gap-x-4 gap-y-3'>
        <MobileField label={t('Payment method')}>
          {getAdminReferralProviderLabel(reward.payment_provider)}
        </MobileField>
        <MobileField label={t('Actual Amount')}>
          <span className='font-medium tabular-nums'>
            {formatAdminReferralPaidAmount(
              reward.paid_amount,
              reward.paid_currency,
              locale
            )}
          </span>
        </MobileField>
        <MobileField label={t('Reward credits')}>
          <span className='font-semibold tabular-nums'>
            {formatAdminReferralCredits(reward.reward_quota, locale)}
          </span>{' '}
          <span className='text-muted-foreground text-xs tabular-nums'>
            ({formatAdminReferralRate(reward.rate_basis_points)})
          </span>
        </MobileField>
        <MobileField label={t('Created at')}>
          <time dateTime={new Date(reward.created_at * 1000).toISOString()}>
            {formatTimestampToDate(reward.created_at)}
          </time>
        </MobileField>
      </dl>

      {reward.reversal_reason && (
        <div className='bg-muted/50 min-w-0 rounded-lg px-3 py-2'>
          <div className='text-muted-foreground text-[11px]'>
            {t('Reversal reason')}
          </div>
          <p className='mt-0.5 text-sm leading-relaxed [overflow-wrap:anywhere] break-words whitespace-normal'>
            {reward.reversal_reason}
          </p>
        </div>
      )}
    </article>
  )
}

interface AdminReferralRewardsMobileListProps {
  table: TanstackTable<AdminReferralReward>
  isLoading: boolean
}

export function AdminReferralRewardsMobileList(
  props: AdminReferralRewardsMobileListProps
) {
  const { t } = useTranslation()
  const rows = props.table.getRowModel().rows

  if (props.isLoading) return <AdminReferralMobileSkeleton />

  if (!rows.length) {
    return (
      <div className='rounded-lg border p-8'>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Database className='size-6' />
            </EmptyMedia>
            <EmptyTitle>{t('No referral records found')}</EmptyTitle>
            <EmptyDescription>
              {t('Try changing the search or filter criteria.')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className='divide-border overflow-hidden rounded-lg border'>
      {rows.map((row) => (
        <AdminReferralRewardMobileCard
          key={row.original.id}
          reward={row.original}
        />
      ))}
    </div>
  )
}
