import type { Table } from '@tanstack/react-table'
import { Ban, Check, Loader2, Search, ShieldOff } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { getSuspiciousLoginIPs, updateIPBlacklist } from '../api'
import type { User } from '../types'

export function SuspiciousIPToolbar({ table }: { table: Table<User> }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['users', 'suspicious-login-ips'],
    queryFn: getSuspiciousLoginIPs,
    staleTime: 30_000,
  })
  const items = data?.success ? data.data ?? [] : []

  const filterByIP = (ip: string) => {
    table.resetRowSelection()
    table.setGlobalFilter(ip)
    table.setPageIndex(0)
  }

  const toggleBlacklist = async (ip: string, blocked: boolean) => {
    try {
      const result = await updateIPBlacklist(ip, !blocked)
      if (!result.success) {
        toast.error(result.message || t('Failed to update IP blacklist'))
        return
      }
      await queryClient.invalidateQueries({
        queryKey: ['users', 'suspicious-login-ips'],
      })
      toast.success(t(blocked ? 'IP removed from blacklist' : 'IP added to blacklist'))
    } catch {
      toast.error(t('Failed to update IP blacklist'))
    }
  }

  return (
    <div className='flex min-w-0 flex-1 items-center gap-2 rounded-xl border bg-muted/20 px-2 py-1.5'>
      <div className='flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground'>
        <Ban className='size-3.5' />
        <span>{t('Suspicious IPs')}</span>
        <span className='rounded-full bg-muted px-1.5 py-0.5 tabular-nums'>
          {isLoading ? '…' : items.length}
        </span>
      </div>
      <div className='flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5'>
        {isLoading ? (
          <Loader2 className='text-muted-foreground size-4 animate-spin' />
        ) : items.length === 0 ? (
          <span className='text-muted-foreground text-xs'>
            {t('No suspicious IPs found')}
          </span>
        ) : (
          items.map((item) => (
            <div
              key={item.ip}
              className={cn(
                'group inline-flex shrink-0 items-center gap-0.5 rounded-lg border bg-background px-1',
                item.blocked && 'border-destructive/40 bg-destructive/5'
              )}
            >
              <Button
                variant='ghost'
                size='sm'
                className='h-6 gap-1 px-1.5 font-mono text-[11px]'
                onClick={() => filterByIP(item.ip)}
                title={t('Filter users by this IP')}
              >
                <Search className='size-3' />
                {item.ip}
                <span className='font-sans text-muted-foreground'>
                  {item.user_count}
                </span>
              </Button>
              <Button
                variant='ghost'
                size='icon-sm'
                className={cn(
                  'size-6',
                  item.blocked
                    ? 'text-destructive hover:text-destructive'
                    : 'text-muted-foreground hover:text-destructive'
                )}
                onClick={() => toggleBlacklist(item.ip, item.blocked)}
                title={t(item.blocked ? 'IP removed from blacklist' : 'Add IP to blacklist')}
                aria-label={t(item.blocked ? 'IP removed from blacklist' : 'Add IP to blacklist')}
              >
                {item.blocked ? <ShieldOff /> : <Check />}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
