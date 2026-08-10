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
const { getPaymentIcon } = await import('../ui')

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

describe('wallet payment icons', () => {
  after(() => domWindow.close())

  test('keeps the bundled Waffo brand mark when a configured icon is unusable', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        getPaymentIcon('waffo_pancake', 'size-5', 'LuGlobe2', 'Waffo Pancake')
      )
    })

    assert.ok(container.querySelector('img[src="/waffo-logo-dark.svg"]'))
    assert.ok(container.querySelector('img[src="/waffo-logo-light.svg"]'))

    await act(async () => root.unmount())
    container.remove()
  })

  test('keeps configured icon precedence for non-Waffo payment methods', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        getPaymentIcon(
          'stripe',
          'size-5',
          'https://assets.example.com/custom-stripe.svg',
          'Stripe'
        )
      )
    })

    const icon = container.querySelector('img')
    assert.equal(icon?.src, 'https://assets.example.com/custom-stripe.svg')
    assert.equal(icon?.alt, 'Stripe')

    await act(async () => root.unmount())
    container.remove()
  })
})
