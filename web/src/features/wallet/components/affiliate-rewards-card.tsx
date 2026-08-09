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
import { Share2 } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  rewardPercent?: number
  qualifiedPayments?: number
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard(props: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  const rulesHeadingId = useId()
  const referralLinkId = useId()
  const rewardPercent = props.rewardPercent ?? 3
  const qualifiedPayments = props.qualifiedPayments ?? 0
  const complianceConfirmed = props.complianceConfirmed ?? true
  const rewardRate = `${rewardPercent}%`

  if (props.loading) {
    return (
      <Card
        data-card-hover='false'
        className='border-chart-3/20 from-chart-3/5 bg-gradient-to-br via-transparent to-transparent py-0 shadow-sm'
      >
        <CardContent className='space-y-4 p-3 sm:p-4'>
          <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-center'>
            <div>
              <Skeleton className='h-5 w-32' />
              <Skeleton className='mt-2 h-4 w-full max-w-xl' />
            </div>
            <Skeleton className='h-14 rounded-lg' />
          </div>
          <Skeleton className='h-10 rounded-lg' />
          <div className='border-border/70 space-y-2 border-t pt-4'>
            <Skeleton className='h-4 w-44' />
            <Skeleton className='h-12 rounded-lg' />
            <Skeleton className='h-20 rounded-lg' />
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (props.user?.aff_quota ?? 0) > 0

  return (
    <Card
      data-card-hover='false'
      className='border-chart-3/20 from-chart-3/5 bg-gradient-to-br via-transparent to-transparent py-0 shadow-sm'
    >
      <CardContent className='space-y-4 p-3 sm:p-4'>
        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-center'>
          <div className='flex min-w-0 items-start gap-2.5'>
            <IconBadge tone='chart-3'>
              <Share2 />
            </IconBadge>
            <div className='min-w-0'>
              <h3 className='text-sm font-semibold break-words'>
                {t('Referral Program')}
              </h3>
              <p
                className='text-muted-foreground mt-1 text-xs leading-relaxed break-words whitespace-normal'
                data-referral-summary
              >
                {t(
                  'Invite friends and earn {{rewardRate}} of the amount they actually pay on every eligible top-up.',
                  { rewardRate }
                )}
              </p>
            </div>
          </div>

          <dl className='grid grid-cols-3 gap-1.5 text-center'>
            {[
              [
                'pending',
                t('Pending'),
                formatQuota(props.user?.aff_quota ?? 0),
              ],
              [
                'total-earned',
                t('Total Earned'),
                formatQuota(props.user?.aff_history_quota ?? 0),
              ],
              [
                'qualified-payments',
                t('Invitee payments'),
                String(qualifiedPayments),
              ],
            ].map(([metric, label, value]) => (
              <div
                key={metric}
                className='border-border/60 bg-background/70 min-w-0 rounded-lg border px-1.5 py-2 shadow-xs'
                data-referral-metric={metric}
              >
                <dt className='text-muted-foreground text-[10px] leading-tight font-medium tracking-wider break-words uppercase'>
                  {label}
                </dt>
                <dd className='mt-1 text-sm leading-tight font-semibold break-words tabular-nums'>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className='border-border/60 bg-background/45 min-w-0 space-y-2 rounded-lg border p-2.5 sm:p-3'>
          <label
            htmlFor={referralLinkId}
            className='text-muted-foreground block text-xs leading-relaxed font-medium break-words whitespace-normal'
          >
            {t('Your Referral Link')}
          </label>
          <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center'>
            <div className='flex min-w-0 flex-1 items-center gap-2'>
              <Input
                id={referralLinkId}
                value={props.affiliateLink}
                readOnly
                className='border-muted bg-background/80 h-9 min-w-0 flex-1 font-mono text-xs'
              />
              <CopyButton
                value={props.affiliateLink}
                variant='outline'
                className='bg-background size-9 shrink-0'
                iconClassName='size-4'
                tooltip={t('Copy referral link')}
                aria-label={t('Copy referral link')}
              />
            </div>
            <Button
              data-referral-transfer
              onClick={props.onTransfer}
              disabled={!hasRewards || !complianceConfirmed}
              className='h-9 w-full shrink-0 px-3 sm:w-auto'
              size='sm'
            >
              {t('Transfer to Balance')}
            </Button>
          </div>
        </div>

        {!complianceConfirmed ? (
          <p className='text-muted-foreground text-xs leading-relaxed break-words whitespace-normal'>
            {t(
              'Referral reward transfer is disabled until the administrator confirms compliance terms.'
            )}
          </p>
        ) : null}

        <section
          className='border-border/70 min-w-0 space-y-3 border-t pt-4'
          aria-labelledby={rulesHeadingId}
          data-referral-rules
        >
          <h4 id={rulesHeadingId} className='text-sm font-semibold break-words'>
            {t('How referral rewards work')}
          </h4>

          <p className='border-chart-3/30 bg-chart-3/5 rounded-lg border px-3 py-2 text-xs leading-relaxed font-medium break-words whitespace-normal'>
            {t(
              'Referral reward = checkout amount actually paid after all discounts × {{rewardRate}}',
              { rewardRate }
            )}
          </p>

          <div className='grid min-w-0 gap-x-6 gap-y-3 lg:grid-cols-2'>
            {[
              [
                t('Who is eligible'),
                t(
                  "New users receive the platform's registration credit. Inviting someone alone does not create a referral reward; each eligible payment from the invitee earns its corresponding reward after confirmation."
                ),
              ],
              [
                t('When the reward is issued'),
                t(
                  'Every eligible paid top-up from a referred user earns a reward after the payment is successfully confirmed.'
                ),
              ],
              [
                t('How the amount is calculated'),
                t(
                  'Only the payment processor-confirmed amount actually paid in a supported fiat currency is used. The top-up face value, pre-discount amount, and unsupported settlement currencies are not used as the reward basis.'
                ),
              ],
              [
                t('How rewards are delivered'),
                t(
                  'After payment confirmation, the reward appears under Pending and can be transferred to your balance.'
                ),
              ],
              [
                t('Ineligible transactions'),
                t(
                  'Redemption codes, promotional credits, administrator adjustments, and failed, canceled, duplicate, refunded, or disputed orders are ineligible. Related rewards may be withheld, reversed, or deducted.'
                ),
              ],
              [
                t('Fair-use policy'),
                t(
                  'Rewards linked to self-referrals, bulk registrations, duplicate accounts, fraud, or other abuse may be withheld, reversed, or deducted. Related accounts may also be suspended.'
                ),
              ],
            ].map(([title, description]) => (
              <div key={title} className='min-w-0'>
                <h5 className='text-xs leading-relaxed font-medium break-words whitespace-normal'>
                  {title}
                </h5>
                <p className='text-muted-foreground mt-0.5 text-xs leading-relaxed break-words whitespace-normal'>
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
