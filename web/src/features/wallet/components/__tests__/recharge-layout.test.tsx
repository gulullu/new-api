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

const [mainLocaleSource, relayBasesLocaleSource] = await Promise.all([
  readFile(
    new URL('../../../../i18n/locales/en.json', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../../../relaybases/i18n/locales/en.json', import.meta.url),
    'utf8'
  ),
])
const mainLocale = JSON.parse(mainLocaleSource) as {
  translation: Record<string, string>
}
const relayBasesLocale = JSON.parse(relayBasesLocaleSource) as Record<
  string,
  unknown
>

const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { RechargeFormCard } = await import('../recharge-form-card')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['translation', 'relaybases'],
  defaultNS: 'translation',
  resources: {
    en: {
      translation: mainLocale.translation,
      relaybases: relayBasesLocale,
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

const defaultProps: ComponentProps<typeof RechargeFormCard> = {
  topupInfo: {
    enable_online_topup: false,
    enable_stripe_topup: true,
    pay_methods: [],
    min_topup: 20,
    stripe_min_topup: 20,
    amount_options: [20, 100],
    discount: { 100: 0.9 },
    enable_redemption: false,
  },
  presetAmounts: [{ value: 20 }, { value: 100 }],
  selectedPreset: null,
  onSelectPreset: () => undefined,
  topupAmount: 20,
  onTopupAmountChange: () => undefined,
  paymentAmount: 2.85,
  calculating: false,
  onPaymentMethodSelect: () => undefined,
  paymentLoading: null,
  redemptionCode: '',
  onRedemptionCodeChange: () => undefined,
  onRedeem: () => undefined,
  redeeming: false,
  priceRatio: 0.1425,
}

type RenderedCard = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderCard(): Promise<RenderedCard> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <RechargeFormCard {...defaultProps} />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountCard(rendered: RenderedCard) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('recharge form compact pricing layout', () => {
  after(() => {
    domWindow.close()
  })

  test('shows only the compact dollar amount when a preset has no discount', async () => {
    const rendered = await renderCard()

    const price = rendered.container.querySelector(
      '[data-topup-preset-value="20"] [data-topup-preset-price]'
    )
    assert.ok(price)
    assert.equal(price.textContent?.trim(), '$2.85')
    assert.doesNotMatch(price.textContent ?? '', /USD|Pay|Save/)
    assert.equal(
      rendered.container.querySelector(
        '[data-topup-preset-value="20"] [data-topup-discount-badge]'
      ),
      null
    )

    await unmountCard(rendered)
  })

  test('shows original and sale prices without the legacy pay and savings copy', async () => {
    const rendered = await renderCard()

    const card = rendered.container.querySelector(
      '[data-topup-preset-value="100"]'
    )
    const original = card?.querySelector('[data-topup-original-price]')
    const discounted = card?.querySelector('[data-topup-discounted-price]')
    const badge = card?.querySelector('[data-topup-discount-badge]')
    assert.ok(card)
    assert.equal(original?.textContent?.trim(), 'Original $14.25')
    assert.equal(discounted?.textContent?.trim(), 'Sale $12.83')
    assert.equal(badge?.textContent?.trim(), '-10%')
    assert.match(badge?.className ?? '', /absolute/)
    assert.match(badge?.className ?? '', /top-2/)
    assert.match(badge?.className ?? '', /right-2/)
    assert.doesNotMatch(card.textContent ?? '', /USD|Pay|Save|•/)
    assert.doesNotMatch(card.textContent ?? '', /\//)

    await unmountCard(rendered)
  })

  test('uses a single-column fallback below 360px with taller preset cards', async () => {
    const rendered = await renderCard()

    const grid = rendered.container.querySelector('[data-topup-preset-grid]')
    const cards = rendered.container.querySelectorAll(
      '[data-topup-preset-value]'
    )
    assert.ok(grid)
    assert.match(grid.className, /grid-cols-1/)
    assert.match(grid.className, /min-\[360px\]:grid-cols-2/)
    assert.equal(cards.length, 2)
    for (const card of cards) {
      assert.match(card.className, /min-h-\[84px\]/)
      assert.match(card.className, /py-4/)
      assert.match(card.className, /relative/)
      assert.match(card.className, /min-w-0/)
      assert.match(card.className, /max-w-full/)
      assert.match(card.className, /overflow-hidden/)
    }

    await unmountCard(rendered)
  })

  test('keeps the custom payment summary untruncated on a 320px layout', async () => {
    const rendered = await renderCard()

    const row = rendered.container.querySelector('[data-topup-custom-row]')
    const summary = rendered.container.querySelector(
      '[data-topup-custom-payment-summary]'
    )
    const label = rendered.container.querySelector(
      '[data-topup-custom-payment-label]'
    )
    const value = rendered.container.querySelector(
      '[data-topup-custom-payment-value]'
    )
    assert.ok(row)
    assert.ok(summary)
    assert.match(row.className, /grid-cols-1/)
    assert.equal(label?.textContent?.trim(), 'Pay')
    assert.equal(value?.textContent?.trim(), '$2.85')
    assert.doesNotMatch(label?.className ?? '', /truncate|ellipsis/)
    assert.doesNotMatch(value?.className ?? '', /truncate|ellipsis/)

    await unmountCard(rendered)
  })
})
