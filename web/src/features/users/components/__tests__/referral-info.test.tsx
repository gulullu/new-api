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

import type { User } from '../../types'

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
const { UserReferralInfoCell } = await import('../user-referral-info-cell')

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

const user: User = {
  id: 8,
  username: 'referrer',
  display_name: 'Referrer',
  quota: 0,
  used_quota: 0,
  request_count: 0,
  group: 'default',
  status: 1,
  role: 1,
  aff_count: 99,
  qualified_referral_invitees: 2,
  qualified_referral_payments: 88,
  aff_history_quota: 1_500_000,
  inviter_id: 7,
}

async function renderCell(item: User) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <TooltipProvider>
          <UserReferralInfoCell user={item} />
        </TooltipProvider>
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountCell(rendered: Awaited<ReturnType<typeof renderCell>>) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('user referral information', () => {
  after(() => {
    domWindow.close()
  })

  test('uses distinct successful referrals instead of legacy counters', async () => {
    await i18n.changeLanguage('en')
    const rendered = await renderCell(user)
    const referralInfo = rendered.container.querySelector(
      '[data-user-referral-info]'
    )

    assert.ok(referralInfo)
    assert.equal(
      referralInfo.textContent?.includes('Successful referrals: 2'),
      true
    )
    assert.equal(referralInfo.textContent?.includes('99'), false)
    assert.equal(referralInfo.textContent?.includes('88'), false)
    assert.equal(referralInfo.textContent?.includes('Rewards'), true)
    assert.equal(referralInfo.textContent?.includes('Revenue'), false)
    assert.equal(referralInfo.textContent?.includes('Inviter #7'), true)
    assert.equal(referralInfo.classList.contains('flex-wrap'), true)

    await unmountCell(rendered)
  })

  test('uses the same compact count label for one successful referral', async () => {
    await i18n.changeLanguage('en')
    const rendered = await renderCell({
      ...user,
      qualified_referral_invitees: 1,
    })

    assert.equal(
      rendered.container.textContent?.includes('Successful referrals: 1'),
      true
    )

    await unmountCell(rendered)
  })

  test('keeps referral metrics but omits the inviter badge when absent', async () => {
    await i18n.changeLanguage('en')
    const rendered = await renderCell({ ...user, inviter_id: 0 })
    const text = rendered.container.textContent ?? ''

    assert.equal(text.includes('Successful referrals: 2'), true)
    assert.equal(text.includes('Rewards'), true)
    assert.equal(text.includes('Inviter #'), false)
    assert.equal(text.includes('No Inviter'), false)

    await unmountCell(rendered)
  })

  test('keeps compact referral labels translated in every locale', () => {
    const keys = [
      'Referral',
      'Successful referrals: {{count}}',
      'Invited users whose first top-up earned a reward. Refunded or disputed payments are not counted.',
      'Rewards',
      'Referral rewards earned so far, excluding refunds and disputes.',
      'Inviter #{{id}}',
      'Successful referrals',
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
