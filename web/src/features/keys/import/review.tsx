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
import { Copy, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { formatQuota } from '@/lib/format'

import { downloadImportCSV, exportImportResults } from './data'
import type { ImportItem, ImportResult } from './types'

type Props = {
  items: ImportItem[]
  results?: ImportResult[]
  onMessage: (message: string) => void
}

export function ImportReview(props: Props) {
  const { t } = useTranslation()
  const exportRows = props.results
  return (
    <section className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-sm font-medium'>
          {exportRows
            ? t('Created {{count}} API keys', { count: exportRows.length })
            : t('Create {{count}} API keys', { count: props.items.length })}
        </h3>
        {exportRows && (
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={async () => {
                const ok = await copyToClipboard(
                  exportImportResults(exportRows)
                )
                props.onMessage(t(ok ? 'Copied' : 'Failed to copy keys'))
              }}
            >
              <Copy />
              {t('Copy results')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() =>
                downloadImportCSV(
                  'api-key-import-results.csv',
                  exportImportResults(exportRows)
                )
              }
            >
              <Download />
              {t('Export CSV')}
            </Button>
          </div>
        )}
      </div>
      <div className='overflow-hidden rounded-lg border'>
        <Table className='min-w-[650px]'>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Group')}</TableHead>
              <TableHead>{t('Quota')}</TableHead>
              <TableHead>{t('Expiration')}</TableHead>
              {exportRows && <TableHead>{t('API Key')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.items.map((item, index) => (
              <TableRow key={item.name}>
                <TableCell className='max-w-64 break-words whitespace-normal'>
                  <div>{item.name}</div>
                  <div className='text-muted-foreground mt-1 text-xs'>
                    {item.model_limits || t('All models')} ·{' '}
                    {item.allow_ips || t('Unrestricted IP')}
                  </div>
                </TableCell>
                <TableCell>
                  {item.group === 'auto' ? t('Cross-group') : item.group}
                </TableCell>
                <TableCell>
                  {item.unlimited_quota
                    ? t('Unlimited')
                    : formatQuota(item.remain_quota)}
                </TableCell>
                <TableCell>
                  {item.expired_time === -1
                    ? t('Never')
                    : new Date(item.expired_time * 1000).toLocaleString()}
                </TableCell>
                {exportRows && (
                  <TableCell className='max-w-80 font-mono text-xs break-all whitespace-normal'>
                    {exportRows[index]?.key}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!exportRows && (
        <p className='text-muted-foreground text-xs'>
          {t(
            'Final values include template defaults. Quotas apply to each key.'
          )}
        </p>
      )}
    </section>
  )
}
