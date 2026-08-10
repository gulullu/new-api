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
import { ChevronRight, Loader2 } from 'lucide-react'
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
  getRelayBasesPaymentMethodInteractionKey,
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
    return <SiStripe aria-hidden='true' className='size-7 text-white' />
  }

  if (props.brand === 'waffo') {
    return (
      <>
        <img
          src='/waffo-logo-light.svg'
          alt=''
          aria-hidden='true'
          className='block size-8 object-contain dark:hidden'
        />
        <img
          src='/waffo-logo-dark.svg'
          alt=''
          aria-hidden='true'
          className='hidden size-8 object-contain dark:block'
        />
      </>
    )
  }

  return getPaymentIcon(
    props.method.type,
    'size-7',
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
  const actionLabel = t('wallet.payment.action')
  const brand = getRelayBasesPaymentBrand(method.type)
  const selectedAvailable = !belowMinimum && selected

  return (
    <Button
      type='button'
      variant='outline'
      onClick={onSelect}
      disabled={disabled}
      aria-busy={loading}
      aria-label={
        belowMinimum ? `${accessibleName}. ${description}` : accessibleName
      }
      aria-describedby={descriptionId}
      title={belowMinimum ? description : undefined}
      className={cn(
        'group relative grid h-auto min-h-[104px] w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center justify-start gap-x-3 gap-y-2 overflow-hidden rounded-lg border border-border/80 bg-background px-4 py-4 text-left whitespace-normal shadow-sm shadow-black/[0.025] transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/[0.035] hover:shadow-md hover:shadow-black/[0.045] focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed sm:min-h-[86px] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:py-3.5',
        selectedAvailable && 'border-primary/45 bg-primary/[0.04]',
        loading &&
          'border-primary/55 bg-primary/[0.05] shadow-md shadow-black/[0.04] disabled:opacity-100',
        !loading && paymentBusy && 'disabled:opacity-55',
        belowMinimum &&
          'border-muted bg-muted/35 text-muted-foreground shadow-none ring-0 hover:translate-y-0 hover:border-muted hover:bg-muted/35 hover:shadow-none disabled:opacity-100'
      )}
    >
      <span
        aria-hidden='true'
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-transform duration-200 group-hover:scale-[1.03]',
          brand === 'stripe' &&
            'border-[#635BFF] bg-[#635BFF] shadow-[0_5px_14px_-8px_rgba(99,91,255,0.95)]',
          brand === 'waffo' &&
            'border-border/80 bg-muted/70 dark:border-white/15 dark:bg-white/10',
          brand === 'generic' && 'bg-background border-border'
        )}
      >
        <RelayBasesPaymentBrandIcon brand={brand} method={method} />
      </span>

      <span className='flex min-w-0 flex-col items-start gap-1.5'>
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
              className='mt-0.5 size-[22px] shrink-0 text-[#1677FF]'
            />
          )}
          {channelHint === 'wechat' && (
            <SiWechat
              aria-hidden='true'
              className='mt-0.5 size-[22px] shrink-0 text-[#07C160]'
            />
          )}
          <span>{description}</span>
        </span>
      </span>

      <span
        aria-hidden='true'
        className={cn(
          'col-span-2 inline-flex h-8 w-full shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors sm:col-span-1 sm:w-auto',
          belowMinimum
            ? 'bg-muted text-muted-foreground'
            : 'bg-primary text-primary-foreground group-hover:bg-primary/90',
          loading && 'bg-primary text-primary-foreground'
        )}
      >
        {loading ? (
          <Loader2 className='size-3.5 animate-spin' />
        ) : (
          <>
            <span>{actionLabel}</span>
            <ChevronRight className='size-3.5 transition-transform group-hover:translate-x-0.5' />
          </>
        )}
      </span>
    </Button>
  )
}

interface RelayBasesPaymentMethodGridProps {
  methods: PaymentMethod[]
  baseMinimum: number
  topupAmount: number
  paymentLoading: string | null
  selectedPaymentMethod?: PaymentMethod | null
  onSelect: (method: PaymentMethod) => void
}

export function RelayBasesPaymentMethodGrid({
  methods,
  baseMinimum,
  topupAmount,
  paymentLoading,
  selectedPaymentMethod,
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
          loading={
            paymentLoading === getRelayBasesPaymentMethodInteractionKey(method)
          }
          selected={
            selectedPaymentMethod?.type === method.type &&
            selectedPaymentMethod.name === method.name
          }
          paymentBusy={paymentLoading !== null}
          onSelect={() => onSelect(method)}
        />
      ))}
    </div>
  )
}
