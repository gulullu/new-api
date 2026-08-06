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
import { readFile } from 'node:fs/promises'
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'

import type { AdminReferralReward } from '../../types'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

type LocaleResource = {
  translation: Record<string, string>
}

async function loadLocale(locale: 'en' | 'zh' | 'zh-TW') {
  const source = await readFile(
    new URL(`../../../../i18n/locales/${locale}.json`, import.meta.url),
    'utf8'
  )
  return JSON.parse(source) as LocaleResource
}

const [en, zh, zhTW] = await Promise.all([
  loadLocale('en'),
  loadLocale('zh'),
  loadLocale('zh-TW'),
])
const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { AdminReferralRewardMobileCard } =
  await import('../admin-referral-rewards-mobile-list')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en, zh, 'zh-TW': zhTW },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

const reward: AdminReferralReward = {
  id: 9,
  inviter_id: 101,
  inviter_label: 'l***r-with-an-intentionally-long-masked-name',
  invitee_id: 202,
  invitee_label: 'g***u@example.com-with-an-intentionally-long-masked-email',
  payment_provider: 'waffo_pancake',
  paid_amount: '90',
  paid_currency: 'USD',
  rate_basis_points: 300,
  reward_quota: 1_350_000,
  reversed_quota: 0,
  status: 'awarded',
  created_at: 1_754_265_600,
}

async function renderCard(item: AdminReferralReward) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <AdminReferralRewardMobileCard reward={item} />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountCard(rendered: Awaited<ReturnType<typeof renderCard>>) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('admin referral reward dashboard layout', () => {
  after(() => {
    domWindow.close()
  })

  test('keeps long masked identities readable without exposing a concrete currency', async () => {
    const rendered = await renderCard(reward)
    const card = rendered.container.querySelector('[data-admin-referral-card]')
    const inviter = rendered.container.querySelector(
      '[data-admin-referral-inviter]'
    )
    const invitee = rendered.container.querySelector(
      '[data-admin-referral-invitee]'
    )

    assert.ok(card)
    assert.ok(inviter)
    assert.ok(invitee)
    assert.equal(inviter.textContent, reward.inviter_label)
    assert.equal(invitee.textContent, reward.invitee_label)
    assert.equal(inviter.classList.contains('whitespace-normal'), true)
    assert.equal(invitee.classList.contains('whitespace-normal'), true)
    assert.equal(card.textContent?.includes('Fiat'), true)
    assert.equal(card.textContent?.includes('USD'), false)
    assert.equal(card.textContent?.includes('CNY'), false)
    assert.equal(card.textContent?.includes('gateway'), false)

    await unmountCard(rendered)
  })

  test('provides complete admin dashboard translations in both Chinese locales', () => {
    const keys = [
      'Referral Management',
      'Reward events',
      'Active reward credits',
      'Reversed reward credits',
      'Referred users',
      'Site-wide referral summary',
      'Referral relationship',
      'Deleted user',
      'Fiat',
      'Reward credits',
      'Reversal reason',
      'No referral records found',
      'Failed to load referral data',
      'Site-wide reward ledger',
      'Search user ID, username, or email...',
    ]

    for (const key of keys) {
      assert.equal(typeof en.translation[key], 'string')
      assert.equal(typeof zh.translation[key], 'string')
      assert.equal(typeof zhTW.translation[key], 'string')
      assert.notEqual(zh.translation[key], key)
      assert.notEqual(zhTW.translation[key], key)
    }
  })
})
