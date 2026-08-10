import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import { RELAYBASES_I18N_NAMESPACE } from '@/features/relaybases/i18n/manifest'

import { createPartnerWithdrawal, transferPartnerBalance } from '../api'
import { microsFromUsd, usdFromMicros } from '../lib'
import type { PartnerWithdrawalMethod } from '../types'

interface PartnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableUsdMicros: number
  onComplete: () => Promise<void> | void
}

export function PartnerTransferDialog({
  open,
  onOpenChange,
  availableUsdMicros,
  onComplete,
}: PartnerDialogProps) {
  const { t } = useTranslation(RELAYBASES_I18N_NAMESPACE)
  const [amount, setAmount] = useState('')
  const [requestId, setRequestId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const micros = microsFromUsd(amount)

  const submit = async () => {
    if (!micros || micros > availableUsdMicros) return
    setSubmitting(true)
    try {
      const stableRequestId = requestId || crypto.randomUUID()
      if (!requestId) setRequestId(stableRequestId)
      const response = await transferPartnerBalance(micros, stableRequestId)
      if (!response.success) throw new Error(response.message)
      toast.success(t('partner.transfer.success'))
      setAmount('')
      setRequestId('')
      onOpenChange(false)
      await onComplete()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('partner.errors.request')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('partner.transfer.title')}
      description={t('partner.transfer.description')}
      showCloseButton={!submitting}
      contentClassName='sm:max-w-md'
      footer={
        <Button
          onClick={submit}
          disabled={!micros || micros > availableUsdMicros || submitting}
        >
          {submitting ? <Loader2 className='animate-spin' /> : null}
          {t('partner.transfer.confirm')}
        </Button>
      }
    >
      <div className='space-y-2'>
        <div className='flex items-center justify-between gap-3'>
          <Label htmlFor='partner-transfer-amount'>
            {t('partner.common.amountUsd')}
          </Label>
          <span className='text-muted-foreground text-xs'>
            {t('partner.common.available')}: {usdFromMicros(availableUsdMicros)}
          </span>
        </div>
        <Input
          id='partner-transfer-amount'
          inputMode='decimal'
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value)
            setRequestId('')
          }}
          placeholder='20.00'
          disabled={submitting}
        />
      </div>
    </Dialog>
  )
}

export function PartnerWithdrawalDialog({
  open,
  onOpenChange,
  availableUsdMicros,
  onComplete,
}: PartnerDialogProps) {
  const { t } = useTranslation(RELAYBASES_I18N_NAMESPACE)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PartnerWithdrawalMethod>('alipay')
  const [alipayAccount, setAlipayAccount] = useState('')
  const [alipayName, setAlipayName] = useState('')
  const [bscAddress, setBscAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const micros = microsFromUsd(amount)

  const reset = () => {
    setAmount('')
    setAlipayAccount('')
    setAlipayName('')
    setBscAddress('')
  }

  const verification = useSecureVerification({
    successMessage: t('partner.withdrawal.success'),
    onSuccess: async () => {
      reset()
      setSubmitting(false)
      onOpenChange(false)
      await onComplete()
    },
    onError: () => setSubmitting(false),
  })

  const submit = async () => {
    if (!micros || micros > availableUsdMicros || micros < 20_000_000) return
    setSubmitting(true)
    try {
      const result = await verification.withVerification(
        async (proof) => {
          const response = await createPartnerWithdrawal(
            {
              amount_usd_micros: micros,
              method,
              alipay_account: method === 'alipay' ? alipayAccount : undefined,
              alipay_name: method === 'alipay' ? alipayName : undefined,
              bsc_address: method === 'bsc_usdt' ? bscAddress : undefined,
            },
            proof
          )
          if (!response.success) throw new Error(response.message)
          return response.data
        },
        {
          scope: 'partner.withdrawal.create',
          title: t('partner.withdrawal.verifyTitle'),
          description: t('partner.withdrawal.verifyDescription'),
        }
      )
      if (result) {
        reset()
        setSubmitting(false)
        onOpenChange(false)
        await onComplete()
      } else if (!verification.open) {
        setSubmitting(false)
      }
    } catch (error) {
      setSubmitting(false)
      toast.error(
        error instanceof Error ? error.message : t('partner.errors.request')
      )
    }
  }

  const destinationValid =
    method === 'alipay'
      ? alipayAccount.trim().length >= 5 && alipayName.trim().length >= 2
      : /^0x[0-9a-fA-F]{40}$/.test(bscAddress.trim())

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('partner.withdrawal.title')}
        description={t('partner.withdrawal.description')}
        showCloseButton={!submitting}
        contentClassName='sm:max-w-lg'
        footer={
          <Button
            onClick={submit}
            disabled={
              !micros ||
              micros < 20_000_000 ||
              micros > availableUsdMicros ||
              !destinationValid ||
              submitting
            }
          >
            {submitting ? <Loader2 className='animate-spin' /> : null}
            {t('partner.withdrawal.submit')}
          </Button>
        }
      >
        <div className='space-y-4'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between gap-3'>
              <Label htmlFor='partner-withdrawal-amount'>
                {t('partner.common.amountUsd')}
              </Label>
              <span className='text-muted-foreground text-xs'>
                {t('partner.common.available')}:{' '}
                {usdFromMicros(availableUsdMicros)}
              </span>
            </div>
            <Input
              id='partner-withdrawal-amount'
              inputMode='decimal'
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder='20.00'
              disabled={submitting}
            />
            <p className='text-muted-foreground text-xs'>
              {t('partner.withdrawal.minimum')}
            </p>
          </div>

          <div className='space-y-2'>
            <Label>{t('partner.withdrawal.method')}</Label>
            <Select
              value={method}
              onValueChange={(value) =>
                setMethod(value as PartnerWithdrawalMethod)
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue>
                  {method === 'alipay'
                    ? t('partner.withdrawal.alipay')
                    : t('partner.withdrawal.bsc')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='alipay'>
                  {t('partner.withdrawal.alipay')}
                </SelectItem>
                <SelectItem value='bsc_usdt'>
                  {t('partner.withdrawal.bsc')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === 'alipay' ? (
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='partner-alipay-account'>
                  {t('partner.withdrawal.alipayAccount')}
                </Label>
                <Input
                  id='partner-alipay-account'
                  value={alipayAccount}
                  onChange={(event) => setAlipayAccount(event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='partner-alipay-name'>
                  {t('partner.withdrawal.alipayName')}
                </Label>
                <Input
                  id='partner-alipay-name'
                  value={alipayName}
                  onChange={(event) => setAlipayName(event.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className='space-y-2'>
              <Label htmlFor='partner-bsc-address'>
                {t('partner.withdrawal.bscAddress')}
              </Label>
              <Input
                id='partner-bsc-address'
                value={bscAddress}
                onChange={(event) => setBscAddress(event.target.value)}
                placeholder='0x…'
                className='font-mono'
              />
              <p className='text-muted-foreground text-xs'>
                {t('partner.withdrawal.bscWarning')}
              </p>
            </div>
          )}
        </div>
      </Dialog>

      <SecureVerificationDialog
        open={verification.open}
        onOpenChange={verification.setOpen}
        methods={verification.methods}
        state={verification.state}
        onVerify={async (method, code) => {
          await verification.executeVerification(method, code)
        }}
        onCancel={verification.cancel}
        onCodeChange={verification.setCode}
        onMethodChange={verification.switchMethod}
      />
    </>
  )
}
