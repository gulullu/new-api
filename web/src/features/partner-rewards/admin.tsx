import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Eye,
  Loader2,
  Search,
  UserRoundCog,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import { RELAYBASES_I18N_NAMESPACE } from '@/features/relaybases/i18n/manifest'

import {
  configurePartner,
  getAdminPartnerWithdrawals,
  getPartnerProfiles,
  revealPartnerDestination,
  reviewPartnerWithdrawal,
} from './api'
import {
  partnerDate,
  partnerListCount,
  percentFromBasisPoints,
  usdFromMicros,
} from './lib'
import type { PartnerDestination, PartnerWithdrawalAdmin } from './types'

export function PartnerAdmin() {
  const { t } = useTranslation(RELAYBASES_I18N_NAMESPACE)
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [profilePage, setProfilePage] = useState(1)
  const [withdrawalPage, setWithdrawalPage] = useState(1)
  const [userId, setUserId] = useState('')
  const [rate, setRate] = useState('30')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<PartnerWithdrawalAdmin | null>(null)
  const [destination, setDestination] = useState<PartnerDestination | null>(
    null
  )
  const [payoutReference, setPayoutReference] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [reviewAction, setReviewAction] = useState<'paid' | 'reject' | null>(
    null
  )

  const profiles = useQuery({
    queryKey: ['partner-admin-profiles', profilePage, keyword],
    queryFn: () => getPartnerProfiles(profilePage, 10, keyword),
  })
  const withdrawals = useQuery({
    queryKey: ['partner-admin-withdrawals', withdrawalPage, keyword],
    queryFn: () => getAdminPartnerWithdrawals(withdrawalPage, 10, '', keyword),
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['partner-admin-profiles'] }),
      queryClient.invalidateQueries({
        queryKey: ['partner-admin-withdrawals'],
      }),
    ])
  }

  const revealVerification = useSecureVerification()
  const reviewVerification = useSecureVerification({
    onSuccess: async () => {
      toast.success(t('partner.admin.actionComplete'))
      setSelected(null)
      setDestination(null)
      setReviewAction(null)
      setPayoutReference('')
      setAdminNote('')
      await refresh()
    },
  })

  const saveProfile = async () => {
    const parsedUserId = Number(userId)
    const parsedRate = Number(rate)
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) return
    if (!Number.isFinite(parsedRate) || parsedRate <= 0 || parsedRate > 100) {
      return
    }
    setSaving(true)
    try {
      const response = await configurePartner(
        parsedUserId,
        Math.round(parsedRate * 100)
      )
      if (!response.success) throw new Error(response.message)
      toast.success(t('partner.admin.partnerSaved'))
      setUserId('')
      setRate('30')
      await refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('partner.errors.request')
      )
    } finally {
      setSaving(false)
    }
  }

  const reveal = async (item: PartnerWithdrawalAdmin) => {
    setSelected(item)
    await revealVerification.withVerification(
      async (proof) => {
        const response = await revealPartnerDestination(item.id, proof)
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        setDestination(response.data)
        return response.data
      },
      {
        scope: 'partner.withdrawal.reveal',
        title: t('partner.admin.verifyRevealTitle'),
        description: t('partner.admin.verifyRevealDescription'),
      }
    )
  }

  const review = async () => {
    if (!selected || !reviewAction) return
    await reviewVerification.withVerification(
      async (proof) => {
        const response = await reviewPartnerWithdrawal(
          selected.id,
          reviewAction,
          {
            payout_reference:
              reviewAction === 'paid' ? payoutReference : undefined,
            admin_note: adminNote,
          },
          proof
        )
        if (!response.success) throw new Error(response.message)
        return response.data
      },
      {
        scope: 'partner.withdrawal.review',
        title: t('partner.admin.verifyReviewTitle'),
        description: t('partner.admin.verifyReviewDescription'),
      }
    )
  }

  return (
    <div className='space-y-5'>
      <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]'>
        <div className='rounded-xl border p-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h3 className='font-semibold'>{t('partner.admin.profiles')}</h3>
              <p className='text-muted-foreground text-sm'>
                {t('partner.admin.profilesDescription')}
              </p>
            </div>
            <div className='relative'>
              <Search className='text-muted-foreground absolute top-2 left-2.5 size-4' />
              <Input
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setProfilePage(1)
                  setWithdrawalPage(1)
                }}
                className='pl-8'
                placeholder={t('partner.admin.search')}
              />
            </div>
          </div>
          <div className='mt-4 divide-y rounded-lg border'>
            {(profiles.data?.data?.items ?? []).map((profile) => (
              <div
                key={profile.user_id}
                className='flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between'
              >
                <div className='min-w-0'>
                  <div className='font-medium'>
                    #{profile.user_id} · {profile.username}
                  </div>
                  <div className='text-muted-foreground truncate text-xs'>
                    {profile.email}
                  </div>
                </div>
                <Badge variant='outline'>
                  {percentFromBasisPoints(profile.commission_basis_points)}
                </Badge>
              </div>
            ))}
            {!profiles.isLoading &&
            partnerListCount(profiles.data?.data?.items) === 0 ? (
              <p className='text-muted-foreground p-6 text-center text-sm'>
                {t('partner.admin.emptyProfiles')}
              </p>
            ) : null}
          </div>
          <div className='mt-3 flex justify-end gap-2'>
            <Button
              size='sm'
              variant='outline'
              disabled={profilePage === 1}
              onClick={() => setProfilePage((page) => page - 1)}
            >
              {t('partner.activity.previous')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={(profiles.data?.data?.total ?? 0) <= profilePage * 10}
              onClick={() => setProfilePage((page) => page + 1)}
            >
              {t('partner.activity.next')}
            </Button>
          </div>
        </div>

        <div className='rounded-xl border p-4'>
          <div className='mb-4 flex items-center gap-2'>
            <UserRoundCog className='text-primary size-5' />
            <div>
              <h3 className='font-semibold'>{t('partner.admin.configure')}</h3>
              <p className='text-muted-foreground text-xs'>
                {t('partner.admin.configureDescription')}
              </p>
            </div>
          </div>
          <div className='space-y-3'>
            <div className='space-y-2'>
              <Label htmlFor='partner-admin-user-id'>
                {t('partner.admin.userId')}
              </Label>
              <Input
                id='partner-admin-user-id'
                inputMode='numeric'
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='partner-admin-rate'>
                {t('partner.admin.rate')}
              </Label>
              <Input
                id='partner-admin-rate'
                inputMode='decimal'
                value={rate}
                onChange={(event) => setRate(event.target.value)}
              />
            </div>
            <Button className='w-full' onClick={saveProfile} disabled={saving}>
              {saving ? <Loader2 className='animate-spin' /> : null}
              {t('partner.admin.save')}
            </Button>
          </div>
        </div>
      </div>

      <div className='rounded-xl border p-4'>
        <div>
          <h3 className='font-semibold'>{t('partner.admin.withdrawals')}</h3>
          <p className='text-muted-foreground text-sm'>
            {t('partner.admin.withdrawalsDescription')}
          </p>
        </div>
        <div className='mt-4 divide-y rounded-lg border'>
          {(withdrawals.data?.data?.items ?? []).map((item) => (
            <div
              key={item.id}
              className='grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center'
            >
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2 font-medium'>
                  #{item.id} · {item.username}
                  <Badge variant='outline'>
                    {t(`partner.withdrawal.status.${item.status}`)}
                  </Badge>
                </div>
                <p className='text-muted-foreground mt-1 truncate text-xs'>
                  {item.destination_masked} · {partnerDate(item.requested_at)}
                </p>
              </div>
              <div className='font-semibold'>
                {usdFromMicros(item.amount_usd_micros)}
              </div>
              <div className='flex flex-wrap gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => reveal(item)}
                >
                  <Eye />
                  {t('partner.admin.reveal')}
                </Button>
                {item.status === 'pending' ? (
                  <>
                    <Button
                      size='sm'
                      onClick={() => {
                        setSelected(item)
                        setReviewAction('paid')
                      }}
                    >
                      <CheckCircle2 />
                      {t('partner.admin.markPaid')}
                    </Button>
                    <Button
                      size='sm'
                      variant='destructive'
                      onClick={() => {
                        setSelected(item)
                        setReviewAction('reject')
                      }}
                    >
                      <X />
                      {t('partner.admin.reject')}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
          {!withdrawals.isLoading &&
          partnerListCount(withdrawals.data?.data?.items) === 0 ? (
            <p className='text-muted-foreground p-6 text-center text-sm'>
              {t('partner.admin.emptyWithdrawals')}
            </p>
          ) : null}
        </div>
        <div className='mt-3 flex justify-end gap-2'>
          <Button
            size='sm'
            variant='outline'
            disabled={withdrawalPage === 1}
            onClick={() => setWithdrawalPage((page) => page - 1)}
          >
            {t('partner.activity.previous')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            disabled={
              (withdrawals.data?.data?.total ?? 0) <= withdrawalPage * 10
            }
            onClick={() => setWithdrawalPage((page) => page + 1)}
          >
            {t('partner.activity.next')}
          </Button>
        </div>
      </div>

      <Dialog
        open={Boolean(selected && destination)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setDestination(null)
          }
        }}
        title={t('partner.admin.destination')}
        showCloseButton
        contentClassName='sm:max-w-md'
      >
        <div className='rounded-lg border p-3 font-mono text-sm break-all'>
          {destination?.bsc_address ??
            `${destination?.alipay_name ?? ''} · ${destination?.alipay_account ?? ''}`}
        </div>
      </Dialog>

      <Dialog
        open={Boolean(selected && reviewAction)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setReviewAction(null)
          }
        }}
        title={
          reviewAction === 'paid'
            ? t('partner.admin.markPaid')
            : t('partner.admin.reject')
        }
        description={t('partner.admin.reviewDescription')}
        showCloseButton={!reviewVerification.state.loading}
        contentClassName='sm:max-w-md'
        footer={
          <Button
            variant={reviewAction === 'reject' ? 'destructive' : 'default'}
            onClick={review}
            disabled={
              reviewVerification.state.loading ||
              (reviewAction === 'paid' && !payoutReference.trim()) ||
              (reviewAction === 'reject' && !adminNote.trim())
            }
          >
            {reviewVerification.state.loading ? (
              <Loader2 className='animate-spin' />
            ) : null}
            {t('partner.admin.confirm')}
          </Button>
        }
      >
        <div className='space-y-3'>
          {reviewAction === 'paid' ? (
            <div className='space-y-2'>
              <Label htmlFor='partner-payout-reference'>
                {selected?.method === 'bsc_usdt'
                  ? t('partner.admin.txHash')
                  : t('partner.admin.payoutReference')}
              </Label>
              <Input
                id='partner-payout-reference'
                value={payoutReference}
                onChange={(event) => setPayoutReference(event.target.value)}
                className={selected?.method === 'bsc_usdt' ? 'font-mono' : ''}
              />
            </div>
          ) : null}
          <div className='space-y-2'>
            <Label htmlFor='partner-admin-note'>
              {t('partner.admin.note')}
            </Label>
            <Input
              id='partner-admin-note'
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
            />
          </div>
        </div>
      </Dialog>

      <SecureVerificationDialog
        open={revealVerification.open}
        onOpenChange={revealVerification.setOpen}
        methods={revealVerification.methods}
        state={revealVerification.state}
        onVerify={async (method, code) => {
          await revealVerification.executeVerification(method, code)
        }}
        onCancel={revealVerification.cancel}
        onCodeChange={revealVerification.setCode}
        onMethodChange={revealVerification.switchMethod}
      />
      <SecureVerificationDialog
        open={reviewVerification.open}
        onOpenChange={reviewVerification.setOpen}
        methods={reviewVerification.methods}
        state={reviewVerification.state}
        onVerify={async (method, code) => {
          await reviewVerification.executeVerification(method, code)
        }}
        onCancel={reviewVerification.cancel}
        onCodeChange={reviewVerification.setCode}
        onMethodChange={reviewVerification.switchMethod}
      />
    </div>
  )
}
