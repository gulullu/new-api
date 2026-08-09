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
import type {
  ModelCapability,
  Modality,
  PricingData,
  PricingModel,
} from '@/features/pricing/types'

import { getRelayBasesI18nResource } from '../i18n/manifest'
import { RELAYBASES_MODEL_CATALOG } from './catalog'

const OPEN_MODEL_GROUPS = new Set(['open-models', 'grok'])
const MODALITY_ORDER: Modality[] = ['text', 'image', 'audio', 'video', 'file']
const CAPABILITY_ORDER: ModelCapability[] = [
  'streaming',
  'system_prompt',
  'function_calling',
  'tools',
  'json_mode',
  'structured_output',
  'vision',
  'reasoning',
  'web_search',
  'code_interpreter',
  'caching',
  'embeddings',
]

const TAG_ALIASES: Readonly<Record<string, string>> = {
  图片生成: 'imageGeneration',
  'image generation': 'imageGeneration',
  'image-generation': 'imageGeneration',
  图片编辑: 'imageEditing',
  'image editing': 'imageEditing',
  'image-editing': 'imageEditing',
  视频生成: 'videoGeneration',
  'video generation': 'videoGeneration',
  'video-generation': 'videoGeneration',
  异步任务: 'asyncTask',
  'async task': 'asyncTask',
  'async-task': 'asyncTask',
  同步接口: 'syncEndpoint',
  'sync endpoint': 'syncEndpoint',
  'sync-endpoint': 'syncEndpoint',
  按秒计价: 'perSecondPricing',
  'per-second pricing': 'perSecondPricing',
  'per-second-pricing': 'perSecondPricing',
}

function parseTags(value?: string): string[] {
  return String(value || '')
    .split(/[,;|\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function deriveModalities(
  model: PricingModel,
  tags: string[]
): {
  input_modalities: Modality[]
  output_modalities: Modality[]
} {
  const normalized = new Set(tags.map((tag) => tag.toLowerCase()))
  const input = new Set<Modality>(['text'])
  const output = new Set<Modality>(['text'])

  if (normalized.has('image') || normalized.has('vision')) input.add('image')
  if (normalized.has('audio')) input.add('audio')
  if (normalized.has('video')) input.add('video')
  if (normalized.has('pdf') || normalized.has('file')) input.add('file')
  if (model.model_name === 'gpt-image-2') {
    output.clear()
    output.add('image')
  }

  return {
    input_modalities: MODALITY_ORDER.filter((modality) => input.has(modality)),
    output_modalities: MODALITY_ORDER.filter((modality) =>
      output.has(modality)
    ),
  }
}

function deriveCapabilities(tags: string[]): ModelCapability[] {
  const normalized = new Set(tags.map((tag) => tag.toLowerCase()))
  const capabilities = new Set<ModelCapability>()
  const tagCapabilities: Readonly<Record<string, ModelCapability>> = {
    reasoning: 'reasoning',
    tools: 'tools',
    structured: 'structured_output',
    vision: 'vision',
    streaming: 'streaming',
    caching: 'caching',
    search: 'web_search',
    code: 'code_interpreter',
    json: 'json_mode',
    embeddings: 'embeddings',
  }

  for (const tag of normalized) {
    const capability = tagCapabilities[tag]
    if (capability) capabilities.add(capability)
  }
  if (capabilities.has('tools')) capabilities.add('function_calling')
  if (capabilities.has('structured_output')) capabilities.add('json_mode')
  return CAPABILITY_ORDER.filter((capability) => capabilities.has(capability))
}

function localizeTags(
  value: string | undefined,
  localizedTags: Readonly<Record<string, string>>
): string | undefined {
  if (!value) return value
  return value
    .split(',')
    .map((tag) => {
      const trimmed = tag.trim()
      const key = TAG_ALIASES[trimmed.toLowerCase()]
      return key ? localizedTags[key] || trimmed : trimmed
    })
    .filter(Boolean)
    .join(',')
}

function pricingGroupRank(group: string): number {
  if (group.startsWith('codex-') || group.startsWith('gpt-')) return 1
  if (group.startsWith('claude-')) return 2
  if (group.startsWith('gemini-')) return 3
  if (OPEN_MODEL_GROUPS.has(group)) return 4
  if (group === 'media') return 5
  return 6
}

function sortGroupRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, value], index) => ({ key, value, index }))
      .sort(
        (left, right) =>
          pricingGroupRank(left.key) - pricingGroupRank(right.key) ||
          left.index - right.index
      )
      .map(({ key, value }) => [key, value])
  )
}

function pricingModelRank(model: PricingModel): number {
  const groups = (model.enable_groups || []).map(String)
  const isMedia =
    groups.includes('media') ||
    /image|video|veo|banana|kling|nana/i.test(model.model_name)
  if (isMedia) return 5
  if (groups.some((group) => OPEN_MODEL_GROUPS.has(group))) return 4
  if (model.vendor_id === 1) return 1
  if (model.vendor_id === 3 || model.vendor_id === 4) return 2
  if (model.vendor_id === 7) return 3
  return 6
}

function adaptModel(
  model: PricingModel,
  copy: ReturnType<typeof getRelayBasesI18nResource>['pricing']
): PricingModel {
  const catalog = RELAYBASES_MODEL_CATALOG[model.model_name]
  const descriptions: Readonly<Record<string, string>> = copy.modelDescriptions
  const description = descriptions[model.model_name]
  if (!catalog && !description) return model

  const source = { ...model, ...catalog }
  const tags = parseTags(source.tags)
  const modalities = deriveModalities(source, tags)
  const generated = {
    context_length: Number.isFinite(Number(source.context_length))
      ? Number(source.context_length)
      : 0,
    max_output_tokens: Number.isFinite(Number(source.max_output_tokens))
      ? Number(source.max_output_tokens)
      : 0,
    knowledge_cutoff:
      typeof source.knowledge_cutoff === 'string'
        ? source.knowledge_cutoff
        : '',
    release_date:
      typeof source.release_date === 'string' ? source.release_date : '',
    ...modalities,
    capabilities: Array.isArray(source.capabilities)
      ? source.capabilities
      : deriveCapabilities(tags),
  }

  return {
    ...model,
    ...generated,
    ...catalog,
    description: description || model.description,
    tags: localizeTags(source.tags, copy.tags),
  }
}

function localizeVendorName(
  name: string,
  vendors: ReturnType<typeof getRelayBasesI18nResource>['pricing']['vendors']
): string {
  if (name === 'Alibaba' || name === '阿里巴巴') return vendors.alibaba
  if (
    name === 'Zhipu' ||
    name === 'BigModel' ||
    name === '智谱' ||
    name === 'Z.AI'
  ) {
    return vendors.zai
  }
  return name
}

/**
 * Applies catalog presentation only. It preserves the exact model/group set
 * returned by the server and never changes any billing field.
 */
export function adaptRelayBasesPricingData(
  data: PricingData,
  language?: string | null
): PricingData {
  const copy = getRelayBasesI18nResource(language).pricing
  const models = data.data
    .map((model, index) => ({ model: adaptModel(model, copy), index }))
    .sort(
      (left, right) =>
        pricingModelRank(left.model) - pricingModelRank(right.model) ||
        left.index - right.index
    )
    .map(({ model }) => model)

  return {
    ...data,
    data: models,
    vendors: data.vendors.map((vendor) => ({
      ...vendor,
      name: localizeVendorName(vendor.name, copy.vendors),
    })),
    group_ratio: sortGroupRecord(data.group_ratio),
    usable_group: sortGroupRecord(data.usable_group),
  }
}
