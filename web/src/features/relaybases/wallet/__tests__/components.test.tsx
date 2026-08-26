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

import mainEn from '../../../../i18n/locales/en.json'
import mainZhCN from '../../../../i18n/locales/zh.json'
import type { TopupInfo } from '../../../wallet/types'
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
const { getRelayBasesPaymentMethodInteractionKey } = await import('../policy')
const { RechargeFormCard } =
  await import('../../../wallet/components/recharge-form-card')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'zhCN',
  fallbackLng: 'en',
  nsSeparator: false,
  resources: {
    en: { translation: mainEn.translation, relaybases: en },
    zhCN: { translation: mainZhCN.translation, relaybases: zhCN },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

async function renderWalletComponents(
  topupAmount: number,
  selectedPaymentType?: string,
  paymentLoading: string | null = null
) {
  await i18n.changeLanguage('zhCN')
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const methods = [
    { name: 'Waffo Pancake', type: 'waffo_pancake', min_topup: 20 },
    { name: 'Stripe', type: 'stripe', min_topup: 20 },
  ]

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <RelayBasesPaymentMethodGrid
          methods={methods}
          baseMinimum={20}
          topupAmount={topupAmount}
          paymentLoading={paymentLoading}
          selectedPaymentMethod={
            methods.find((method) => method.type === selectedPaymentType) ??
            null
          }
          onSelect={() => undefined}
        />
        <RelayBasesCreditsNotice />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function renderLegacyWaffoSelection() {
  await i18n.changeLanguage('en')
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const topupInfo: TopupInfo = {
    enable_online_topup: false,
    enable_stripe_topup: false,
    pay_methods: [],
    min_topup: 20,
    stripe_min_topup: 20,
    amount_options: [],
    discount: {},
    enable_waffo_topup: true,
    waffo_min_topup: 20,
  }

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <RechargeFormCard
          topupInfo={topupInfo}
          presetAmounts={[]}
          selectedPreset={null}
          onSelectPreset={() => undefined}
          topupAmount={20}
          onTopupAmountChange={() => undefined}
          paymentAmount={2.85}
          calculating={false}
          onPaymentMethodSelect={() => undefined}
          paymentLoading={null}
          selectedPaymentMethod={{ name: 'Channel B', type: 'waffo' }}
          selectedWaffoMethodIndex={1}
          redemptionCode=''
          onRedemptionCodeChange={() => undefined}
          onRedeem={() => undefined}
          redeeming={false}
          enableWaffoTopup
          waffoPayMethods={[{ name: 'Channel A' }, { name: 'Channel B' }]}
          waffoMinTopup={20}
          onWaffoMethodSelect={() => undefined}
        />
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

  test('uses official buttons with Chinese gateway display names and icons', async () => {
    const rendered = await renderWalletComponents(20)
    const buttons = [...rendered.container.querySelectorAll('button')]

    assert.equal(buttons.length, 2)
    const alipayButton = buttons.find(
      (button) => button.getAttribute('aria-label') === '支付宝'
    )
    const wechatButton = buttons.find(
      (button) => button.getAttribute('aria-label') === '微信支付'
    )
    assert.ok(alipayButton)
    assert.ok(wechatButton)
    assert.match(alipayButton.textContent ?? '', /支付宝/)
    assert.match(wechatButton.textContent ?? '', /微信支付/)
    assert.ok(alipayButton.querySelector('svg'), 'Alipay icon is rendered')
    assert.ok(wechatButton.querySelector('svg'), 'WeChat icon is rendered')
    assert.equal(alipayButton.querySelector('[title="支付宝"]') !== null, true)
    assert.equal(
      wechatButton.querySelector('[title="微信支付"]') !== null,
      true
    )
    assert.match(alipayButton.className ?? '', /rounded-lg/)
    assert.match(alipayButton.className ?? '', /min-h-14/)
    assert.match(wechatButton.className ?? '', /min-h-14/)
    assert.equal(
      buttons.every((button) => !button.textContent?.includes('去支付')),
      true
    )

    const docs = rendered.container.querySelector('a[href*="#zh-credits"]')
    const refund = rendered.container.querySelector('a[href*="refund"]')
    assert.ok(docs)
    assert.ok(refund)

    await unmount(rendered)
  })

  test('keeps payment cards as actions instead of pressed tabs', async () => {
    const rendered = await renderWalletComponents(20, 'waffo_pancake')
    const buttons = [...rendered.container.querySelectorAll('button')]

    assert.equal(buttons[0]?.getAttribute('aria-pressed'), null)
    assert.equal(buttons[1]?.getAttribute('aria-pressed'), null)
    assert.doesNotMatch(buttons[1]?.className ?? '', /ring-slate-900\/15/)
    assert.equal(buttons[1]?.querySelector('svg.lucide-check'), null)
    assert.equal(
      buttons.every((button) => !button.textContent?.includes('去支付')),
      true
    )

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
      buttons.every((button) => button.textContent?.includes('最低： 20')),
      true
    )
    assert.equal(
      buttons.every((button) => button.title?.includes('最低充值金额：20')),
      true
    )
    const tooltipTriggers = [
      ...rendered.container.querySelectorAll(
        '[data-base-ui-tooltip-trigger][tabindex="0"]'
      ),
    ]
    assert.equal(tooltipTriggers.length, 2)
    assert.equal(
      tooltipTriggers.every((trigger) =>
        trigger.getAttribute('aria-label')?.includes('最低充值金额：20')
      ),
      true
    )
    assert.equal(
      buttons.every((button) => button.getAttribute('aria-pressed') === null),
      true
    )
    assert.equal(
      buttons.every((button) => !button.querySelector('svg.lucide-check')),
      true
    )

    await unmount(rendered)
  })

  test('shows loading state only on the exact method when types repeat', async () => {
    const customA = { name: 'Custom A', type: 'custom1', min_topup: 20 }
    const customB = { name: 'Custom B', type: 'custom1', min_topup: 20 }
    const methods = [customA, customB]
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <RelayBasesPaymentMethodGrid
            methods={methods}
            baseMinimum={20}
            topupAmount={20}
            paymentLoading={getRelayBasesPaymentMethodInteractionKey(customB)}
            selectedPaymentMethod={customB}
            onSelect={() => undefined}
          />
        </I18nextProvider>
      )
    })

    const buttons = [...container.querySelectorAll('button')]
    assert.equal(buttons[0]?.getAttribute('aria-busy'), 'false')
    assert.equal(buttons[1]?.getAttribute('aria-busy'), 'true')
    assert.equal(buttons[0]?.getAttribute('aria-pressed'), null)
    assert.equal(buttons[1]?.getAttribute('aria-pressed'), null)
    assert.equal(buttons[0]?.querySelector('svg.animate-spin'), null)
    assert.ok(buttons[1]?.querySelector('svg.animate-spin'))

    await unmount({ container, root })
  })

  test('keeps legacy Waffo submethods as official actions after quoting', async () => {
    const rendered = await renderLegacyWaffoSelection()
    const channelA = rendered.container.querySelector(
      'button[aria-label*="Channel A"]'
    )
    const channelB = rendered.container.querySelector(
      'button[aria-label*="Channel B"]'
    )

    assert.equal(channelA?.getAttribute('aria-pressed'), null)
    assert.equal(channelB?.getAttribute('aria-pressed'), null)
    assert.equal(channelB?.querySelector('svg.lucide-check'), null)
    assert.equal(channelB?.textContent?.includes('Channel B'), true)

    await unmount(rendered)
  })
})
