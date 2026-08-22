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
import { type Table } from '@tanstack/react-table'
import { ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Button } from '@/components/ui/button'

import { batchDisableUsers } from '../api'
import { type User } from '../types'
import { useUsers } from './users-provider'

interface DataTableBulkActionsProps {
  table: Table<User>
}

export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const { t } = useTranslation()
  const { triggerRefresh } = useUsers()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleDisable = async () => {
    setIsLoading(true)
    try {
      const result = await batchDisableUsers(selectedRows.map((row) => row.original.id))
      if (!result.success) {
        toast.error(result.message || t('Failed to disable users'))
        return
      }
      toast.success(t('Disabled {{count}} users', { count: result.data?.disabled ?? 0 }))
      table.resetRowSelection()
      triggerRefresh()
      setConfirmOpen(false)
    } catch {
      toast.error(t('Failed to disable users'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='user'>
        <Button
          variant='destructive'
          size='sm'
          className='gap-1.5'
          onClick={() => setConfirmOpen(true)}
        >
          <ShieldOff className='size-4' />
          <span className='hidden sm:inline'>{t('Batch disable')}</span>
        </Button>
      </BulkActionsToolbar>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('Disable selected users?')}
        desc={t(
          'This will immediately revoke their ability to log in or use the API. Their records and audit history will be retained.'
        )}
        confirmText={t('Batch disable')}
        destructive
        isLoading={isLoading}
        handleConfirm={handleDisable}
      />
    </>
  )
}
