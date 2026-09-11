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
import { api } from '@/lib/api'

import type { ApiResponse } from '../types'
import type {
  ImportItem,
  ImportPreview,
  ImportResult,
  ImportTemplate,
  TemplateDefaults,
} from './types'

export async function previewImport(
  items: ImportItem[]
): Promise<ApiResponse<ImportPreview>> {
  return (await api.post('/api/token/batch/import/preview', { items })).data
}
export async function createImport(
  requestId: string,
  items: ImportItem[],
  allowExistingNames: boolean
): Promise<ApiResponse<ImportResult[]>> {
  return (
    await api.post('/api/token/batch/import', {
      request_id: requestId,
      items,
      allow_existing_names: allowExistingNames,
    })
  ).data
}
export async function getImportTemplates(): Promise<
  ApiResponse<ImportTemplate[]>
> {
  return (await api.get('/api/token/import-templates')).data
}
export async function saveImportTemplate(
  name: string,
  defaults: TemplateDefaults
): Promise<ApiResponse<ImportTemplate>> {
  return (await api.post('/api/token/import-templates', { name, defaults }))
    .data
}
export async function deleteImportTemplate(id: number): Promise<ApiResponse> {
  return (await api.delete(`/api/token/import-templates/${id}`)).data
}

export function importErrorMessage(
  message: string,
  translate: (key: string, values?: Record<string, unknown>) => string
): string {
  const row = /^Row (\d+): (.+)$/.exec(message)
  if (!row) return translate(message)
  const messages: Record<string, string> = {
    'name must contain 1 to 50 bytes': 'Name must contain 1 to 50 bytes',
    'duplicate name': 'Duplicate name in this import',
    'group is not available': 'Group is not available',
    'quota is out of range': 'Invalid quota',
    'expiration must be in the future': 'Expiration must be in the future',
    'model or IP list is too long': 'Model or IP list is too long',
    'invalid IP address or CIDR': 'Invalid IP address or CIDR',
  }
  return translate('Row {{row}}: {{message}}', {
    row: row[1],
    message: translate(messages[row[2]] || row[2]),
  })
}

export async function downloadImportWorkbook(labels: {
  title: string
  instructions: string
  headers: string[]
  group_help: string
  expiry_help: string
}): Promise<void> {
  const response = await api.post('/api/token/import-template.xlsx', labels, {
    responseType: 'blob',
  })
  const blob = response.data as Blob
  if (!blob.type.includes('spreadsheetml')) {
    throw new Error('Unable to download Excel template')
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'api-key-template.xlsx'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readImportWorkbook(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const response = await api.post<ApiResponse<{ text: string }>>(
    '/api/token/batch/import/file',
    form,
    { headers: { 'Content-Type': undefined } }
  )
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Invalid import data')
  }
  return response.data.data.text
}
