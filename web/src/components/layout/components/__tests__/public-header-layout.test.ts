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
import { describe, test } from 'node:test'

import {
  getPublicHeaderContainerClassName,
  publicHeaderDesktopLinkClassName,
  publicHeaderDesktopNavigationClassName,
  publicHeaderMobileActionsClassName,
  publicHeaderMobileOverlayClassName,
} from '../public-header-layout'

function classTokens(className: string): Set<string> {
  return new Set(className.split(/\s+/).filter(Boolean))
}

const localeNames = ['en', 'zh', 'zh-TW', 'fr', 'ja', 'ru', 'vi'] as const

async function readNavigationLabels(locale: (typeof localeNames)[number]) {
  const source = await readFile(
    new URL(`../../../../i18n/locales/${locale}.json`, import.meta.url),
    'utf8'
  )
  const resource = JSON.parse(source) as {
    translation: Record<string, string>
  }
  return [
    resource.translation.Home,
    resource.translation.Console,
    resource.translation['Model Square'],
    resource.translation.Rankings,
    resource.translation.Docs,
    resource.translation.About,
  ]
}

describe('public header responsive layout', () => {
  test('keeps the full desktop width after scrolling', () => {
    const top = classTokens(getPublicHeaderContainerClassName(false))
    const scrolled = classTokens(getPublicHeaderContainerClassName(true))

    assert.equal(top.has('max-w-7xl'), true)
    assert.equal(scrolled.has('max-w-7xl'), true)
    assert.equal(scrolled.has('max-w-[52rem]'), false)
  })

  test('keeps localized desktop labels on one line', () => {
    const navigation = classTokens(publicHeaderDesktopNavigationClassName)
    const link = classTokens(publicHeaderDesktopLinkClassName)

    assert.equal(navigation.has('whitespace-nowrap'), true)
    assert.equal(navigation.has('shrink-0'), true)
    assert.equal(link.has('whitespace-nowrap'), true)
    assert.equal(link.has('shrink-0'), true)
  })

  test('applies the no-wrap contract to every supported navigation locale', async () => {
    const link = classTokens(publicHeaderDesktopLinkClassName)

    for (const locale of localeNames) {
      const labels = await readNavigationLabels(locale)
      assert.equal(
        labels.every((label) => typeof label === 'string' && label.length > 0),
        true,
        `${locale} has an incomplete public navigation`
      )
      assert.equal(link.has('whitespace-nowrap'), true)
    }
  })

  test('uses the mobile menu until the full navigation has enough room', () => {
    const desktop = classTokens(publicHeaderDesktopNavigationClassName)
    const mobileActions = classTokens(publicHeaderMobileActionsClassName)
    const mobileOverlay = classTokens(publicHeaderMobileOverlayClassName)

    assert.equal(desktop.has('xl:flex'), true)
    assert.equal(desktop.has('sm:flex'), false)
    assert.equal(mobileActions.has('xl:hidden'), true)
    assert.equal(mobileOverlay.has('xl:hidden'), true)
  })
})
