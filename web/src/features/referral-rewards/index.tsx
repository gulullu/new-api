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
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { AffiliateRewardsCard } from '@/features/wallet/components/affiliate-rewards-card'
import { TransferDialog } from '@/features/wallet/components/dialogs/transfer-dialog'
import { useAffiliate, useTopupInfo } from '@/features/wallet/hooks'
import type { UserWalletData } from '@/features/wallet/types'
import { getSelf } from '@/lib/api'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'

import { ReferralRewardsTable } from './components/referral-rewards-table'

export function ReferralRewards() {
  const { t } = useTranslation()
  const authUser = useAuthStore((state) => state.auth.user)
  const setAuthUser = useAuthStore((state) => state.auth.setUser)
  const [user, setUser] = useState<UserWalletData | null>(() =>
    authUser
      ? {
          id: authUser.id,
          username: authUser.username,
          quota: authUser.quota ?? 0,
          used_quota: authUser.used_quota ?? 0,
          request_count: authUser.request_count ?? 0,
          aff_quota: authUser.aff_quota ?? 0,
          aff_history_quota: authUser.aff_history_quota ?? 0,
          aff_count: authUser.aff_count ?? 0,
          group: authUser.group ?? 'default',
        }
      : null
  )
  const [userLoading, setUserLoading] = useState(!authUser)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const { topupInfo, loading: topupLoading } = useTopupInfo()
  const {
    affiliateLink,
    loading: affiliateLoading,
    transferQuota,
    transferring,
  } = useAffiliate()

  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (!response.success || !response.data) return

      const refreshedUser = response.data as AuthUser
      setAuthUser(refreshedUser)
      setUser({
        id: refreshedUser.id,
        username: refreshedUser.username,
        quota: refreshedUser.quota ?? 0,
        used_quota: refreshedUser.used_quota ?? 0,
        request_count: refreshedUser.request_count ?? 0,
        aff_quota: refreshedUser.aff_quota ?? 0,
        aff_history_quota: refreshedUser.aff_history_quota ?? 0,
        aff_count: refreshedUser.aff_count ?? 0,
        group: refreshedUser.group ?? 'default',
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [setAuthUser])

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) await fetchUser()
    return success
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Referral Rewards')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            <AffiliateRewardsCard
              user={user}
              affiliateLink={affiliateLink}
              onTransfer={() => setTransferDialogOpen(true)}
              rewardPercent={topupInfo?.referral_reward_percent ?? 3}
              qualifiedReferrals={topupInfo?.qualified_referrals ?? 0}
              complianceConfirmed={
                topupInfo?.payment_compliance_confirmed !== false
              }
              loading={userLoading || affiliateLoading || topupLoading}
            />

            <ReferralRewardsTable />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />
    </>
  )
}
