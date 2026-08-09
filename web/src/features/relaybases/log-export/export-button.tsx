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
import { Download, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import {
  commonLogSearchFromLocation,
  createCommonLogExport,
  downloadCommonLogExport,
  getCommonLogExport,
  saveExportBlob,
} from './api'

type ExportState = 'idle' | 'submitting' | 'exporting' | 'success' | 'error'

function wait(milliseconds: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds))
}

function exportStatusClassName(state: ExportState) {
  if (state === 'error') {
    return 'text-destructive max-w-72 text-xs leading-snug'
  }
  if (state === 'success') {
    return 'max-w-72 text-xs leading-snug text-emerald-600 dark:text-emerald-400'
  }
  return 'text-muted-foreground max-w-72 text-xs leading-snug'
}

export function RelayBasesCommonLogExportButton() {
  const { t } = useTranslation('relaybases')
  const [state, setState] = useState<ExportState>('idle')
  const [status, setStatus] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])

  const exportLogs = async () => {
    setState('submitting')
    setStatus(t('logExport.submitting'))
    try {
      const jobId = await createCommonLogExport(commonLogSearchFromLocation())
      setState('exporting')
      setStatus(t('logExport.exporting'))

      for (let attempt = 0; attempt < 180; attempt += 1) {
        await wait(attempt === 0 ? 800 : 2000)
        if (!mounted.current) return
        const job = await getCommonLogExport(jobId)
        if (job.status === 'failed') {
          throw new Error(job.message || t('logExport.failed'))
        }
        if (job.status !== 'done') continue

        const file = await downloadCommonLogExport(jobId)
        saveExportBlob(file.blob, file.filename || job.filename)
        const rows = Number(job.row_count)
        setState('success')
        setStatus(
          Number.isFinite(rows)
            ? t('logExport.downloadStartedRows', {
                rows: rows.toLocaleString(),
              })
            : t('logExport.downloadStarted')
        )
        return
      }

      throw new Error(t('logExport.pending'))
    } catch (error) {
      if (!mounted.current) return
      setState('error')
      setStatus(
        error instanceof Error && error.message
          ? error.message
          : t('logExport.failed')
      )
    }
  }

  const busy = state === 'submitting' || state === 'exporting'

  return (
    <div className='flex max-w-full flex-wrap items-center justify-end gap-2'>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={busy}
        onClick={exportLogs}
        aria-label={t('logExport.ariaLabel')}
        data-relaybases-log-export
      >
        {busy ? <Loader2 className='animate-spin' /> : <Download />}
        {t('logExport.action')}
      </Button>
      {status && (
        <span
          role='status'
          aria-live='polite'
          className={exportStatusClassName(state)}
        >
          {status}
        </span>
      )}
    </div>
  )
}
