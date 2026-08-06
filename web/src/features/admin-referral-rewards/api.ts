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
import { api } from '@/lib/api'

import type {
  GetAdminReferralRewardsParams,
  GetAdminReferralRewardsResponse,
} from './types'

export async function getAdminReferralRewards(
  params: GetAdminReferralRewardsParams = {}
): Promise<GetAdminReferralRewardsResponse> {
  const query = new URLSearchParams()
  query.set('p', String(params.page ?? 1))
  query.set('page_size', String(params.page_size ?? 20))
  if (params.keyword?.trim()) query.set('keyword', params.keyword.trim())
  if (params.status) query.set('status', params.status)
  if (params.provider) query.set('provider', params.provider)

  const response = await api.get(
    `/api/user/referral-rewards/admin?${query.toString()}`
  )
  return response.data
}
