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
import { readFileSync } from 'node:fs'
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window({ url: 'https://relaybases.com/' })
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
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const stylesheet = document.createElement('style')
stylesheet.textContent = readFileSync(
  new URL('../infinite-canvas-navigation.css', import.meta.url),
  'utf8'
)
document.head.append(stylesheet)

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const {
  InfiniteCanvasNavigationContent,
  infiniteCanvasHeaderLinkClassName,
  infiniteCanvasSidebarActionClassName,
  infiniteCanvasSidebarItemClassName,
} = await import('../infinite-canvas-navigation')

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

async function renderPresentation() {
  const container = document.createElement('div')
  container.setAttribute('data-collapsible', '')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <>
        <a className={infiniteCanvasHeaderLinkClassName} href='/canvas'>
          <InfiniteCanvasNavigationContent
            title='Бесконечный холст'
            zone='header'
          />
        </a>
        <ul>
          <li className={infiniteCanvasSidebarItemClassName}>
            <a className={infiniteCanvasSidebarActionClassName} href='/canvas'>
              <InfiniteCanvasNavigationContent
                title='Бесконечный холст'
                zone='sidebar'
              />
            </a>
          </li>
        </ul>
      </>
    )
  })

  return { container, root }
}

describe('Infinite Canvas navigation presentation', () => {
  after(() => domWindow.close())

  test('keeps the original pill and dashboard-card structure with the complete localized label', async () => {
    const rendered = await renderPresentation()
    const header = rendered.container.querySelector<HTMLAnchorElement>(
      `.${infiniteCanvasHeaderLinkClassName}`
    )
    const card = rendered.container.querySelector<HTMLLIElement>(
      `.${infiniteCanvasSidebarItemClassName}`
    )

    assert.ok(header)
    assert.ok(card)
    assert.equal(
      header.querySelector('[data-rb-infinite-canvas-text]')?.textContent,
      'Бесконечный холст'
    )
    assert.equal(
      card.querySelector('[data-rb-infinite-canvas-text]')?.textContent,
      'Бесконечный холст'
    )
    assert.equal(
      card.querySelector('[data-rb-infinite-canvas-badge]')?.textContent,
      'AI'
    )
    assert.equal(
      header
        .querySelector('[data-rb-infinite-canvas-text]')
        ?.getAttribute('data-rb-infinite-canvas-compact'),
      '1'
    )
    assert.equal(
      card
        .querySelector('[data-rb-infinite-canvas-text]')
        ?.getAttribute('data-rb-infinite-canvas-compact'),
      '1'
    )
    assert.ok(card.querySelector('svg path[fill="rgba(255,255,255,.94)"]'))
    assert.equal(getComputedStyle(header).borderRadius, '999px')
    assert.equal(getComputedStyle(card).borderRadius, '16px')

    await act(async () => rendered.root.unmount())
    rendered.container.remove()
  })

  test('reduces the dashboard card back to an icon-only menu item when the sidebar collapses', async () => {
    const rendered = await renderPresentation()
    rendered.container.setAttribute('data-collapsible', 'icon')
    const card = rendered.container.querySelector<HTMLLIElement>(
      `.${infiniteCanvasSidebarItemClassName}`
    )
    const label = card?.querySelector<HTMLElement>(
      '[data-rb-infinite-canvas-text]'
    )
    const badge = card?.querySelector<HTMLElement>(
      '[data-rb-infinite-canvas-badge]'
    )

    assert.ok(card)
    assert.ok(label)
    assert.ok(badge)
    assert.equal(getComputedStyle(card).marginTop, '0px')
    assert.equal(getComputedStyle(card).borderTopWidth, '0px')
    assert.equal(getComputedStyle(label).display, 'none')
    assert.equal(getComputedStyle(badge).display, 'none')

    await act(async () => rendered.root.unmount())
    rendered.container.remove()
  })
})
