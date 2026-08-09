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
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { IconBadge } from '@/components/ui/icon-badge'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'

import { getAdminReferralRewards } from '../api'
import type { AdminReferralRewardSummary } from '../types'
import { useAdminReferralRewardsColumns } from './admin-referral-rewards-columns'
import { AdminReferralRewardsMobileList } from './admin-referral-rewards-mobile-list'
import { AdminReferralSummary } from './admin-referral-summary'

const route = getRouteApi('/_authenticated/admin/referral-rewards/')

const EMPTY_SUMMARY: AdminReferralRewardSummary = {
  total_records: 0,
  awarded_records: 0,
  withheld_records: 0,
  reversed_records: 0,
  awarded_reward_quota: 0,
  active_reward_quota: 0,
  reversed_reward_quota: 0,
  unique_inviters: 0,
  unique_invitees: 0,
}

export function AdminReferralRewardsTable() {
  const { t, i18n } = useTranslation()
  const columns = useAdminReferralRewardsColumns()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      {
        columnId: 'payment_provider',
        searchKey: 'provider',
        type: 'array',
      },
    ],
  })

  const status =
    ((columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? [])[0] ?? ''
  const provider =
    ((columnFilters.find((filter) => filter.id === 'payment_provider')
      ?.value as string[] | undefined) ?? [])[0] ?? ''

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'admin-referral-rewards',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      status,
      provider,
      i18n.resolvedLanguage,
    ],
    queryFn: async () => {
      const response = await getAdminReferralRewards({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        keyword: globalFilter,
        status,
        provider,
      })

      if (!response.success) {
        throw new Error(response.message || t('Failed to load referral data'))
      }

      return {
        items: response.data?.items ?? [],
        total: response.data?.total ?? 0,
        summary: response.data?.summary ?? EMPTY_SUMMARY,
      }
    },
    placeholderData: (previousData) => previousData,
    meta: {
      errorMessage: t('Failed to load referral data'),
    },
  })

  const rewards = data?.items ?? []
  const isLoadingData = isLoading || (isFetching && !data)

  const { table } = useDataTable({
    data: rewards,
    columns,
    pagination,
    columnFilters,
    globalFilter,
    onPaginationChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
    enableRowSelection: false,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total ?? 0,
    getRowId: (row) => String(row.id),
    ensurePageInRange,
  })

  const statusOptions = useMemo(
    () => [
      { label: t('Awarded'), value: 'awarded' },
      { label: t('Withheld'), value: 'withheld' },
      { label: t('Reversed'), value: 'reversed' },
    ],
    [t]
  )
  const providerOptions = useMemo(
    () => [
      { label: 'Stripe', value: 'stripe' },
      { label: 'Waffo Pancake', value: 'waffo_pancake' },
      { label: 'Waffo', value: 'waffo' },
      { label: 'Creem', value: 'creem' },
      { label: 'Epay', value: 'epay' },
    ],
    []
  )

  return (
    <div className='min-w-0 space-y-4'>
      <AdminReferralSummary
        summary={data?.summary ?? EMPTY_SUMMARY}
        isLoading={isLoadingData}
      />

      <section className='bg-card min-w-0 overflow-hidden rounded-xl border shadow-sm'>
        <header className='border-border/70 flex min-w-0 flex-col gap-3 border-b p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex min-w-0 items-start gap-2.5'>
            <IconBadge tone='chart-2'>
              <ShieldCheck />
            </IconBadge>
            <div className='min-w-0'>
              <h2 className='text-sm font-semibold [overflow-wrap:anywhere] break-words whitespace-normal'>
                {t('Site-wide reward ledger')}
              </h2>
              <p className='text-muted-foreground mt-1 text-xs leading-relaxed [overflow-wrap:anywhere] break-words whitespace-normal sm:text-sm'>
                {t(
                  'All referral rewards. Identities are masked; payment references are hidden.'
                )}
              </p>
            </div>
          </div>
        </header>

        <div className='min-w-0 p-3 sm:p-4'>
          <DataTablePage
            table={table}
            columns={columns}
            isLoading={isLoadingData}
            isFetching={isFetching}
            emptyTitle={t('No referral records found')}
            emptyDescription={t('Try changing the search or filter criteria.')}
            skeletonKeyPrefix='admin-referral-reward-skeleton'
            applyHeaderSize
            fixedHeight={false}
            toolbarProps={{
              searchPlaceholder: t('Search user ID, username, or email...'),
              searchDebounceMs: 300,
              filters: [
                {
                  columnId: 'status',
                  title: t('Status'),
                  options: statusOptions,
                  singleSelect: true,
                },
                {
                  columnId: 'payment_provider',
                  title: t('Payment method'),
                  options: providerOptions,
                  singleSelect: true,
                },
              ],
            }}
            mobile={
              <AdminReferralRewardsMobileList
                table={table}
                isLoading={isLoadingData}
              />
            }
          />
        </div>
      </section>
    </div>
  )
}
