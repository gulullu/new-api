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
  relaybases?: Record<string, unknown>
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
const relayBasesEn = JSON.parse(
  await readFile(
    new URL('../../../relaybases/i18n/locales/en.json', import.meta.url),
    'utf8'
  )
) as Record<string, unknown>
const relayBasesZh = JSON.parse(
  await readFile(
    new URL('../../../relaybases/i18n/locales/zh.json', import.meta.url),
    'utf8'
  )
) as Record<string, unknown>
resources.en.relaybases = relayBasesEn
resources.zh.relaybases = relayBasesZh

const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { PAYMENT_TYPES } = await import('../../constants')
const { RelayBasesVipPaymentActions, RelayBasesVipPaymentNotice } =
  await import('../relaybases-vip-payment-warning')
const { PaymentConfirmDialog } =
  await import('../dialogs/payment-confirm-dialog')
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

async function renderPaymentDialog(options: {
  processing?: boolean
  showVipWarning: boolean
  onOpenChange?: (open: boolean) => void
  discountRate?: number
  paymentMethod?: { name: string; type: string; icon?: string }
}) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <PaymentConfirmDialog
          open
          onOpenChange={options.onOpenChange ?? (() => undefined)}
          onConfirm={() => undefined}
          topupAmount={20}
          paymentAmount={2.85}
          paymentMethod={
            options.paymentMethod ?? {
              name: 'Stripe',
              type: PAYMENT_TYPES.STRIPE,
            }
          }
          calculating={false}
          processing={options.processing ?? false}
          discountRate={options.discountRate}
          showRelayBasesVipPaymentWarning={options.showVipWarning}
        />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountPaymentDialog(
  rendered: Awaited<ReturnType<typeof renderPaymentDialog>>
) {
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

  test('shows an accessible top-right close action only for the VIP dialog', async () => {
    await i18n.changeLanguage('en')
    const openChanges: boolean[] = []
    const rendered = await renderPaymentDialog({
      showVipWarning: true,
      onOpenChange: (open) => openChanges.push(open),
    })

    const closeButton = document.querySelector(
      '[data-relaybases-vip-close]'
    ) as HTMLButtonElement | null
    assert.ok(closeButton)
    assert.equal(closeButton.getAttribute('aria-label'), 'Close')
    assert.equal(closeButton.classList.contains('absolute'), true)
    assert.equal(closeButton.classList.contains('top-2'), true)
    assert.equal(closeButton.classList.contains('right-2'), true)
    assert.equal(closeButton.classList.contains('z-10'), true)
    assert.ok(closeButton.querySelector('svg[aria-hidden="true"]'))
    const dialog = document.querySelector('[data-slot="alert-dialog-content"]')
    const scrollArea = document.querySelector('[data-payment-confirm-scroll]')
    assert.ok(dialog)
    assert.ok(scrollArea)
    assert.equal(dialog.classList.contains('overflow-hidden'), true)
    assert.equal(scrollArea.classList.contains('overflow-y-auto'), true)
    assert.equal(closeButton.parentElement, dialog)

    await act(async () => closeButton.click())
    assert.deepEqual(openChanges, [false])
    await unmountPaymentDialog(rendered)

    const regularDialog = await renderPaymentDialog({
      showVipWarning: false,
    })
    assert.equal(document.querySelector('[data-relaybases-vip-close]'), null)
    assert.equal(
      document.querySelector('[data-slot="alert-dialog-cancel"]')?.textContent,
      'Cancel'
    )
    await unmountPaymentDialog(regularDialog)
  })

  test('disables the VIP close action while payment is processing', async () => {
    await i18n.changeLanguage('en')
    const openChanges: boolean[] = []
    const rendered = await renderPaymentDialog({
      processing: true,
      showVipWarning: true,
      onOpenChange: (open) => openChanges.push(open),
    })
    const closeButton = document.querySelector(
      '[data-relaybases-vip-close]'
    ) as HTMLButtonElement

    assert.equal(closeButton.disabled, true)
    await act(async () => closeButton.click())
    assert.deepEqual(openChanges, [])

    await unmountPaymentDialog(rendered)
  })

  test('keeps Chinese payment branding and approximate CNY aligned in the confirmation dialog', async () => {
    await i18n.changeLanguage('zh')
    const rendered = await renderPaymentDialog({
      showVipWarning: false,
      discountRate: 0.9,
    })

    const dialog = document.querySelector('[data-slot="alert-dialog-content"]')
    const paymentMethod = dialog?.textContent ?? ''
    const approximate = dialog?.querySelector('[data-payment-approx-cny]')

    assert.match(paymentMethod, /支付宝/)
    assert.doesNotMatch(paymentMethod, /Stripe/)
    assert.ok(approximate)
    assert.equal(approximate?.textContent, '约合￥18.00')
    assert.doesNotMatch(approximate?.textContent ?? '', /¥￥/)

    await unmountPaymentDialog(rendered)

    await i18n.changeLanguage('zh')
    const waffo = await renderPaymentDialog({
      showVipWarning: false,
      paymentMethod: {
        name: 'Waffo Pancake',
        type: PAYMENT_TYPES.WAFFO_PANCAKE,
      },
    })
    const waffoDialog = document.querySelector(
      '[data-slot="alert-dialog-content"]'
    )
    assert.match(waffoDialog?.textContent ?? '', /微信支付/)
    assert.doesNotMatch(waffoDialog?.textContent ?? '', /Waffo Pancake/)
    await unmountPaymentDialog(waffo)

    await i18n.changeLanguage('en')
    const english = await renderPaymentDialog({ showVipWarning: false })
    const englishDialog = document.querySelector(
      '[data-slot="alert-dialog-content"]'
    )
    assert.match(englishDialog?.textContent ?? '', /Stripe/)
    assert.equal(
      englishDialog?.querySelector('[data-payment-approx-cny]'),
      null
    )
    await unmountPaymentDialog(english)
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
    assert.equal(notice.textContent?.includes('VIP discount'), true)
    assert.equal(
      notice.textContent?.includes(
        'This payment does not include your VIP discount.'
      ),
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
      'VIP discount',
      'This payment does not include your VIP discount. Contact support for VIP pricing.',
      'Contact support',
      'Continue payment',
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

    assert.equal(resources.zh.translation['Contact support'], '联系客服')
    assert.equal(resources.zh.translation['VIP discount'], 'VIP 优惠')
    assert.equal(resources.zh.translation['Continue payment'], '继续支付')
    assert.deepEqual(
      Object.fromEntries(
        supportedLocales.map((locale) => [
          locale,
          resources[locale].translation['Continue payment'],
        ])
      ),
      {
        en: 'Continue',
        zh: '继续支付',
        'zh-TW': '繼續付款',
        fr: 'Continuer',
        ja: '続行',
        ru: 'Продолжить',
        vi: 'Tiếp tục',
      }
    )
  })
})
