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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SiAlipay, SiWechat } from 'react-icons/si'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { RELAYBASES_I18N_NAMESPACE } from '@/features/relaybases/i18n/manifest'
import {
  formatRelayBasesCredits,
  formatRelayBasesUsd,
} from '@/features/relaybases/wallet'
import {
  getRelayBasesPaymentDisplayKind,
  isRelayBasesChineseLanguage,
} from '@/features/relaybases/wallet/policy'

import { DEFAULT_DISCOUNT_RATE, PAYMENT_TYPES } from '../../constants'
import { getPaymentIcon } from '../../lib'
import type { PaymentMethod } from '../../types'
import {
  RelayBasesVipPaymentActions,
  RelayBasesVipPaymentClose,
  RelayBasesVipPaymentNotice,
} from '../relaybases-vip-payment-warning'

interface PaymentConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  topupAmount: number
  paymentAmount: number
  paymentMethod: PaymentMethod | undefined
  calculating: boolean
  processing: boolean
  discountRate?: number
  showRelayBasesVipPaymentWarning?: boolean
}

function formatApproximateCny(topupAmount: number, discountRate: number) {
  const amount = topupAmount * discountRate
  if (!Number.isFinite(amount) || amount <= 0) return null
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function getPaymentDisplayType(
  displayKind: ReturnType<typeof getRelayBasesPaymentDisplayKind>,
  paymentType: string | undefined
): string | undefined {
  if (displayKind === 'alipay') return 'alipay'
  if (displayKind === 'wechat') return 'wxpay'
  return paymentType
}

function getPaymentDisplayName(
  paymentMethod: PaymentMethod | undefined,
  displayKind: ReturnType<typeof getRelayBasesPaymentDisplayKind>,
  t: (key: string) => string
) {
  if (!paymentMethod) return undefined
  if (displayKind === 'alipay') return t('Alipay')
  if (displayKind === 'wechat') return t('WeChat Pay')
  return paymentMethod.name
}

function getPaymentDisplayIcon(
  displayKind: ReturnType<typeof getRelayBasesPaymentDisplayKind>,
  displayType: string | undefined,
  icon: string | undefined,
  displayName: string | undefined
) {
  if (displayKind === 'alipay') {
    return <SiAlipay aria-hidden='true' className='h-4 w-4' />
  }
  if (displayKind === 'wechat') {
    return <SiWechat aria-hidden='true' className='h-4 w-4' />
  }
  return getPaymentIcon(displayType, 'h-4 w-4', icon, displayName)
}

function getLegacyWaffoIcon(
  paymentMethod: PaymentMethod | undefined,
  displayKind: ReturnType<typeof getRelayBasesPaymentDisplayKind>,
  displayName: string | undefined
) {
  const icon = paymentMethod?.icon?.trim()
  if (
    displayKind === null &&
    paymentMethod?.type === PAYMENT_TYPES.WAFFO &&
    icon &&
    /^\/(?!\/)/.test(icon)
  ) {
    return (
      <img
        src={icon}
        alt={displayName || paymentMethod.name}
        title={displayName || paymentMethod.name}
        className='h-4 w-4 object-contain'
        loading='lazy'
        decoding='async'
        referrerPolicy='no-referrer'
      />
    )
  }
  return null
}

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  topupAmount,
  paymentAmount,
  paymentMethod,
  calculating,
  processing,
  discountRate = DEFAULT_DISCOUNT_RATE,
  showRelayBasesVipPaymentWarning = false,
}: PaymentConfirmDialogProps) {
  const { t } = useTranslation()
  const { i18n: relayBasesI18n, t: tRelayBases } = useTranslation(
    RELAYBASES_I18N_NAMESPACE
  )
  const relayBasesLanguage =
    relayBasesI18n.resolvedLanguage ?? relayBasesI18n.language
  const paymentDisplayKind = getRelayBasesPaymentDisplayKind(
    paymentMethod?.type ?? '',
    relayBasesLanguage
  )
  const paymentDisplayName = getPaymentDisplayName(
    paymentMethod,
    paymentDisplayKind,
    t
  )
  const paymentDisplayType = getPaymentDisplayType(
    paymentDisplayKind,
    paymentMethod?.type
  )
  const approximateCny =
    !calculating &&
    isRelayBasesChineseLanguage(relayBasesLanguage) &&
    Number.isFinite(topupAmount) &&
    topupAmount > 0 &&
    Number.isFinite(discountRate) &&
    discountRate > 0
      ? formatApproximateCny(topupAmount, discountRate)
      : null
  const hasDiscount = discountRate > 0 && discountRate < 1 && paymentAmount > 0
  const originalAmount = hasDiscount ? paymentAmount / discountRate : 0
  const discountAmount = hasDiscount ? originalAmount - paymentAmount : 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='grid max-h-[calc(100dvh-1.5rem)] grid-rows-[minmax(0,1fr)_auto] overflow-hidden max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'>
        {showRelayBasesVipPaymentWarning && (
          <RelayBasesVipPaymentClose processing={processing} />
        )}
        <div
          data-payment-confirm-scroll
          className='min-h-0 overflow-y-auto pr-1'
        >
          <AlertDialogHeader
            className={showRelayBasesVipPaymentWarning ? 'pr-8' : undefined}
          >
            <AlertDialogTitle className='text-xl font-semibold'>
              {t('Confirm Payment')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('Review your payment details')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className='space-y-3 py-3 sm:space-y-4 sm:py-4'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('Topup Amount')}
              </span>
              <span className='text-lg font-semibold'>
                {formatRelayBasesCredits(topupAmount, relayBasesLanguage)}
              </span>
            </div>

            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('You Pay')}
              </span>
              {calculating ? (
                <Skeleton className='h-6 w-24' />
              ) : (
                <div className='flex flex-col items-end gap-0.5'>
                  <div className='flex items-baseline gap-2'>
                    <span className='text-2xl font-semibold'>
                      {formatRelayBasesUsd(paymentAmount, relayBasesLanguage)}
                    </span>
                    {hasDiscount && (
                      <span className='text-muted-foreground text-sm line-through'>
                        {formatRelayBasesUsd(
                          originalAmount,
                          relayBasesLanguage
                        )}
                      </span>
                    )}
                  </div>
                  {approximateCny && (
                    <span
                      data-payment-approx-cny
                      className='text-muted-foreground text-xs font-normal'
                    >
                      {tRelayBases('wallet.payment.approxCny', {
                        amount: approximateCny,
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>

            {hasDiscount && !calculating && (
              <div className='bg-muted/50 rounded-lg p-3'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>{t('You save')}</span>
                  <span className='font-semibold text-green-600'>
                    {formatRelayBasesUsd(discountAmount, relayBasesLanguage)}
                  </span>
                </div>
              </div>
            )}

            <div className='border-t pt-4'>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground text-sm'>
                  {t('Payment Method')}
                </span>
                <div className='flex items-center gap-2'>
                  <span title={paymentDisplayName} aria-hidden='true'>
                    {getLegacyWaffoIcon(
                      paymentMethod,
                      paymentDisplayKind,
                      paymentDisplayName
                    ) ??
                      getPaymentDisplayIcon(
                        paymentDisplayKind,
                        paymentDisplayType,
                        paymentDisplayKind === null
                          ? paymentMethod?.icon
                          : undefined,
                        paymentDisplayName
                      )}
                  </span>
                  <span className='font-medium'>{paymentDisplayName}</span>
                </div>
              </div>
            </div>

            {showRelayBasesVipPaymentWarning && <RelayBasesVipPaymentNotice />}
          </div>
        </div>

        {showRelayBasesVipPaymentWarning ? (
          <RelayBasesVipPaymentActions
            processing={processing}
            onContactSupport={() => onOpenChange(false)}
            onContinue={onConfirm}
          />
        ) : (
          <AlertDialogFooter className='grid grid-cols-2 gap-2 sm:flex'>
            <AlertDialogCancel disabled={processing}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm} disabled={processing}>
              {processing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {t('Confirm Payment')}
            </AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
