/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

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

import en from '@/features/relaybases/i18n/locales/en.json'
import fr from '@/features/relaybases/i18n/locales/fr.json'
import ja from '@/features/relaybases/i18n/locales/ja.json'
import ru from '@/features/relaybases/i18n/locales/ru.json'
import vi from '@/features/relaybases/i18n/locales/vi.json'
import zhTW from '@/features/relaybases/i18n/locales/zh-TW.json'
import zhCN from '@/features/relaybases/i18n/locales/zh.json'

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

const React = await import('react')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { PartnerRules } = await import('../..')

const localeResources = {
  en: { relaybases: en },
  zhCN: { relaybases: zhCN },
  zhTW: { relaybases: zhTW },
  fr: { relaybases: fr },
  ja: { relaybases: ja },
  ru: { relaybases: ru },
  vi: { relaybases: vi },
}

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'zhCN',
  fallbackLng: 'en',
  resources: localeResources,
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

async function renderRules() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <PartnerRules />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountRules(rendered: Awaited<ReturnType<typeof renderRules>>) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('partner rules layout', () => {
  after(() => {
    domWindow.close()
  })

  test('starts expanded with icon-led rule cards and no numbered markers', async () => {
    const rendered = await renderRules()
    const details = rendered.container.querySelector('details')
    const rows = [...rendered.container.querySelectorAll('li')]
    const labels = [
      ...rendered.container.querySelectorAll('[data-partner-rule-label]'),
    ]
    const icons = [...rendered.container.querySelectorAll('li svg')]

    assert.ok(details)
    assert.equal(details.open, true)
    assert.equal(rows.length, 8)
    assert.equal(labels.length, 8)
    assert.equal(icons.length, 8)
    assert.equal(
      rows.some((row) => /^\d{1,2}$/.test(row.textContent?.trim() ?? '')),
      false
    )
    assert.equal(
      new Set(labels.map((label) => label.textContent?.trim())).size,
      8
    )
    assert.ok(
      details.textContent?.includes(zhCN.partner.rules.description),
      'Chinese rules description should be rendered'
    )

    await unmountRules(rendered)
  })

  test('keeps the expanded rules available in every supported locale', async () => {
    for (const locale of Object.keys(localeResources)) {
      await i18n.changeLanguage(locale)
      const rendered = await renderRules()
      const details = rendered.container.querySelector('details')
      const rows = rendered.container.querySelectorAll('li')
      const labels = rendered.container.querySelectorAll(
        '[data-partner-rule-label]'
      )

      assert.ok(details, locale)
      assert.equal(details.open, true, locale)
      assert.equal(rows.length, 8, locale)
      assert.equal(labels.length, 8, locale)
      assert.ok(
        [...labels].every((label) => label.textContent?.trim()),
        locale
      )

      await unmountRules(rendered)
    }
  })
})
