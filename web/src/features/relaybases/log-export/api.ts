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
import { getFreshAuthHeaders, refreshAuthentication } from '@/lib/auth-session'

const exportPrefix = '/rb-log-export'

type ExportJob = {
  job_id?: string
  status?: string
  message?: string
  row_count?: number
  filename?: string
}

type ExportResponse = {
  success?: boolean
  message?: string
  data?: ExportJob
}

async function exportFetch(
  path: string,
  init: RequestInit,
  retry = true
): Promise<Response> {
  const headers = new Headers(init.headers)
  const authHeaders = await getFreshAuthHeaders()
  Object.entries(authHeaders).forEach(([name, value]) =>
    headers.set(name, value)
  )

  const response = await fetch(`${exportPrefix}${path}`, {
    ...init,
    cache: 'no-store',
    credentials: 'omit',
    headers,
  })

  if (response.status === 401 && retry) {
    await refreshAuthentication()
    return exportFetch(path, init, false)
  }

  return response
}

async function responseError(response: Response): Promise<Error> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => ({}))) as ExportResponse
    return new Error(payload.message || `HTTP ${response.status}`)
  }
  const message = await response.text().catch(() => '')
  return new Error(message || `HTTP ${response.status}`)
}

async function exportJson(
  path: string,
  init: RequestInit
): Promise<ExportResponse> {
  const response = await exportFetch(path, init)
  const payload = (await response.json().catch(() => ({}))) as ExportResponse
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `HTTP ${response.status}`)
  }
  return payload
}

export async function createCommonLogExport(search: Record<string, unknown>) {
  const payload = await exportJson('/api/exports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ search }),
  })
  if (!payload.data?.job_id) {
    throw new Error('The export service did not return a job ID.')
  }
  return payload.data.job_id
}

export async function getCommonLogExport(jobId: string): Promise<ExportJob> {
  const payload = await exportJson(
    `/api/exports/${encodeURIComponent(jobId)}`,
    { method: 'GET' }
  )
  return payload.data ?? {}
}

function filenameFromDisposition(disposition: string | null): string {
  if (!disposition) return ''
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (encoded?.[1]) return decodeURIComponent(encoded[1].replaceAll('"', ''))
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? ''
}

export async function downloadCommonLogExport(jobId: string) {
  const response = await exportFetch(
    `/api/exports/${encodeURIComponent(jobId)}/download`,
    { method: 'GET' }
  )
  if (!response.ok) throw await responseError(response)
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(
      response.headers.get('content-disposition')
    ),
  }
}

export function commonLogSearchFromLocation(
  searchString = window.location.search
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const params = new URLSearchParams(searchString)
  for (const [key, rawValue] of params.entries()) {
    if (key === 'type') {
      const values = Array.isArray(result.type) ? result.type : []
      values.push(rawValue)
      result.type = values
      continue
    }
    if (key === 'startTime' || key === 'endTime') {
      const numberValue = Number(rawValue)
      result[key] = Number.isFinite(numberValue) ? numberValue : rawValue
      continue
    }
    result[key] = rawValue
  }
  return result
}

export function saveExportBlob(blob: Blob, filename?: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'common-logs.xlsx'
  link.hidden = true
  document.body.appendChild(link)
  link.click()
  globalThis.setTimeout(() => {
    URL.revokeObjectURL(url)
    link.remove()
  }, 1000)
}
