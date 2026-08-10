import { api } from '@/lib/http-client'

import type {
  ApiResponse,
  Paged,
  PartnerCommission,
  PartnerDestination,
  PartnerProfile,
  PartnerWalletSummary,
  PartnerWithdrawal,
  PartnerWithdrawalAdmin,
  PartnerWithdrawalMethod,
} from './types'

const proofHeaders = (proof?: string) =>
  proof ? { 'X-Security-Proof': proof } : undefined

function requireSuccessfulResponse<T>(
  response: ApiResponse<T>
): ApiResponse<T> {
  if (!response.success) {
    throw new Error(response.message || 'Partner request failed')
  }
  return response
}

export async function getPartnerSummary() {
  const response = await api.get<ApiResponse<PartnerWalletSummary>>(
    '/api/partner/summary'
  )
  return requireSuccessfulResponse(response.data)
}

export async function getPartnerCommissions(page = 1, pageSize = 20) {
  const response = await api.get<ApiResponse<Paged<PartnerCommission>>>(
    '/api/partner/commissions',
    { params: { page, page_size: pageSize } }
  )
  return requireSuccessfulResponse(response.data)
}

export async function getPartnerWithdrawals(page = 1, pageSize = 20) {
  const response = await api.get<ApiResponse<Paged<PartnerWithdrawal>>>(
    '/api/partner/withdrawals',
    { params: { page, page_size: pageSize } }
  )
  return requireSuccessfulResponse(response.data)
}

export async function transferPartnerBalance(
  amountUsdMicros: number,
  requestId: string
) {
  const response = await api.post<ApiResponse<{ quota: number }>>(
    '/api/partner/transfer',
    { amount_usd_micros: amountUsdMicros, request_id: requestId }
  )
  return requireSuccessfulResponse(response.data)
}

export async function createPartnerWithdrawal(
  payload: {
    amount_usd_micros: number
    method: PartnerWithdrawalMethod
    alipay_account?: string
    alipay_name?: string
    bsc_address?: string
  },
  proof?: string
) {
  const response = await api.post<ApiResponse<PartnerWithdrawal>>(
    '/api/partner/withdrawals',
    payload,
    { headers: proofHeaders(proof) }
  )
  return requireSuccessfulResponse(response.data)
}

export async function getPartnerProfiles(
  page = 1,
  pageSize = 20,
  keyword = ''
) {
  const response = await api.get<ApiResponse<Paged<PartnerProfile>>>(
    '/api/partner/admin/profiles',
    { params: { page, page_size: pageSize, keyword } }
  )
  return requireSuccessfulResponse(response.data)
}

export async function configurePartner(
  userId: number,
  commissionBasisPoints: number
) {
  const response = await api.post<ApiResponse<PartnerProfile>>(
    '/api/partner/admin/profiles',
    { user_id: userId, commission_basis_points: commissionBasisPoints }
  )
  return requireSuccessfulResponse(response.data)
}

export async function getAdminPartnerWithdrawals(
  page = 1,
  pageSize = 20,
  status = '',
  keyword = ''
) {
  const response = await api.get<ApiResponse<Paged<PartnerWithdrawalAdmin>>>(
    '/api/partner/admin/withdrawals',
    { params: { page, page_size: pageSize, status, keyword } }
  )
  return requireSuccessfulResponse(response.data)
}

export async function revealPartnerDestination(id: number, proof?: string) {
  const response = await api.post<ApiResponse<PartnerDestination>>(
    `/api/partner/admin/withdrawals/${id}/reveal`,
    {},
    { headers: proofHeaders(proof) }
  )
  return response.data
}

export async function reviewPartnerWithdrawal(
  id: number,
  action: 'paid' | 'reject',
  payload: { payout_reference?: string; admin_note?: string },
  proof?: string
) {
  const response = await api.post<ApiResponse<PartnerWithdrawal>>(
    `/api/partner/admin/withdrawals/${id}/${action}`,
    payload,
    { headers: proofHeaders(proof) }
  )
  return response.data
}
