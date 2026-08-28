import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownToLine,
  ArrowUpRight,
  BadgePercent,
  ChevronDown,
  Clock3,
  ClipboardCheck,
  Copy,
  Crown,
  HandCoins,
  Landmark,
  Link2,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  WalletCards,
  Zap,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RELAYBASES_I18N_NAMESPACE } from '@/features/relaybases/i18n/manifest'
import { useAffiliate } from '@/features/wallet/hooks'
import { cn } from '@/lib/utils'

import {
  getPartnerCommissions,
  getPartnerSummary,
  getPartnerWithdrawals,
} from './api'
import {
  PartnerTransferDialog,
  PartnerWithdrawalDialog,
} from './components/partner-dialogs'
import {
  netPartnerLifetimeUsdMicros,
  partnerDate,
  percentFromBasisPoints,
  usdFromMicros,
} from './lib'

function PartnerMetric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  icon: typeof Clock3
}) {
  return (
    <div className='bg-background/75 ring-border/70 min-w-0 rounded-xl p-4 ring-1 backdrop-blur-sm'>
      <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
        <Icon className='size-4' />
        {label}
      </div>
      <div className='mt-2 truncate text-xl font-semibold tracking-tight'>
        {value}
      </div>
      <p className='text-muted-foreground mt-1 text-xs'>{detail}</p>
    </div>
  )
}

const PARTNER_RULE_ICONS = [
  UserRoundCheck,
  BadgePercent,
  Zap,
  Clock3,
  WalletCards,
  Landmark,
  ClipboardCheck,
  ShieldCheck,
] as const

export function PartnerRules() {
  const { t } = useTranslation(RELAYBASES_I18N_NAMESPACE)
  const rules = t('partner.rules.items', { returnObjects: true }) as string[]
  const ruleLabels = t('partner.rules.labels', {
    returnObjects: true,
  }) as string[]
  return (
    <details
      open
      className='group from-muted/35 via-background to-primary/[0.04] border-border/70 overflow-hidden rounded-2xl border bg-gradient-to-br shadow-sm'
    >
      <summary className='hover:bg-muted/35 focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden'>
        <span className='flex min-w-0 items-center gap-3'>
          <span className='from-primary/20 via-primary/10 text-primary ring-primary/20 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ring-inset'>
            <ShieldCheck className='size-[18px]' aria-hidden='true' />
          </span>
          <span className='min-w-0'>
            <span className='text-foreground block font-semibold tracking-tight'>
              {t('partner.rules.title')}
            </span>
            <span className='text-muted-foreground mt-0.5 block text-xs leading-5 sm:text-sm'>
              {t('partner.rules.description')}
            </span>
          </span>
        </span>
        <ChevronDown
          className='text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180'
          aria-hidden='true'
        />
      </summary>
      <ul
        data-partner-rules
        className='bg-muted/10 grid gap-3 border-t p-3 sm:grid-cols-2 sm:gap-3.5 sm:p-4'
      >
        {rules.map((rule, index) => {
          const Icon = PARTNER_RULE_ICONS[index] ?? ShieldCheck
          return (
            <li
              key={rule}
              data-partner-rule
              className='group/rule border-border/60 bg-background/85 hover:border-primary/30 relative flex min-w-0 gap-3 rounded-xl border p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm'
            >
              <span className='from-primary/15 to-primary/5 text-primary ring-primary/20 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-inset'>
                <Icon className='size-4' aria-hidden='true' />
              </span>
              <span className='min-w-0'>
                <span
                  data-partner-rule-label
                  className='text-foreground block text-sm font-semibold tracking-tight'
                >
                  {ruleLabels[index]}
                </span>
                <span className='text-muted-foreground mt-1 block text-[13px] leading-5'>
                  {rule}
                </span>
              </span>
              <span
                aria-hidden='true'
                className='bg-primary/25 absolute top-0 right-4 h-px w-10 opacity-0 transition-opacity group-hover/rule:opacity-100'
              />
            </li>
          )
        })}
      </ul>
    </details>
  )
}

function PartnerPagination({
  page,
  total,
  onPageChange,
}: {
  page: number
  total: number
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation(RELAYBASES_I18N_NAMESPACE)
  return (
    <div className='mt-3 flex justify-end gap-2'>
      <Button
        variant='outline'
        size='sm'
        disabled={page === 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        {t('partner.activity.previous')}
      </Button>
      <Button
        variant='outline'
        size='sm'
        disabled={total <= page * 10}
        onClick={() => onPageChange(page + 1)}
      >
        {t('partner.activity.next')}
      </Button>
    </div>
  )
}

function PartnerActivity({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation(RELAYBASES_I18N_NAMESPACE)
  const [commissionPage, setCommissionPage] = useState(1)
  const [withdrawalPage, setWithdrawalPage] = useState(1)
  const commissions = useQuery({
    queryKey: ['partner-commissions', commissionPage],
    queryFn: () => getPartnerCommissions(commissionPage, 10),
    enabled,
  })
  const withdrawals = useQuery({
    queryKey: ['partner-withdrawals', withdrawalPage],
    queryFn: () => getPartnerWithdrawals(withdrawalPage, 10),
    enabled,
  })

  const commissionItems = commissions.data?.data?.items ?? []
  let commissionContent: ReactNode
  if (!enabled || commissions.isLoading) {
    commissionContent = (
      <div className='space-y-3 p-4'>
        <Skeleton className='h-14 w-full' />
        <Skeleton className='h-14 w-full' />
      </div>
    )
  } else if (commissions.isError) {
    commissionContent = (
      <div className='flex flex-col items-center gap-3 p-8 text-center'>
        <p className='text-muted-foreground text-sm'>
          {t('partner.errors.load')}
        </p>
        <Button
          variant='outline'
          size='sm'
          onClick={() => commissions.refetch()}
        >
          {t('partner.errors.retry')}
        </Button>
      </div>
    )
  } else if (commissionItems.length === 0) {
    commissionContent = (
      <p className='text-muted-foreground p-8 text-center text-sm'>
        {t('partner.activity.emptyCommissions')}
      </p>
    )
  } else {
    commissionContent = commissionItems.map((item) => {
      const reversed = item.status === 'reversed'
      let settlementLabel = t('partner.status.available')
      if (reversed) {
        settlementLabel = t('partner.status.reversed')
      } else if (item.partner_settlement === 'pending') {
        settlementLabel = t('partner.status.availableOn', {
          date: partnerDate(item.partner_available_at),
        })
      }
      return (
        <div
          key={item.id}
          className='grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'
        >
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2 font-medium'>
              <span>{item.invitee_label}</span>
              <Badge variant='outline'>
                {percentFromBasisPoints(item.rate_basis_points)}
              </Badge>
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t('partner.activity.paidAmount', {
                amount: `${item.paid_currency} ${item.paid_amount}`,
              })}{' '}
              · {partnerDate(item.created_at)}
            </p>
          </div>
          <div className='sm:text-right'>
            <div
              className={cn(
                'font-semibold',
                reversed
                  ? 'text-destructive'
                  : 'text-emerald-600 dark:text-emerald-400'
              )}
            >
              {reversed ? '−' : '+'}
              {usdFromMicros(item.commission_usd_micros)}
            </div>
            <p className='text-muted-foreground text-xs'>{settlementLabel}</p>
          </div>
        </div>
      )
    })
  }

  const withdrawalItems = withdrawals.data?.data?.items ?? []
  let withdrawalContent: ReactNode
  if (!enabled || withdrawals.isLoading) {
    withdrawalContent = (
      <div className='space-y-3 p-4'>
        <Skeleton className='h-14 w-full' />
      </div>
    )
  } else if (withdrawals.isError) {
    withdrawalContent = (
      <div className='flex flex-col items-center gap-3 p-8 text-center'>
        <p className='text-muted-foreground text-sm'>
          {t('partner.errors.load')}
        </p>
        <Button
          variant='outline'
          size='sm'
          onClick={() => withdrawals.refetch()}
        >
          {t('partner.errors.retry')}
        </Button>
      </div>
    )
  } else if (withdrawalItems.length === 0) {
    withdrawalContent = (
      <p className='text-muted-foreground p-8 text-center text-sm'>
        {t('partner.activity.emptyWithdrawals')}
      </p>
    )
  } else {
    withdrawalContent = withdrawalItems.map((item) => (
      <div
        key={item.id}
        className='grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'
      >
        <div>
          <div className='font-medium'>
            {item.method === 'alipay'
              ? t('partner.withdrawal.alipay')
              : t('partner.withdrawal.bsc')}
          </div>
          <p className='text-muted-foreground mt-1 text-xs'>
            {item.destination_masked} · {partnerDate(item.requested_at)}
          </p>
          {item.admin_note ? (
            <p className='text-muted-foreground mt-1 text-xs'>
              {item.admin_note}
            </p>
          ) : null}
        </div>
        <div className='sm:text-right'>
          <div className='font-semibold'>
            {usdFromMicros(item.amount_usd_micros)}
          </div>
          <Badge variant={item.status === 'paid' ? 'default' : 'outline'}>
            {t(`partner.withdrawal.status.${item.status}`)}
          </Badge>
        </div>
      </div>
    ))
  }

  return (
    <Tabs defaultValue='commissions'>
      <TabsList>
        <TabsTrigger value='commissions'>
          {t('partner.activity.commissions')}
        </TabsTrigger>
        <TabsTrigger value='withdrawals'>
          {t('partner.activity.withdrawals')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value='commissions' className='mt-3'>
        <div className='divide-y rounded-xl border'>{commissionContent}</div>
        <PartnerPagination
          page={commissionPage}
          total={commissions.data?.data?.total ?? 0}
          onPageChange={setCommissionPage}
        />
      </TabsContent>
      <TabsContent value='withdrawals' className='mt-3'>
        <div className='divide-y rounded-xl border'>{withdrawalContent}</div>
        <PartnerPagination
          page={withdrawalPage}
          total={withdrawals.data?.data?.total ?? 0}
          onPageChange={setWithdrawalPage}
        />
      </TabsContent>
    </Tabs>
  )
}

export function PartnerRewards() {
  const { t } = useTranslation(RELAYBASES_I18N_NAMESPACE)
  const queryClient = useQueryClient()
  const [transferOpen, setTransferOpen] = useState(false)
  const [withdrawalOpen, setWithdrawalOpen] = useState(false)
  const { affiliateLink } = useAffiliate()
  const summary = useQuery({
    queryKey: ['partner-summary'],
    queryFn: getPartnerSummary,
  })
  const data = summary.data?.data

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['partner-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['partner-commissions'] }),
      queryClient.invalidateQueries({ queryKey: ['partner-withdrawals'] }),
    ])
  }

  const copyLink = async () => {
    if (!affiliateLink) return
    await navigator.clipboard.writeText(affiliateLink)
    toast.success(t('partner.hero.linkCopied'))
  }

  let summaryContent: ReactNode
  if (summary.isError) {
    summaryContent = (
      <div className='border-destructive/25 bg-destructive/5 flex flex-col items-start gap-3 rounded-xl border p-4'>
        <p className='text-destructive text-sm'>{t('partner.errors.load')}</p>
        <Button variant='outline' size='sm' onClick={() => summary.refetch()}>
          {t('partner.errors.retry')}
        </Button>
      </div>
    )
  } else if (summary.isLoading) {
    summaryContent = (
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {['available', 'pending', 'lifetime', 'withdrawn'].map((key) => (
          <Skeleton key={key} className='h-28 rounded-xl' />
        ))}
      </div>
    )
  } else {
    summaryContent = (
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <PartnerMetric
          icon={WalletCards}
          label={t('partner.metrics.available')}
          value={usdFromMicros(data?.available_usd_micros ?? 0)}
          detail={t('partner.metrics.availableDetail')}
        />
        <PartnerMetric
          icon={Clock3}
          label={t('partner.metrics.pending')}
          value={usdFromMicros(data?.pending_usd_micros ?? 0)}
          detail={t('partner.metrics.pendingDetail')}
        />
        <PartnerMetric
          icon={HandCoins}
          label={t('partner.metrics.lifetime')}
          value={usdFromMicros(
            netPartnerLifetimeUsdMicros(
              data?.lifetime_earned_usd_micros ?? 0,
              data?.lifetime_reversed_usd_micros ?? 0
            )
          )}
          detail={t('partner.metrics.lifetimeDetail')}
        />
        <PartnerMetric
          icon={ShieldCheck}
          label={t('partner.metrics.withdrawn')}
          value={usdFromMicros(data?.lifetime_withdrawn_usd_micros ?? 0)}
          detail={t('partner.metrics.withdrawnDetail')}
        />
      </div>
    )
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('partner.pageTitle')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto w-full max-w-7xl space-y-4 sm:space-y-5'>
            <Card className='relative overflow-hidden border-amber-500/20 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.16),transparent_42%)] shadow-sm'>
              <div className='pointer-events-none absolute -top-20 -right-16 size-52 rounded-full bg-amber-400/10 blur-3xl' />
              <CardHeader className='relative gap-3 sm:grid-cols-[minmax(0,1fr)_auto]'>
                <div>
                  <Badge className='mb-3 gap-1.5 bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300'>
                    <Crown className='size-3.5' />
                    {t('partner.hero.badge')}
                  </Badge>
                  <CardTitle className='flex items-center gap-2 text-xl sm:text-2xl'>
                    <Sparkles className='text-primary size-5' />
                    {t('partner.hero.title')}
                  </CardTitle>
                  <CardDescription className='mt-2 max-w-2xl leading-6'>
                    {t('partner.hero.description', {
                      rate: percentFromBasisPoints(
                        data?.commission_basis_points ?? 3000
                      ),
                    })}
                  </CardDescription>
                </div>
                <div className='flex flex-wrap gap-2 sm:justify-end'>
                  <Button
                    variant='outline'
                    onClick={() => setTransferOpen(true)}
                    disabled={
                      !data ||
                      data.available_usd_micros <
                        data.minimum_transfer_usd_micros
                    }
                  >
                    <ArrowUpRight />
                    {t('partner.actions.transfer')}
                  </Button>
                  <Button
                    onClick={() => setWithdrawalOpen(true)}
                    disabled={
                      !data ||
                      data.available_usd_micros <
                        data.minimum_withdrawal_usd_micros ||
                      data.active_withdrawal_id > 0
                    }
                  >
                    <ArrowDownToLine />
                    {t('partner.actions.withdraw')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className='relative space-y-4'>
                {summaryContent}

                {data && data.debt_usd_micros > 0 ? (
                  <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-3 text-sm'>
                    {t('partner.adjustment', {
                      amount: usdFromMicros(data.debt_usd_micros),
                    })}
                  </div>
                ) : null}

                <div className='bg-muted/35 flex min-w-0 flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center'>
                  <div className='flex min-w-0 flex-1 items-center gap-2'>
                    <Link2 className='text-primary size-4 shrink-0' />
                    <div className='min-w-0'>
                      <div className='text-xs font-medium'>
                        {t('partner.hero.linkLabel')}
                      </div>
                      <div className='text-muted-foreground truncate text-xs'>
                        {affiliateLink || '—'}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={copyLink}
                    disabled={!affiliateLink}
                  >
                    <Copy />
                    {t('partner.hero.copyLink')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('partner.activity.title')}</CardTitle>
                <CardDescription>
                  {t('partner.activity.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <PartnerActivity enabled={summary.isSuccess} />
                <PartnerRules />
              </CardContent>
            </Card>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <PartnerTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        availableUsdMicros={data?.available_usd_micros ?? 0}
        onComplete={refresh}
      />
      <PartnerWithdrawalDialog
        open={withdrawalOpen}
        onOpenChange={setWithdrawalOpen}
        availableUsdMicros={data?.available_usd_micros ?? 0}
        onComplete={refresh}
      />
    </>
  )
}
