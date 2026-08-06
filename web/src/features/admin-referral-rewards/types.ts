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
export type AdminReferralRewardStatus =
  | 'awarded'
  | 'withheld'
  | 'reversed'
  | (string & {})

export interface AdminReferralReward {
  id: number
  inviter_id: number
  inviter_label: string
  invitee_id: number
  invitee_label: string
  payment_provider: string
  paid_amount: string
  paid_currency: string
  rate_basis_points: number
  reward_quota: number
  reversed_quota: number
  status: AdminReferralRewardStatus
  reversal_reason?: string
  reversed_at?: number
  created_at: number
}

export interface AdminReferralRewardSummary {
  total_records: number
  awarded_records: number
  withheld_records: number
  reversed_records: number
  awarded_reward_quota: number
  active_reward_quota: number
  reversed_reward_quota: number
  unique_inviters: number
  unique_invitees: number
}

export interface GetAdminReferralRewardsParams {
  page?: number
  page_size?: number
  keyword?: string
  status?: string
  provider?: string
}

export interface GetAdminReferralRewardsResponse {
  success: boolean
  message?: string
  data?: {
    items: AdminReferralReward[]
    total: number
    page: number
    page_size: number
    summary: AdminReferralRewardSummary
  }
}
