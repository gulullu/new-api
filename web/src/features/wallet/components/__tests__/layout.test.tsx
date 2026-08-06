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
import type { ComponentProps } from 'react'

import type { UserWalletData } from '../../types'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'HTMLInputElement',
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
const { TooltipProvider } = await import('@/components/ui/tooltip')
const { AffiliateRewardsCard } = await import('../affiliate-rewards-card')

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

const user: UserWalletData = {
  id: 7,
  username: 'referrer',
  quota: 0,
  used_quota: 0,
  request_count: 0,
  aff_quota: 0,
  aff_history_quota: 0,
  aff_count: 99,
  group: 'default',
}

type RenderedCard = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderCard(
  props: Partial<ComponentProps<typeof AffiliateRewardsCard>> = {}
): Promise<RenderedCard> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <TooltipProvider>
          <AffiliateRewardsCard
            user={user}
            affiliateLink='https://example.com/register?aff=abc'
            onTransfer={() => undefined}
            {...props}
          />
        </TooltipProvider>
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountCard(rendered: RenderedCard) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('affiliate rewards card layout', () => {
  after(() => {
    domWindow.close()
  })

  test('preserves a zero reward percentage returned by the backend', async () => {
    await i18n.changeLanguage('en')
    const rendered = await renderCard({ rewardPercent: 0 })

    const summary = rendered.container.querySelector('[data-referral-summary]')
    assert.ok(summary)
    assert.equal(summary.textContent?.includes('0%'), true)
    assert.equal(summary.textContent?.includes('3%'), false)

    await unmountCard(rendered)
  })

  test('falls back to a three percent reward when the backend omits the rate', async () => {
    await i18n.changeLanguage('en')
    const rendered = await renderCard()

    const summary = rendered.container.querySelector('[data-referral-summary]')
    assert.ok(summary)
    assert.equal(summary.textContent?.includes('3%'), true)

    await unmountCard(rendered)
  })

  test('shows eligible payments instead of the legacy registration count', async () => {
    await i18n.changeLanguage('en')
    const rendered = await renderCard({ qualifiedPayments: 2 })

    const rewarded = rendered.container.querySelector(
      '[data-referral-metric="qualified-payments"]'
    )
    assert.ok(rewarded)
    assert.equal(rewarded.textContent?.includes('2'), true)
    assert.equal(rewarded.textContent?.includes('99'), false)

    await unmountCard(rendered)
  })

  test('keeps the referral link and transfer action visible at every balance state', async () => {
    await i18n.changeLanguage('en')
    const withoutRewards = await renderCard()

    const label = withoutRewards.container.querySelector('label')
    const input = withoutRewards.container.querySelector('input')
    const transfer = withoutRewards.container.querySelector(
      '[data-referral-transfer]'
    ) as HTMLButtonElement | null

    assert.ok(label)
    assert.ok(input)
    assert.ok(transfer)
    assert.equal(label.textContent, 'Your Referral Link')
    assert.equal(label.htmlFor, input.id)
    assert.equal(transfer.disabled, true)

    await unmountCard(withoutRewards)

    const withRewards = await renderCard({
      user: { ...user, aff_quota: 10_000 },
    })
    const enabledTransfer = withRewards.container.querySelector(
      '[data-referral-transfer]'
    ) as HTMLButtonElement | null

    assert.ok(enabledTransfer)
    assert.equal(enabledTransfer.disabled, false)

    await unmountCard(withRewards)
  })

  test('renders the full Chinese rules without truncation classes', async () => {
    await i18n.changeLanguage('zh')
    const rendered = await renderCard({
      rewardPercent: 3,
      qualifiedPayments: 1,
    })

    const rules = rendered.container.querySelector('[data-referral-rules]')
    assert.ok(rules)
    assert.equal(rules.textContent?.includes('订单实付金额 × 3%'), true)
    assert.equal(
      rules.textContent?.includes('注册赠送（如有）与推荐返利相互独立'),
      true
    )
    assert.equal(
      rules.textContent?.includes(
        '充值面额、优惠前金额及不支持的结算币种均不作为计算基数'
      ),
      true
    )

    const clippedElements = rendered.container.querySelectorAll(
      '[class*="truncate"], [class*="line-clamp"]'
    )
    assert.equal(clippedElements.length, 0)

    for (const paragraph of rendered.container.querySelectorAll(
      '[data-referral-summary], [data-referral-rules] p'
    )) {
      assert.equal(paragraph.classList.contains('whitespace-normal'), true)
      assert.equal(paragraph.classList.contains('break-words'), true)
    }

    await unmountCard(rendered)
  })

  test('keeps the referral rules translated in every supported Chinese locale', () => {
    const keys = [
      'Invite friends and earn {{rewardRate}} of the amount they actually pay on every eligible top-up.',
      'How referral rewards work',
      'Referral reward = checkout amount actually paid after all discounts × {{rewardRate}}',
      'Invitees must register through your referral link. Registration rewards, if any, are separate; referral rewards begin only after an eligible payment is confirmed.',
      'Only the payment processor-confirmed amount actually paid in a supported fiat currency is used. The top-up face value, pre-discount amount, and unsupported settlement currencies are not used as the reward basis.',
      'Eligible payments',
      'Number of eligible referred payments',
      'Your Referral Link',
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
