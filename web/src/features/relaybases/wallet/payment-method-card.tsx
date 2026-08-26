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

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { getPaymentIcon } from '../../wallet/lib'
import type { PaymentMethod } from '../../wallet/types'
import {
  getRelayBasesPaymentDisplayKind,
  getRelayBasesPaymentMethodInteractionKey,
} from './policy'

interface RelayBasesPaymentMethodCardProps {
  method: PaymentMethod
  minimum: number
  topupAmount: number
  loading: boolean
  /** Waffo's legacy method catalog uses root-relative image paths. */
  legacyIconSrc?: string
  /** Retained for callers that still pass selection state; official buttons do not act as tabs. */
  selected?: boolean
  paymentBusy: boolean
  onSelect: () => void
}

function getDisplayName(
  method: Pick<PaymentMethod, 'name' | 'type'>,
  displayKind: ReturnType<typeof getRelayBasesPaymentDisplayKind>,
  t: (key: string) => string
): string {
  if (displayKind === 'alipay') return t('Alipay')
  if (displayKind === 'wechat') return t('WeChat Pay')
  return method.name
}

function getDisplayPaymentType(
  method: Pick<PaymentMethod, 'type'>,
  displayKind: ReturnType<typeof getRelayBasesPaymentDisplayKind>
): string {
  if (displayKind === 'alipay') return 'alipay'
  if (displayKind === 'wechat') return 'wxpay'
  return method.type
}

function getLegacyIcon(
  iconSrc: string | undefined,
  name: string,
  className: string
) {
  const value = iconSrc?.trim()
  if (!value) return null
  if (/^\/(?!\/)/.test(value)) {
    return (
      <img
        src={value}
        alt={name}
        title={name}
        className={className}
        style={{ objectFit: 'contain' }}
        loading='lazy'
        decoding='async'
        referrerPolicy='no-referrer'
      />
    )
  }
  return null
}

export function RelayBasesPaymentMethodCard({
  method,
  minimum,
  topupAmount,
  loading,
  legacyIconSrc,
  paymentBusy,
  onSelect,
}: RelayBasesPaymentMethodCardProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const displayKind = getRelayBasesPaymentDisplayKind(method.type, language)
  const displayName = getDisplayName(method, displayKind, t)
  const displayType = getDisplayPaymentType(method, displayKind)
  const belowMinimum = minimum > topupAmount
  const disabled = belowMinimum || paymentBusy
  const disabledReason = belowMinimum
    ? t('Minimum topup amount: {{amount}}', { amount: minimum })
    : undefined
  const disabledLabel = belowMinimum ? `${t('Minimum:')} ${minimum}` : undefined
  const button = (
    <Button
      type='button'
      variant='outline'
      onClick={onSelect}
      disabled={disabled}
      aria-busy={loading}
      title={disabledReason}
      aria-label={
        disabledReason ? `${displayName}. ${disabledReason}` : displayName
      }
      className='min-h-14 w-full min-w-0 justify-start gap-2 rounded-lg px-3 py-2 text-left'
    >
      {loading ? (
        <Loader2 className='h-4 w-4 animate-spin' />
      ) : (
        <span title={displayName} aria-hidden='true'>
          {(displayKind === null
            ? getLegacyIcon(legacyIconSrc, displayName, 'h-4 w-4')
            : null) ??
            getPaymentIcon(
              displayType,
              'h-4 w-4',
              displayKind === null ? method.icon : undefined,
              displayName
            )}
        </span>
      )}
      <span className='flex min-w-0 flex-col items-start gap-0.5'>
        <span className='max-w-full truncate'>{displayName}</span>
        {disabledLabel && (
          <span className='text-muted-foreground max-w-full truncate text-[11px] leading-4 font-normal'>
            {disabledLabel}
          </span>
        )}
      </span>
    </Button>
  )

  return belowMinimum ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className='block w-full'
              tabIndex={0}
              aria-disabled='true'
              aria-label={
                disabledReason
                  ? `${displayName}. ${disabledReason}`
                  : displayName
              }
            >
              {button}
            </span>
          }
        />
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    button
  )
}

interface RelayBasesPaymentMethodGridProps {
  methods: PaymentMethod[]
  baseMinimum: number
  topupAmount: number
  paymentLoading: string | null
  /** Retained for API compatibility; official buttons do not expose selection state. */
  selectedPaymentMethod?: PaymentMethod | null
  onSelect: (method: PaymentMethod) => void
}

export function RelayBasesPaymentMethodGrid({
  methods,
  baseMinimum,
  topupAmount,
  paymentLoading,
  onSelect,
}: RelayBasesPaymentMethodGridProps) {
  const seenKeys = new Map<string, number>()
  const keyedMethods = methods.map((method) => {
    const minimum = Math.max(method.min_topup ?? 0, baseMinimum)
    const interactionKey = getRelayBasesPaymentMethodInteractionKey(method)
    const occurrence = seenKeys.get(interactionKey) ?? 0
    seenKeys.set(interactionKey, occurrence + 1)

    return {
      method,
      minimum,
      interactionKey,
      key: `${interactionKey}-${occurrence}`,
    }
  })

  return (
    <div className='grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-3'>
      {keyedMethods.map(({ method, minimum, interactionKey, key }) => (
        <RelayBasesPaymentMethodCard
          key={key}
          method={method}
          minimum={minimum}
          topupAmount={topupAmount}
          loading={paymentLoading === interactionKey}
          paymentBusy={paymentLoading !== null}
          onSelect={() => onSelect(method)}
        />
      ))}
    </div>
  )
}
