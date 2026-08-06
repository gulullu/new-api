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
import {
  BadgeCheck,
  RotateCcw,
  UsersRound,
  Waypoints,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'

import { formatAdminReferralCount, formatAdminReferralCredits } from '../lib'
import type { AdminReferralRewardSummary } from '../types'

interface AdminReferralSummaryProps {
  summary: AdminReferralRewardSummary
  isLoading: boolean
}

interface SummaryCardProps {
  label: string
  value: string
  detail: string
  icon: LucideIcon
  tone: IconBadgeTone
}

function SummaryCard(props: SummaryCardProps) {
  const Icon = props.icon

  return (
    <Card size='sm' className='min-w-0 shadow-sm'>
      <CardContent className='flex min-w-0 items-start gap-3'>
        <IconBadge tone={props.tone} size='lg'>
          <Icon />
        </IconBadge>
        <div className='min-w-0 flex-1'>
          <p className='text-muted-foreground text-xs leading-relaxed [overflow-wrap:anywhere] break-words whitespace-normal'>
            {props.label}
          </p>
          <p className='mt-1 text-xl font-semibold tracking-tight [overflow-wrap:anywhere] break-words whitespace-normal tabular-nums'>
            {props.value}
          </p>
          <p className='text-muted-foreground mt-1 text-xs leading-relaxed [overflow-wrap:anywhere] break-words whitespace-normal'>
            {props.detail}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminReferralSummary(props: AdminReferralSummaryProps) {
  const { t, i18n } = useTranslation()
  const summary = props.summary
  const locale = i18n.resolvedLanguage || i18n.language
  const number = (value: number) => formatAdminReferralCount(value, locale)

  const cards: SummaryCardProps[] = [
    {
      label: t('Reward events'),
      value: props.isLoading ? '—' : number(summary.total_records),
      detail: t('{{count}} withheld records', {
        count: number(summary.withheld_records),
      }),
      icon: Waypoints,
      tone: 'chart-1',
    },
    {
      label: t('Active reward credits'),
      value: props.isLoading
        ? '—'
        : formatAdminReferralCredits(summary.active_reward_quota, locale),
      detail: t('{{count}} awarded records', {
        count: number(summary.awarded_records),
      }),
      icon: BadgeCheck,
      tone: 'success',
    },
    {
      label: t('Reversed reward credits'),
      value: props.isLoading
        ? '—'
        : formatAdminReferralCredits(summary.reversed_reward_quota, locale),
      detail: t('{{count}} reversed records', {
        count: number(summary.reversed_records),
      }),
      icon: RotateCcw,
      tone: 'destructive',
    },
    {
      label: t('Referred users'),
      value: props.isLoading ? '—' : number(summary.unique_invitees),
      detail: t('{{count}} inviters', {
        count: number(summary.unique_inviters),
      }),
      icon: UsersRound,
      tone: 'chart-4',
    },
  ]

  return (
    <section
      aria-label={t('Site-wide referral summary')}
      className='grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'
    >
      {cards.map((card) => (
        <SummaryCard key={card.label} {...card} />
      ))}
    </section>
  )
}
