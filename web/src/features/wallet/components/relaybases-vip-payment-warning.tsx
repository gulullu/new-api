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
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { BadgePercent, ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

import { RELAYBASES_SUPPORT_URL } from '../relaybases-vip-payment-warning-policy'

export function RelayBasesVipPaymentNotice() {
  const { t } = useTranslation()

  return (
    <div
      role='note'
      aria-label={t('VIP discount')}
      data-relaybases-vip-payment-warning
      className='border-primary/20 bg-primary/5 min-w-0 rounded-lg border px-3 py-2.5'
    >
      <div className='flex min-w-0 items-start gap-3'>
        <div className='bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full'>
          <BadgePercent aria-hidden='true' className='size-4' />
        </div>
        <div className='min-w-0 space-y-0.5'>
          <p className='text-sm font-semibold break-words whitespace-normal'>
            {t('VIP discount')}
          </p>
          <p className='text-muted-foreground text-xs leading-5 break-words whitespace-normal'>
            {t(
              'This payment does not include your VIP discount. Contact support for VIP pricing.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

interface RelayBasesVipPaymentCloseProps {
  processing: boolean
}

export function RelayBasesVipPaymentClose(
  props: RelayBasesVipPaymentCloseProps
) {
  const { t } = useTranslation()

  return (
    <AlertDialogCancel
      variant='ghost'
      size='icon-sm'
      disabled={props.processing}
      aria-label={t('Close')}
      data-relaybases-vip-close
      className='absolute top-2 right-2 z-10'
    >
      <HugeiconsIcon aria-hidden='true' icon={Cancel01Icon} strokeWidth={2} />
      <span className='sr-only'>{t('Close')}</span>
    </AlertDialogCancel>
  )
}

interface RelayBasesVipPaymentActionsProps {
  processing: boolean
  onContactSupport: () => void
  onContinue: () => void
}

export function RelayBasesVipPaymentActions(
  props: RelayBasesVipPaymentActionsProps
) {
  const { t } = useTranslation()

  return (
    <AlertDialogFooter className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
      <Button
        render={
          <a
            href={RELAYBASES_SUPPORT_URL}
            target='_blank'
            rel='noopener noreferrer'
          />
        }
        aria-disabled={props.processing}
        tabIndex={props.processing ? -1 : undefined}
        data-relaybases-vip-contact-support
        className='h-auto min-h-9 py-2 text-center break-words whitespace-normal'
        onClick={(event) => {
          if (props.processing) {
            event.preventDefault()
            return
          }
          props.onContactSupport()
        }}
      >
        {t('Contact support')}
        <ExternalLink aria-hidden='true' data-icon='inline-end' />
      </Button>
      <AlertDialogAction
        variant='outline'
        disabled={props.processing}
        data-relaybases-vip-continue
        className='h-auto min-h-9 py-2 text-center break-words whitespace-normal'
        onClick={props.onContinue}
      >
        {props.processing && (
          <Loader2 aria-hidden='true' className='animate-spin' />
        )}
        {t('Continue payment')}
      </AlertDialogAction>
    </AlertDialogFooter>
  )
}
