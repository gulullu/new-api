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

import type { ReferralReward } from '../../types'

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
const { ReferralRewardMobileCard } =
  await import('../referral-rewards-mobile-list')

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

const reward: ReferralReward = {
  id: 7,
  invitee_label:
    'g***u@gmail.com-with-an-intentionally-long-privacy-safe-label',
  payment_provider: 'waffo_pancake_with_a_long_future_provider_suffix',
  paid_amount: '90',
  paid_currency: 'CNY',
  reward_quota: 1_350_000,
  rate_basis_points: 300,
  status: 'awarded',
  created_at: 1_754_265_600,
}

async function renderCard(item: ReferralReward) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <ReferralRewardMobileCard reward={item} />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountCard(rendered: Awaited<ReturnType<typeof renderCard>>) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('referral reward details layout', () => {
  after(() => {
    domWindow.close()
  })

  test('shows long privacy-safe labels and fields without clipping them', async () => {
    await i18n.changeLanguage('en')
    const rendered = await renderCard(reward)
    const card = rendered.container.querySelector('[data-referral-reward-card]')
    const invitee = rendered.container.querySelector('[data-referral-invitee]')

    assert.ok(card)
    assert.ok(invitee)
    assert.equal(invitee.textContent, reward.invitee_label)
    assert.equal(invitee.classList.contains('whitespace-normal'), true)
    assert.equal(invitee.classList.contains('break-words'), true)
    assert.equal(card.textContent?.includes(reward.payment_provider), true)
    assert.equal(
      invitee.querySelectorAll('[class*="truncate"], [class*="line-clamp"]')
        .length,
      0
    )
    for (const field of card.querySelectorAll('dd')) {
      assert.equal(field.classList.contains('whitespace-normal'), true)
      assert.equal(field.classList.contains('break-words'), true)
      assert.equal(field.className.includes('truncate'), false)
      assert.equal(field.className.includes('line-clamp'), false)
    }

    await unmountCard(rendered)
  })

  test('renders only the privacy-safe referral fields from an extended payload', async () => {
    await i18n.changeLanguage('en')
    const extendedPayload = {
      ...reward,
      invitee_id: 991_337,
      top_up_id: 882_246,
      trade_no: 'secret-trade-number',
      gateway_event_id: 'secret-gateway-event',
      gateway_payment_id: 'secret-gateway-payment',
    }
    const rendered = await renderCard(extendedPayload)
    const text = rendered.container.textContent ?? ''

    assert.equal(text.includes('991337'), false)
    assert.equal(text.includes('882246'), false)
    assert.equal(text.includes('secret-trade-number'), false)
    assert.equal(text.includes('secret-gateway-event'), false)
    assert.equal(text.includes('secret-gateway-payment'), false)

    await unmountCard(rendered)
  })

  test('keeps referral detail labels translated in both Chinese locales', () => {
    const keys = [
      'Referral Rewards',
      'Reward history',
      'Invitee',
      'Payment method',
      'Actual Amount',
      'Reward rate',
      'Reward',
      'Awarded at',
      'Awarded',
      'Reversed',
      'Withheld',
      'Private invitee',
      'No Referral Rewards Yet',
      "Rewards will appear here after a referred user's eligible paid top-up is confirmed.",
      'Failed to load referral rewards',
      "Review rewards earned from referred users' eligible paid top-ups.",
      'Invitee identities are masked to protect their privacy.',
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
