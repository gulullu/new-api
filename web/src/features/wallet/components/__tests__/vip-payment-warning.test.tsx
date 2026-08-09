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

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLAnchorElement',
  'HTMLButtonElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MouseEvent',
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

const supportedLocales: SupportedLocale[] = [
  'en',
  'zh',
  'zh-TW',
  'fr',
  'ja',
  'ru',
  'vi',
]

async function loadLocale(locale: SupportedLocale) {
  const source = await readFile(
    new URL(`../../../../i18n/locales/${locale}.json`, import.meta.url),
    'utf8'
  )
  return JSON.parse(source) as LocaleResource
}

const localeEntries = await Promise.all(
  supportedLocales.map(async (locale) => [locale, await loadLocale(locale)])
)
const resources = Object.fromEntries(localeEntries) as Record<
  SupportedLocale,
  LocaleResource
>

const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { PAYMENT_TYPES } = await import('../../constants')
const { RelayBasesVipPaymentActions, RelayBasesVipPaymentNotice } =
  await import('../relaybases-vip-payment-warning')
const {
  RELAYBASES_SUPPORT_URL,
  resolveRelayBasesVipPaymentUserGroup,
  shouldShowRelayBasesVipPaymentWarning,
} = await import('../../relaybases-vip-payment-warning-policy')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources,
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type RenderedWarning = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderWarning(options?: {
  processing?: boolean
  onContactSupport?: () => void
  onContinue?: () => void
}): Promise<RenderedWarning> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <RelayBasesVipPaymentNotice />
        <RelayBasesVipPaymentActions
          processing={options?.processing ?? false}
          onContactSupport={options?.onContactSupport ?? (() => undefined)}
          onContinue={options?.onContinue ?? (() => undefined)}
        />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountWarning(rendered: RenderedWarning) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('RelayBases VIP payment warning', () => {
  after(() => {
    domWindow.close()
  })

  test('uses exact VIP and overseas payment type matching', () => {
    assert.equal(
      shouldShowRelayBasesVipPaymentWarning('vip', PAYMENT_TYPES.STRIPE),
      true
    )
    assert.equal(
      shouldShowRelayBasesVipPaymentWarning('vip', PAYMENT_TYPES.WAFFO),
      true
    )
    assert.equal(
      shouldShowRelayBasesVipPaymentWarning('vip', PAYMENT_TYPES.WAFFO_PANCAKE),
      true
    )

    for (const [group, paymentType] of [
      ['VIP', PAYMENT_TYPES.STRIPE],
      ['vip ', PAYMENT_TYPES.STRIPE],
      ['default', PAYMENT_TYPES.STRIPE],
      ['vip', PAYMENT_TYPES.ALIPAY],
      ['vip', PAYMENT_TYPES.WECHAT],
      ['vip', PAYMENT_TYPES.CREEM],
      [undefined, PAYMENT_TYPES.STRIPE],
      ['vip', undefined],
    ] as const) {
      assert.equal(
        shouldShowRelayBasesVipPaymentWarning(group, paymentType),
        false
      )
    }
  })

  test('falls back to the authenticated VIP group while wallet data loads', () => {
    assert.equal(resolveRelayBasesVipPaymentUserGroup(undefined, 'vip'), 'vip')
    assert.equal(
      shouldShowRelayBasesVipPaymentWarning(
        resolveRelayBasesVipPaymentUserGroup(undefined, 'vip'),
        PAYMENT_TYPES.STRIPE
      ),
      true
    )
    assert.equal(
      resolveRelayBasesVipPaymentUserGroup('default', 'vip'),
      'default'
    )
  })

  test('shows clear support and continue choices without truncating copy', async () => {
    await i18n.changeLanguage('en')
    let supportClicks = 0
    let continueClicks = 0
    const rendered = await renderWarning({
      onContactSupport: () => supportClicks++,
      onContinue: () => continueClicks++,
    })

    const notice = rendered.container.querySelector(
      '[data-relaybases-vip-payment-warning]'
    )
    const support = rendered.container.querySelector(
      '[data-relaybases-vip-contact-support]'
    ) as HTMLAnchorElement | null
    const continueButton = rendered.container.querySelector(
      '[data-relaybases-vip-continue]'
    ) as HTMLButtonElement | null
    const footer = rendered.container.querySelector(
      '[data-slot="alert-dialog-footer"]'
    )

    assert.ok(notice)
    assert.equal(notice.getAttribute('role'), 'note')
    assert.equal(notice.textContent?.includes('VIP payment option'), true)
    assert.equal(
      notice.textContent?.includes('including any public discount'),
      true
    )
    assert.equal(notice.querySelector('[class*="truncate"]'), null)
    assert.equal(notice.querySelector('[class*="line-clamp"]'), null)

    assert.ok(support)
    assert.equal(support.href, RELAYBASES_SUPPORT_URL)
    assert.equal(support.target, '_blank')
    assert.equal(support.rel, 'noopener noreferrer')
    assert.equal(support.classList.contains('whitespace-normal'), true)
    assert.ok(continueButton)
    assert.equal(continueButton.classList.contains('whitespace-normal'), true)
    assert.ok(footer)
    assert.equal(footer.classList.contains('grid-cols-1'), true)
    assert.equal(footer.classList.contains('sm:grid-cols-2'), true)

    support.addEventListener('click', (event) => event.preventDefault(), {
      capture: true,
    })
    await act(async () => support.click())
    await act(async () => continueButton.click())
    assert.equal(supportClicks, 1)
    assert.equal(continueClicks, 1)

    await unmountWarning(rendered)
  })

  test('prevents both choices while a payment is being processed', async () => {
    await i18n.changeLanguage('en')
    let supportClicks = 0
    let continueClicks = 0
    const rendered = await renderWarning({
      processing: true,
      onContactSupport: () => supportClicks++,
      onContinue: () => continueClicks++,
    })

    const support = rendered.container.querySelector(
      '[data-relaybases-vip-contact-support]'
    ) as HTMLAnchorElement
    const continueButton = rendered.container.querySelector(
      '[data-relaybases-vip-continue]'
    ) as HTMLButtonElement

    assert.equal(support.getAttribute('aria-disabled'), 'true')
    assert.equal(support.tabIndex, -1)
    assert.equal(continueButton.disabled, true)

    support.addEventListener('click', (event) => event.preventDefault(), {
      capture: true,
    })
    await act(async () => support.click())
    await act(async () => continueButton.click())
    assert.equal(supportClicks, 0)
    assert.equal(continueClicks, 0)

    await unmountWarning(rendered)
  })

  test('provides complete translations in all supported locales', () => {
    const keys = [
      'VIP payment option',
      'Your account is eligible for the VIP 20% top-up discount. Because Stripe and Waffo use overseas payment channels with higher processing fees, this discount is not applied automatically.',
      'Contact support to top up at the VIP rate. If you continue, you will pay the amount shown above, including any public discount already displayed, but without the VIP discount.',
      'Contact support for the VIP discount',
      'Continue without the VIP discount',
    ]

    for (const locale of supportedLocales) {
      for (const key of keys) {
        const value = resources[locale].translation[key]
        assert.equal(typeof value, 'string', `${locale} is missing ${key}`)
        assert.notEqual(value.trim(), '', `${locale} has an empty ${key}`)
        if (locale !== 'en') {
          assert.notEqual(
            value,
            key,
            `${locale} falls back to English for ${key}`
          )
        }
      }
    }

    assert.equal(
      resources.zh.translation['Contact support for the VIP discount'],
      '联系客服享受 8 折'
    )
    assert.equal(
      resources.zh.translation['Continue without the VIP discount'],
      '继续支付（不享 VIP 8 折）'
    )
  })
})
