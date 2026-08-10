export type PartnerWithdrawalMethod = 'alipay' | 'bsc_usdt'
export type PartnerWithdrawalStatus = 'pending' | 'paid' | 'rejected'

export interface PartnerWalletSummary {
  eligible: boolean
  commission_basis_points: number
  hold_seconds: number
  minimum_withdrawal_usd_micros: number
  minimum_transfer_usd_micros: number
  pending_usd_micros: number
  available_usd_micros: number
  locked_usd_micros: number
  debt_usd_micros: number
  lifetime_earned_usd_micros: number
  lifetime_reversed_usd_micros: number
  lifetime_transferred_usd_micros: number
  lifetime_withdrawn_usd_micros: number
  active_withdrawal_id: number
}

export interface PartnerCommission {
  id: number
  invitee_label: string
  payment_provider: string
  paid_amount: string
  paid_currency: string
  program: 'partner'
  commission_usd_micros: number
  rate_basis_points: number
  partner_settlement: 'pending' | 'available' | 'reversed'
  partner_available_at: number
  status: 'awarded' | 'reversed'
  created_at: number
}

export interface PartnerWithdrawal {
  id: number
  user_id: number
  amount_usd_micros: number
  method: PartnerWithdrawalMethod
  destination_masked: string
  status: PartnerWithdrawalStatus
  payout_reference?: string
  admin_note?: string
  requested_at: number
  reviewed_at: number
}

export interface PartnerProfile {
  user_id: number
  username: string
  email: string
  commission_basis_points: number
  effective_at: number
  updated_at: number
}

export interface PartnerWithdrawalAdmin extends PartnerWithdrawal {
  username: string
  email: string
}

export interface PartnerDestination {
  alipay_account?: string
  alipay_name?: string
  bsc_address?: string
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
