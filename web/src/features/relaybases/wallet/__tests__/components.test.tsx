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
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'

import en from '../../i18n/locales/en.json'
import zhCN from '../../i18n/locales/zh.json'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
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

const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { RelayBasesCreditsNotice, RelayBasesPaymentMethodGrid } =
  await import('../index')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'zhCN',
  fallbackLng: 'en',
  resources: {
    en: { relaybases: en },
    zhCN: { relaybases: zhCN },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

async function renderWalletComponents(
  topupAmount: number,
  selectedPaymentType?: string
) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <RelayBasesPaymentMethodGrid
          methods={[
            { name: 'Waffo Pancake', type: 'waffo_pancake', min_topup: 20 },
            { name: 'Stripe', type: 'stripe', min_topup: 20 },
          ]}
          baseMinimum={20}
          topupAmount={topupAmount}
          paymentLoading={null}
          selectedPaymentType={selectedPaymentType}
          onSelect={() => undefined}
        />
        <RelayBasesCreditsNotice />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmount(
  rendered: Awaited<ReturnType<typeof renderWalletComponents>>
) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('RelayBases wallet components', () => {
  after(() => domWindow.close())

  test('orders gateways and exposes Chinese channel guidance', async () => {
    const rendered = await renderWalletComponents(20)
    const buttons = [...rendered.container.querySelectorAll('button')]

    assert.equal(buttons.length, 2)
    assert.match(buttons[0]?.getAttribute('aria-label') ?? '', /Stripe/)
    assert.match(buttons[1]?.getAttribute('aria-label') ?? '', /Waffo Pancake/)
    assert.match(buttons[0]?.textContent ?? '', /支付宝/)
    assert.match(buttons[1]?.textContent ?? '', /微信支付/)
    assert.ok(
      buttons[1]?.querySelector('img[src="/waffo-logo-dark.svg"]'),
      'Waffo uses the bundled white brand mark on the light theme shell'
    )
    assert.ok(
      buttons[1]?.querySelector('img[src="/waffo-logo-light.svg"]'),
      'Waffo keeps a dark-theme brand mark available'
    )
    assert.match(buttons[0]?.className ?? '', /border-2/)
    assert.match(buttons[0]?.className ?? '', /shadow-sm/)
    assert.match(buttons[1]?.className ?? '', /border-2/)

    const docs = rendered.container.querySelector('a[href*="#zh-credits"]')
    const refund = rendered.container.querySelector('a[href*="refund"]')
    assert.ok(docs)
    assert.ok(refund)

    await unmount(rendered)
  })

  test('exposes and emphasizes the selected payment method', async () => {
    const rendered = await renderWalletComponents(20, 'waffo_pancake')
    const buttons = [...rendered.container.querySelectorAll('button')]

    assert.equal(buttons[0]?.getAttribute('aria-pressed'), 'false')
    assert.equal(buttons[1]?.getAttribute('aria-pressed'), 'true')
    assert.doesNotMatch(buttons[0]?.className ?? '', /ring-slate-900\/15/)
    assert.match(buttons[1]?.className ?? '', /ring-slate-900\/15/)
    assert.ok(buttons[1]?.querySelector('svg.lucide-check'))

    await unmount(rendered)
  })

  test('keeps minimum copy visible and both gateways disabled below the floor', async () => {
    const rendered = await renderWalletComponents(19, 'waffo_pancake')
    const buttons = [...rendered.container.querySelectorAll('button')]

    assert.equal(
      buttons.every((button) => button.disabled),
      true
    )
    assert.equal(
      buttons.every((button) => button.textContent?.includes('最低充值 Ɍ20')),
      true
    )
    assert.equal(
      buttons.every((button) =>
        button.className.includes('disabled:opacity-100')
      ),
      true
    )
    assert.equal(
      buttons.every(
        (button) => button.getAttribute('aria-pressed') === 'false'
      ),
      true
    )
    assert.equal(
      buttons.every((button) => !button.querySelector('svg.lucide-check')),
      true
    )

    await unmount(rendered)
  })
})
