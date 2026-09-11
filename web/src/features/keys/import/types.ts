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
export type ImportFields = {
  group: string
  quota: string
  expiry: string
  models: string
  ips: string
}

export type ImportRow = ImportFields & { id: string; name: string }
export type ImportItem = {
  name: string
  group: string
  remain_quota: number
  unlimited_quota: boolean
  expired_time: number
  model_limits: string
  allow_ips: string
}
export type ImportResult = ImportItem & { id: number; key: string }
export type TemplateDefaults = {
  group: string
  remain_quota: number
  unlimited_quota: boolean
  expiry: string
  model_limits: string
  allow_ips: string
}
export type ImportTemplate = {
  id: number
  name: string
  defaults: TemplateDefaults
}
export type ImportPreview = { existing_names: string[]; remaining: number }
export type GroupOption = {
  value: string
  label: string
  desc?: string
  ratio?: number | string
}
