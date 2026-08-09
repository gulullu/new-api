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

type SupportedLocale = 'en' | 'zh' | 'zh-TW' | 'fr' | 'ja' | 'ru' | 'vi'

async function loadLocale(locale: SupportedLocale) {
  const source = await readFile(
    new URL(`../../../../i18n/locales/${locale}.json`, import.meta.url),
    'utf8'
  )
  return JSON.parse(source) as LocaleResource
}

const [en, zh, zhTW, fr, ja, ru, vi] = await Promise.all([
  loadLocale('en'),
  loadLocale('zh'),
  loadLocale('zh-TW'),
  loadLocale('fr'),
  loadLocale('ja'),
  loadLocale('ru'),
  loadLocale('vi'),
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
  resources: { en, zh, 'zh-TW': zhTW, fr, ja, ru, vi },
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

  test('shows distinct eligible invitees instead of the legacy registration count', async () => {
    await i18n.changeLanguage('en')
    const rendered = await renderCard({ qualifiedInvitees: 2 })

    const rewarded = rendered.container.querySelector(
      '[data-referral-metric="eligible-invitees"]'
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

  test('keeps full Chinese rules collapsed and readable', async () => {
    await i18n.changeLanguage('zh')
    const rendered = await renderCard({
      rewardPercent: 3,
      qualifiedInvitees: 1,
      showRuleDetails: true,
    })

    const summary = rendered.container.querySelector('[data-referral-summary]')
    const transferNote = rendered.container.querySelector(
      '[data-referral-transfer-note]'
    )
    const rules = rendered.container.querySelector(
      '[data-referral-rules]'
    ) as HTMLDetailsElement | null
    assert.ok(summary)
    assert.ok(transferNote)
    assert.ok(rules)
    assert.equal(rules.open, false)
    assert.equal(summary.textContent?.includes('优惠后实付金额返利 3%'), true)
    assert.equal(transferNote.textContent?.includes('确认后可转入余额'), true)
    assert.equal(
      rules.textContent?.includes('仅受邀用户首笔已验签实付充值可获返利'),
      true
    )
    assert.equal(rules.textContent?.includes('不按充值面额或优惠前金额'), true)

    const clippedElements = rendered.container.querySelectorAll(
      '[class*="truncate"], [class*="line-clamp"]'
    )
    assert.equal(clippedElements.length, 0)

    for (const paragraph of rendered.container.querySelectorAll(
      '[data-referral-summary], [data-referral-transfer-note], [data-referral-rules] li'
    )) {
      assert.equal(paragraph.classList.contains('whitespace-normal'), true)
      assert.equal(paragraph.classList.contains('break-words'), true)
    }

    await unmountCard(rendered)
  })

  test('keeps the wallet card compact when rule details are not requested', async () => {
    await i18n.changeLanguage('en')
    const rendered = await renderCard()

    assert.equal(
      rendered.container.querySelector('[data-referral-rules]'),
      null
    )
    assert.ok(rendered.container.querySelector('[data-referral-summary]'))
    assert.ok(rendered.container.querySelector('[data-referral-transfer-note]'))

    await unmountCard(rendered)
  })

  test('keeps the referral rules translated in every supported locale', () => {
    const keys = [
      'First verified paid top-up: {{rewardRate}} of the amount paid after discounts.',
      'Eligible invitees',
      'Confirmed rewards can be transferred to your balance.',
      'Full referral rules',
      'New users still receive registration credit. Inviting alone earns no reward.',
      "Only the invitee's first verified paid top-up can earn a reward; later top-ups do not, even if the first was ineligible.",
      'Rewards use only the processor-confirmed amount paid after discounts in a supported currency, not the top-up value or pre-discount price.',
      'Your Referral Link',
    ]

    const resources = [en, zh, zhTW, fr, ja, ru, vi]
    for (const key of keys) {
      for (const resource of resources) {
        assert.equal(typeof resource.translation[key], 'string')
      }
      for (const resource of resources.slice(1)) {
        assert.notEqual(resource.translation[key], key)
      }
    }
  })
})
