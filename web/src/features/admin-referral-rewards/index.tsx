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
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PartnerAdmin } from '@/features/partner-rewards/admin'
import { RELAYBASES_I18N_NAMESPACE } from '@/features/relaybases/i18n/manifest'

import { AdminReferralRewardsTable } from './components/admin-referral-rewards-table'

export function AdminReferralRewards() {
  const { t } = useTranslation()
  const { t: relayBasesT } = useTranslation(RELAYBASES_I18N_NAMESPACE)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Referrals')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Tabs defaultValue='standard'>
          <TabsList>
            <TabsTrigger value='standard'>{t('Referral Rewards')}</TabsTrigger>
            <TabsTrigger value='partners'>
              {relayBasesT('partner.admin.tab')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value='standard' className='mt-4'>
            <AdminReferralRewardsTable />
          </TabsContent>
          <TabsContent value='partners' className='mt-4'>
            <PartnerAdmin />
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
