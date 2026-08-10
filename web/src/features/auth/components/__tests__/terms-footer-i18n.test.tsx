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

import relayEn from '@/features/relaybases/i18n/locales/en.json'
import relayFr from '@/features/relaybases/i18n/locales/fr.json'
import relayJa from '@/features/relaybases/i18n/locales/ja.json'
import relayRu from '@/features/relaybases/i18n/locales/ru.json'
import relayVi from '@/features/relaybases/i18n/locales/vi.json'
import relayZhTW from '@/features/relaybases/i18n/locales/zh-TW.json'
import relayZhCN from '@/features/relaybases/i18n/locales/zh.json'
import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import ru from '@/i18n/locales/ru.json'
import vi from '@/i18n/locales/vi.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zhCN from '@/i18n/locales/zh.json'

import type { SystemStatus } from '../../types'

const domWindow = new Window({ url: 'https://relaybases.com/sign-in' })
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { LegalConsent } = await import('../legal-consent')
const { TermsFooter } = await import('../terms-footer')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['translation', 'relaybases'],
  defaultNS: 'translation',
  resources: {
    en: { translation: en.translation, relaybases: relayEn },
    zhCN: { translation: zhCN.translation, relaybases: relayZhCN },
    zhTW: { translation: zhTW.translation, relaybases: relayZhTW },
    fr: { translation: fr.translation, relaybases: relayFr },
    ja: { translation: ja.translation, relaybases: relayJa },
    ru: { translation: ru.translation, relaybases: relayRu },
    vi: { translation: vi.translation, relaybases: relayVi },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

const status = {
  user_agreement_enabled: true,
  privacy_policy_enabled: true,
} as SystemStatus

async function renderSignInFooter(language: string) {
  await i18n.changeLanguage(language)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <TermsFooter variant='sign-in' status={status} />
      </I18nextProvider>
    )
  })

  const text = container.textContent ?? ''
  await act(async () => root.unmount())
  container.remove()
  return text
}

async function renderLegalConsent(language: string) {
  await i18n.changeLanguage(language)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <LegalConsent
          status={status}
          checked={false}
          onCheckedChange={() => undefined}
        />
      </I18nextProvider>
    )
  })

  const consent = container.querySelector('[data-relaybases-legal-consent]')
  const className = consent?.getAttribute('class') ?? ''
  const text = container.textContent ?? ''
  await act(async () => root.unmount())
  container.remove()
  return { className, text }
}

describe('authentication terms footer localization', () => {
  after(() => domWindow.close())

  test('does not leak the English sign-in sentence into any supported non-English locale', async () => {
    const expectedCopy = new Map([
      ['zhCN', '登录即表示您同意我们的用户协议和隐私政策。'],
      ['zhTW', '登入即表示您同意我們的使用者協議和隱私權政策。'],
      [
        'fr',
        'En vous connectant, vous acceptez nos Conditions d’utilisation et notre Politique de confidentialité.',
      ],
      [
        'ja',
        'ログインすると、利用規約およびプライバシーポリシーに同意したものとみなされます。',
      ],
      [
        'ru',
        'Входя в систему, вы соглашаетесь с Пользовательским соглашением и Политикой конфиденциальности.',
      ],
      [
        'vi',
        'Khi đăng nhập, bạn đồng ý với Thỏa thuận người dùng và Chính sách quyền riêng tư.',
      ],
    ])

    for (const [language, expected] of expectedCopy) {
      const text = await renderSignInFooter(language)
      assert.equal(text, expected)
    }
  })

  test('keeps the sign-up legal consent block on the upstream system style', async () => {
    const { className, text } = await renderLegalConsent('zhCN')

    assert.match(text, /注册即表示您同意用户协议和隐私政策。/)
    assert.match(className, /rounded-md/)
    assert.match(className, /\bborder\b/)
    assert.match(className, /\bp-3\b/)
    assert.doesNotMatch(className, /rounded-xl/)
    assert.doesNotMatch(className, /shadow-sm/)
    assert.doesNotMatch(className, /before:/)
  })
})
