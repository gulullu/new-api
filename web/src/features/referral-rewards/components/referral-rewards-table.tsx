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
import { History, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { IconBadge } from '@/components/ui/icon-badge'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'

import { getReferralRewards } from '../api'
import { useReferralRewardsColumns } from './referral-rewards-columns'
import { ReferralRewardsMobileList } from './referral-rewards-mobile-list'

const route = getRouteApi('/_authenticated/referral-rewards/')

export function ReferralRewardsTable() {
  const { t, i18n } = useTranslation()
  const columns = useReferralRewardsColumns()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const { pagination, onPaginationChange, ensurePageInRange } =
    useTableUrlState({
      search: route.useSearch(),
      navigate: route.useNavigate(),
      pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
      globalFilter: { enabled: false },
    })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'referral-rewards',
      pagination.pageIndex + 1,
      pagination.pageSize,
      i18n.resolvedLanguage,
    ],
    queryFn: async () => {
      try {
        const response = await getReferralRewards({
          page: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })

        if (!response.success) {
          toast.error(response.message || t('Failed to load referral rewards'))
          return { items: [], total: 0 }
        }

        return {
          items: response.data?.items ?? [],
          total: response.data?.total ?? 0,
        }
      } catch {
        toast.error(t('Failed to load referral rewards'))
        return { items: [], total: 0 }
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const rewards = data?.items ?? []
  const isLoadingData = isLoading || (isFetching && !data)

  const { table } = useDataTable({
    data: rewards,
    columns,
    pagination,
    onPaginationChange,
    enableRowSelection: false,
    getRowId: (row) => String(row.id),
    manualPagination: true,
    totalCount: data?.total ?? 0,
    ensurePageInRange,
  })

  return (
    <section
      aria-labelledby='referral-reward-history-heading'
      className='bg-card min-w-0 overflow-hidden rounded-xl border shadow-sm'
    >
      <header className='border-border/70 flex min-w-0 flex-col gap-3 border-b p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex min-w-0 items-start gap-2.5'>
          <IconBadge tone='chart-2'>
            <History />
          </IconBadge>
          <div className='min-w-0'>
            <h2
              id='referral-reward-history-heading'
              className='text-sm font-semibold [overflow-wrap:anywhere] break-words whitespace-normal'
            >
              {t('Reward history')}
            </h2>
            <p
              data-referral-history-intro
              className='text-muted-foreground mt-1 text-xs leading-relaxed [overflow-wrap:anywhere] break-words whitespace-normal sm:text-sm'
            >
              {t(
                "Review rewards earned from referred users' eligible paid top-ups."
              )}
            </p>
          </div>
        </div>

        <div className='bg-muted/40 text-muted-foreground flex min-w-0 items-start gap-2 rounded-lg px-2.5 py-2 text-xs leading-relaxed lg:max-w-sm'>
          <ShieldCheck className='text-chart-2 mt-0.5 size-4 shrink-0' />
          <p className='[overflow-wrap:anywhere] break-words whitespace-normal'>
            {t('Invitee identities are masked to protect their privacy.')}
          </p>
        </div>
      </header>

      <div className='min-w-0 p-3 sm:p-4'>
        <DataTablePage
          table={table}
          columns={columns}
          isLoading={isLoadingData}
          isFetching={isFetching}
          emptyTitle={t('No Referral Rewards Yet')}
          emptyDescription={t(
            "Rewards will appear here after a referred user's eligible paid top-up is confirmed."
          )}
          skeletonKeyPrefix='referral-reward-skeleton'
          applyHeaderSize
          toolbarProps={null}
          fixedHeight={false}
          paginationInFooter={false}
          mobile={
            <ReferralRewardsMobileList
              table={table}
              isLoading={isLoadingData}
            />
          }
        />
      </div>
    </section>
  )
}
