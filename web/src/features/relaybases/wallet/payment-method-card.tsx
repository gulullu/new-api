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
import { Check, ChevronRight, Loader2 } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { SiAlipay, SiStripe, SiWechat } from 'react-icons/si'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { getPaymentIcon } from '../../wallet/lib'
import type { PaymentMethod } from '../../wallet/types'
import { RELAYBASES_I18N_NAMESPACE } from '../i18n/manifest'
import {
  getRelayBasesChinesePaymentHint,
  getRelayBasesPaymentCopyKey,
  getRelayBasesPaymentGridClass,
  orderRelayBasesPaymentMethods,
} from './policy'

interface RelayBasesPaymentMethodCardProps {
  method: PaymentMethod
  minimum: number
  topupAmount: number
  loading: boolean
  selected?: boolean
  paymentBusy: boolean
  onSelect: () => void
}

type RelayBasesPaymentBrand = 'stripe' | 'waffo' | 'generic'

function getRelayBasesPaymentBrand(
  paymentType: string
): RelayBasesPaymentBrand {
  if (paymentType === 'stripe') return 'stripe'
  if (paymentType === 'waffo' || paymentType === 'waffo_pancake') {
    return 'waffo'
  }
  return 'generic'
}

function RelayBasesPaymentBrandIcon(props: {
  brand: RelayBasesPaymentBrand
  method: PaymentMethod
}) {
  if (props.brand === 'stripe') {
    return <SiStripe aria-hidden='true' className='size-6 text-white' />
  }

  if (props.brand === 'waffo') {
    return (
      <>
        <img
          src='/waffo-logo-dark.svg'
          alt=''
          aria-hidden='true'
          className='block size-7 object-contain dark:hidden'
        />
        <img
          src='/waffo-logo-light.svg'
          alt=''
          aria-hidden='true'
          className='hidden size-7 object-contain dark:block'
        />
      </>
    )
  }

  return getPaymentIcon(
    props.method.type,
    'size-6',
    props.method.icon,
    props.method.name
  )
}

export function RelayBasesPaymentMethodCard({
  method,
  minimum,
  topupAmount,
  loading,
  selected = false,
  paymentBusy,
  onSelect,
}: RelayBasesPaymentMethodCardProps) {
  const descriptionId = useId()
  const { t, i18n } = useTranslation(RELAYBASES_I18N_NAMESPACE)
  const belowMinimum = topupAmount < minimum
  const disabled = belowMinimum || paymentBusy
  const copyKey = getRelayBasesPaymentCopyKey(method.type)
  const description = belowMinimum
    ? t('wallet.minimum.card', { amount: minimum })
    : t(copyKey)
  const channelHint = belowMinimum
    ? null
    : getRelayBasesChinesePaymentHint(
        method.type,
        i18n.resolvedLanguage ?? i18n.language
      )
  const accessibleName = t('wallet.payment.accessibleName', {
    name: method.name,
  })
  const brand = getRelayBasesPaymentBrand(method.type)
  const active = !belowMinimum && (selected || loading)
  let trailingIcon = (
    <ChevronRight className='size-4 transition-transform group-hover:translate-x-0.5' />
  )
  if (active) {
    trailingIcon = <Check className='size-4' />
  }
  if (loading) {
    trailingIcon = <Loader2 className='size-4 animate-spin' />
  }

  return (
    <Button
      type='button'
      variant='outline'
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
      aria-busy={loading}
      aria-label={
        belowMinimum ? `${accessibleName}. ${description}` : accessibleName
      }
      aria-describedby={descriptionId}
      title={belowMinimum ? description : undefined}
      className={cn(
        'group relative h-auto min-h-[88px] w-full min-w-0 justify-start gap-3.5 overflow-hidden rounded-2xl border-2 px-4 py-3.5 text-left whitespace-normal shadow-sm transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed',
        brand === 'stripe' &&
          'border-[#635BFF]/25 bg-gradient-to-br from-background via-background to-[#635BFF]/[0.07] hover:border-[#635BFF]/60 hover:bg-[#635BFF]/[0.06] dark:border-[#7A73FF]/35 dark:to-[#635BFF]/[0.12]',
        brand === 'waffo' &&
          'border-slate-900/20 bg-gradient-to-br from-background via-background to-slate-950/[0.05] hover:border-slate-900/55 hover:bg-slate-950/[0.04] dark:border-white/25 dark:to-white/[0.07] dark:hover:border-white/55 dark:hover:bg-white/[0.06]',
        brand === 'generic' &&
          'border-border/80 bg-gradient-to-br from-background to-muted/45 hover:border-foreground/35',
        active &&
          brand === 'stripe' &&
          'border-[#635BFF] bg-[#635BFF]/[0.08] shadow-[0_8px_24px_-16px_rgba(99,91,255,0.9)] ring-2 ring-[#635BFF]/20 hover:border-[#635BFF]',
        active &&
          brand === 'waffo' &&
          'border-slate-900 bg-slate-950/[0.06] shadow-[0_8px_24px_-16px_rgba(15,23,42,0.8)] ring-2 ring-slate-900/15 hover:border-slate-900 dark:border-white dark:bg-white/[0.08] dark:ring-white/15 dark:hover:border-white',
        active &&
          brand === 'generic' &&
          'border-foreground/70 bg-muted/60 ring-2 ring-foreground/10',
        active ? 'disabled:opacity-100' : paymentBusy && 'disabled:opacity-60',
        belowMinimum &&
          'border-muted bg-muted/35 text-muted-foreground shadow-none ring-0 hover:translate-y-0 hover:border-muted hover:bg-muted/35 hover:shadow-none disabled:opacity-100'
      )}
    >
      <span
        aria-hidden='true'
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-transform duration-200 group-hover:scale-[1.03]',
          brand === 'stripe' &&
            'border-[#635BFF] bg-[#635BFF] shadow-[0_5px_14px_-8px_rgba(99,91,255,0.95)]',
          brand === 'waffo' &&
            'border-slate-900/20 bg-slate-950 dark:border-white/20 dark:bg-white',
          brand === 'generic' && 'bg-background border-border'
        )}
      >
        <RelayBasesPaymentBrandIcon brand={brand} method={method} />
      </span>

      <span className='flex min-w-0 flex-1 flex-col items-start gap-1.5'>
        <span className='text-foreground w-full text-sm font-semibold break-words sm:text-[15px]'>
          {method.name}
        </span>
        <span
          id={descriptionId}
          className='text-muted-foreground flex max-w-full items-start gap-1.5 text-xs leading-[1.35rem] font-normal'
        >
          {channelHint === 'alipay' && (
            <SiAlipay
              aria-hidden='true'
              className='mt-0.5 size-3.5 shrink-0 text-[#1677FF]'
            />
          )}
          {channelHint === 'wechat' && (
            <SiWechat
              aria-hidden='true'
              className='mt-0.5 size-3.5 shrink-0 text-[#07C160]'
            />
          )}
          <span>{description}</span>
        </span>
      </span>

      <span
        aria-hidden='true'
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors',
          !active && 'border-border/80 bg-background/80 text-muted-foreground',
          active &&
            brand === 'stripe' &&
            'border-[#635BFF] bg-[#635BFF] text-white',
          active &&
            brand === 'waffo' &&
            'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950',
          active &&
            brand === 'generic' &&
            'border-transparent bg-foreground text-background'
        )}
      >
        {trailingIcon}
      </span>
    </Button>
  )
}

interface RelayBasesPaymentMethodGridProps {
  methods: PaymentMethod[]
  baseMinimum: number
  topupAmount: number
  paymentLoading: string | null
  selectedPaymentType?: string | null
  onSelect: (method: PaymentMethod) => void
}

export function RelayBasesPaymentMethodGrid({
  methods,
  baseMinimum,
  topupAmount,
  paymentLoading,
  selectedPaymentType,
  onSelect,
}: RelayBasesPaymentMethodGridProps) {
  const orderedMethods = orderRelayBasesPaymentMethods(methods)

  return (
    <div className={getRelayBasesPaymentGridClass(orderedMethods.length)}>
      {orderedMethods.map((method) => (
        <RelayBasesPaymentMethodCard
          key={`${method.type}-${method.name}`}
          method={method}
          minimum={Math.max(method.min_topup ?? 0, baseMinimum)}
          topupAmount={topupAmount}
          loading={paymentLoading === method.type}
          selected={selectedPaymentType === method.type}
          paymentBusy={paymentLoading !== null}
          onSelect={() => onSelect(method)}
        />
      ))}
    </div>
  )
}
