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
export type ReferralRewardStatus =
  | 'awarded'
  | 'reversed'
  | 'withheld'
  | (string & {})

/**
 * Privacy-safe referral reward record returned to the inviter.
 *
 * The API intentionally exposes only a masked invitee label. Internal user,
 * top-up, trade, gateway event, and gateway payment identifiers must never be
 * added to this browser-facing contract.
 */
export interface ReferralReward {
  id: number
  invitee_label: string
  payment_provider: string
  paid_amount: string
  paid_currency: string
  reward_quota: number
  rate_basis_points: number
  status: ReferralRewardStatus
  created_at: number
}

export interface ReferralRewardsPage {
  items: ReferralReward[]
  total: number
  page: number
  page_size: number
}

export interface GetReferralRewardsParams {
  page?: number
  page_size?: number
}

export interface GetReferralRewardsResponse {
  success: boolean
  message?: string
  data?: ReferralRewardsPage
}
