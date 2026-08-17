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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { PricingData, PricingModel } from '@/features/pricing/types'

import { adaptRelayBasesPricingData } from '../adapter'

function model(
  modelName: string,
  overrides: Partial<PricingModel> = {}
): PricingModel {
  return {
    id: modelName.length,
    model_name: modelName,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['custom'],
    ...overrides,
  }
}

function pricingData(models: PricingModel[]): PricingData {
  return {
    success: true,
    data: models,
    vendors: [
      { id: 1, name: 'OpenAI' },
      { id: 3, name: 'Anthropic' },
      { id: 7, name: 'Google' },
      { id: 9, name: 'Alibaba' },
    ],
    group_ratio: {
      custom: 1,
      media: 1,
      'open-models': 1,
      'gemini-pro': 1,
      'claude-pro': 1,
      'gpt-pro': 1,
    },
    usable_group: {
      custom: { desc: 'custom', ratio: 1 },
      media: { desc: 'media', ratio: 1 },
      'open-models': { desc: 'open', ratio: 1 },
      'gemini-pro': { desc: 'gemini', ratio: 1 },
      'claude-pro': { desc: 'claude', ratio: 1 },
      'gpt-pro': { desc: 'gpt', ratio: 1 },
    },
    supported_endpoint: {},
    auto_groups: [],
  }
}

describe('RelayBases pricing presentation adapter', () => {
  test('localizes descriptions, tags, vendors, and metadata without changing billing', () => {
    const source = pricingData([
      model('grok-imagine-video', {
        description: 'origin description',
        tags: '视频生成,异步任务,按秒计价,vision',
        quota_type: 1,
        model_price: 42,
        enable_groups: ['media'],
      }),
    ])

    const adapted = adaptRelayBasesPricingData(source, 'fr')
    const adaptedModel = adapted.data[0]

    assert.notEqual(adaptedModel.description, 'origin description')
    assert.equal(
      adaptedModel.tags,
      'xAI,Grok,génération-vidéo,tâche-asynchrone,tarification-à-la-seconde,vision'
    )
    assert.equal(adaptedModel.icon, 'XAI')
    assert.deepEqual(adaptedModel.output_modalities, ['video'])
    assert.equal(adaptedModel.quota_type, 1)
    assert.equal(adaptedModel.model_price, 42)
    assert.equal(adaptedModel.model_ratio, 1)
    assert.equal(adaptedModel.completion_ratio, 1)
  })

  test('preserves unknown models and every server-returned group', () => {
    const unknown = model('future-model', {
      description: 'server copy',
      tags: 'future',
      enable_groups: ['default', 'custom'],
      billing_mode: 'tiered_expr',
      billing_expr: 'v1:custom',
    })
    const source = pricingData([unknown])

    const adapted = adaptRelayBasesPricingData(source, 'ja')

    assert.deepEqual(adapted.data[0], unknown)
    assert.deepEqual(
      Object.keys(adapted.usable_group).sort(),
      Object.keys(source.usable_group).sort()
    )
    assert.deepEqual(
      Object.keys(adapted.group_ratio).sort(),
      Object.keys(source.group_ratio).sort()
    )
  })

  test('hides internal Compact routing aliases from the model square', () => {
    const source = pricingData([
      model('gpt-5.5'),
      model('gpt-5.5-openai-compact'),
      model('future-openai-compact'),
    ])

    const adapted = adaptRelayBasesPricingData(source, 'en')

    assert.deepEqual(
      adapted.data.map((item) => item.model_name),
      ['gpt-5.5']
    )
  })

  test('adds the official Grok 4.6 and GLM-5.3 model metadata', () => {
    const source = pricingData([model('grok-4.6'), model('glm-5.3')])

    const adapted = adaptRelayBasesPricingData(source, 'en')
    const grok = adapted.data.find((item) => item.model_name === 'grok-4.6')
    const glm = adapted.data.find((item) => item.model_name === 'glm-5.3')

    assert.equal(grok?.context_length, 500000)
    assert.equal(grok?.knowledge_cutoff, '2026-02-01')
    assert.equal(grok?.release_date, '2026-08-12')
    assert.deepEqual(grok?.input_modalities, ['text', 'image'])
    assert.ok(grok?.capabilities?.includes('function_calling'))
    assert.ok(grok?.capabilities?.includes('structured_output'))
    assert.ok(grok?.capabilities?.includes('reasoning'))

    assert.equal(glm?.context_length, 1000000)
    assert.equal(glm?.max_output_tokens, 128000)
    assert.deepEqual(glm?.input_modalities, ['text'])
    assert.ok(glm?.capabilities?.includes('streaming'))
    assert.ok(glm?.capabilities?.includes('function_calling'))
    assert.ok(glm?.capabilities?.includes('structured_output'))
    assert.ok(glm?.capabilities?.includes('reasoning'))
    assert.ok(glm?.capabilities?.includes('caching'))
  })

  test('uses the curated stable model and group order', () => {
    const source = pricingData([
      model('future-model', { vendor_id: 99 }),
      model('grok-imagine-video', { enable_groups: ['media'] }),
      model('deepseek-v4-pro', { enable_groups: ['open-models'] }),
      model('gemini-3.1-pro-high', { vendor_id: 7 }),
      model('claude-opus-4-6', { vendor_id: 3 }),
      model('gpt-5.4', { vendor_id: 1 }),
    ])

    const adapted = adaptRelayBasesPricingData(source, 'en')

    assert.deepEqual(
      adapted.data.map((item) => item.model_name),
      [
        'gpt-5.4',
        'claude-opus-4-6',
        'gemini-3.1-pro-high',
        'deepseek-v4-pro',
        'grok-imagine-video',
        'future-model',
      ]
    )
    assert.deepEqual(Object.keys(adapted.usable_group), [
      'gpt-pro',
      'claude-pro',
      'gemini-pro',
      'open-models',
      'media',
      'custom',
    ])
  })

  test('keeps live tiered pricing fields while adding catalog presentation', () => {
    const source = pricingData([
      model('codex-auto-review', {
        model_ratio: 19,
        completion_ratio: 23,
        billing_mode: 'tiered_expr',
        billing_expr: 'v1:live-expression',
        pricing_version: 'live-7',
      }),
    ])

    const adapted = adaptRelayBasesPricingData(source, 'zh-CN').data[0]

    assert.equal(adapted.model_ratio, 19)
    assert.equal(adapted.completion_ratio, 23)
    assert.equal(adapted.billing_expr, 'v1:live-expression')
    assert.equal(adapted.pricing_version, 'live-7')
    assert.match(adapted.description || '', /Codex/)
    assert.equal(adapted.context_length, 1050000)
  })
})
