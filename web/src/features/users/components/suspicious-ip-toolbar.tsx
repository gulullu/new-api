import type { Table } from '@tanstack/react-table'
import { Filter, Loader2, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { getSuspiciousLoginIPs, updateIPBlacklist } from '../api'
import type { User } from '../types'

export function SuspiciousIPToolbar({ table }: { table: Table<User> }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['users', 'suspicious-login-ips'],
    queryFn: getSuspiciousLoginIPs,
    staleTime: 30_000,
  })
  const items = data?.success ? data.data ?? [] : []
  const blockedCount = items.filter((item) => item.blocked).length

  const filterByIP = (ip: string) => {
    table.resetRowSelection()
    table.setGlobalFilter(ip)
    table.setPageIndex(0)
    setOpen(false)
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
      toast.success(
        t(blocked ? 'IP removed from blacklist' : 'IP added to blacklist')
      )
    } catch {
      toast.error(t('Failed to update IP blacklist'))
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant='outline'
            size='sm'
            className='h-9 gap-1.5 px-2.5 sm:px-3'
            aria-label={t('Suspicious IPs')}
          />
        }
      >
        {isLoading ? (
          <Loader2 className='size-4 animate-spin' />
        ) : (
          <ShieldAlert className='size-4' />
        )}
        <span className='hidden sm:inline'>{t('Suspicious IPs')}</span>
        <span className='rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums'>
          {isLoading ? '…' : items.length}
        </span>
        {blockedCount > 0 && (
          <span className='hidden items-center gap-1 text-xs text-destructive md:inline-flex'>
            <ShieldOff className='size-3' />
            {blockedCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-[min(420px,calc(100vw-2rem))] gap-0 overflow-hidden p-0'
      >
        <PopoverHeader className='border-b px-3 py-2.5'>
          <PopoverTitle className='flex items-center gap-2 text-sm'>
            <ShieldAlert className='size-4 text-amber-500' />
            {t('Suspicious IPs')}
          </PopoverTitle>
          <PopoverDescription className='mt-1 text-xs'>
            {t('IPs shared by multiple user accounts')}
          </PopoverDescription>
        </PopoverHeader>
        <div className='max-h-[360px] overflow-y-auto p-1.5'>
          {isLoading ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='size-4 animate-spin text-muted-foreground' />
            </div>
          ) : items.length === 0 ? (
            <div className='px-3 py-8 text-center text-xs text-muted-foreground'>
              {t('No suspicious IPs found')}
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.ip}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60',
                  item.blocked && 'bg-destructive/5'
                )}
              >
                <button
                  type='button'
                  className='flex min-w-0 flex-1 items-center gap-2 text-left'
                  onClick={() => filterByIP(item.ip)}
                  title={t('Filter users by this IP')}
                >
                  <Filter className='size-3.5 shrink-0 text-muted-foreground' />
                  <span className='min-w-0 flex-1 truncate font-mono text-xs'>
                    {item.ip}
                  </span>
                  <span className='shrink-0 text-xs tabular-nums text-muted-foreground'>
                    {item.user_count} {t('Users')}
                  </span>
                </button>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  className={cn(
                    'size-7 shrink-0',
                    item.blocked
                      ? 'text-destructive hover:text-destructive'
                      : 'text-muted-foreground hover:text-destructive'
                  )}
                  onClick={() => toggleBlacklist(item.ip, item.blocked)}
                  title={t(
                    item.blocked
                      ? 'IP removed from blacklist'
                      : 'Add IP to blacklist'
                  )}
                  aria-label={t(
                    item.blocked
                      ? 'IP removed from blacklist'
                      : 'Add IP to blacklist'
                  )}
                >
                  {item.blocked ? (
                    <ShieldCheck className='size-4' />
                  ) : (
                    <ShieldOff className='size-4' />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
