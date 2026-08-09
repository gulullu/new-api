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

import type { UserInfo } from '../../types'

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
  'KeyboardEvent',
  'PointerEvent',
  'MouseEvent',
  'FocusEvent',
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
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { api } = await import('@/lib/api')
const { UserInfoDialog } = await import('../dialogs/user-info-dialog')

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

type ApiMethod = (url: string) => Promise<{ data: unknown }>
type MockableApi = { get: ApiMethod }
type RenderedDialog = {
  host: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
let userFixture: UserInfo

apiClient.get = async (url) => {
  assert.equal(url, '/api/user/7')
  return { data: { success: true, data: userFixture } }
}

function createUserFixture(overrides: Partial<UserInfo>): UserInfo {
  return {
    id: 7,
    username: 'referrer',
    quota: 0,
    used_quota: 0,
    request_count: 0,
    ...overrides,
  }
}

async function waitForText(text: string): Promise<void> {
  if (document.body.textContent?.includes(text)) return

  await new Promise<void>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!document.body.textContent?.includes(text)) return
      clearTimeout(timeoutId)
      observer.disconnect()
      resolve()
    })
    const timeoutId = setTimeout(() => {
      observer.disconnect()
      reject(new Error(`Missing text ${text}: ${document.body.textContent}`))
    }, 1500)

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    })
  })
}

async function renderDialog(fixture: UserInfo): Promise<RenderedDialog> {
  userFixture = fixture
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <UserInfoDialog userId={7} open onOpenChange={() => undefined} />
      </I18nextProvider>
    )
  })
  await act(async () => waitForText('Successful referrals'))

  return { host, root }
}

async function unmountDialog(rendered: RenderedDialog) {
  await act(async () => rendered.root.unmount())
  rendered.host.remove()
}

describe('usage-log user information dialog', () => {
  after(() => {
    apiClient.get = originalGet
    domWindow.close()
  })

  test('prefers the distinct eligible-invitee field over the legacy alias', async () => {
    const rendered = await renderDialog(
      createUserFixture({
        qualified_referral_invitees: 2,
        qualified_referral_payments: 88,
      })
    )
    const text = document.body.textContent ?? ''

    assert.equal(text.includes('Successful referrals'), true)
    assert.equal(text.includes('Invitee payments'), false)
    assert.match(text, /Successful referrals\s*2/)
    assert.equal(text.includes('88'), false)

    await unmountDialog(rendered)
  })

  test('uses the legacy alias only for older server responses', async () => {
    const rendered = await renderDialog(
      createUserFixture({ qualified_referral_payments: 3 })
    )
    const text = document.body.textContent ?? ''

    assert.match(text, /Successful referrals\s*3/)
    assert.equal(text.includes('Invitee payments'), false)

    await unmountDialog(rendered)
  })

  test('translates the dialog label in every supported locale', () => {
    const resources = [en, zh, zhTW, fr, ja, ru, vi]

    for (const resource of resources) {
      assert.equal(
        typeof resource.translation['Successful referrals'],
        'string'
      )
    }
    for (const resource of resources.slice(1)) {
      assert.notEqual(
        resource.translation['Successful referrals'],
        'Successful referrals'
      )
    }
  })
})
