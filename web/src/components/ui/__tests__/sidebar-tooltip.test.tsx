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

const domWindow = new Window({ url: 'http://localhost/' })
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
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

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { SidebarMenuButton, SidebarProvider } = await import('../sidebar')

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

async function renderSidebarButton({
  defaultOpen,
  width,
}: {
  defaultOpen: boolean
  width: number
}) {
  Object.defineProperty(domWindow, 'innerWidth', {
    configurable: true,
    value: width,
  })

  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <SidebarProvider defaultOpen={defaultOpen}>
        <SidebarMenuButton
          tooltip='API keys'
          render={<a href='/keys'>API keys</a>}
        />
      </SidebarProvider>
    )
  })

  return { container, root }
}

async function unmountSidebarButton(
  rendered: Awaited<ReturnType<typeof renderSidebarButton>>
) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('SidebarMenuButton tooltip behavior', () => {
  after(() => {
    domWindow.close()
  })

  test('does not attach tooltip focus handlers to mobile navigation links', async () => {
    const rendered = await renderSidebarButton({
      defaultOpen: true,
      width: 390,
    })
    const link = rendered.container.querySelector('a')

    assert.ok(link)
    assert.equal(link.getAttribute('data-base-ui-tooltip-trigger'), null)

    await unmountSidebarButton(rendered)
  })

  test('only attaches a tooltip trigger to a collapsed desktop link', async () => {
    const rendered = await renderSidebarButton({
      defaultOpen: false,
      width: 1024,
    })
    const link = rendered.container.querySelector('a')

    assert.ok(link)
    assert.equal(link.hasAttribute('data-base-ui-tooltip-trigger'), true)

    await unmountSidebarButton(rendered)
  })
})
