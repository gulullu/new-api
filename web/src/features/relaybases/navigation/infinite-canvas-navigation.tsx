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
import { InfiniteCanvasIcon } from './infinite-canvas-icon'

import './infinite-canvas-navigation.css'

export const infiniteCanvasHeaderLinkClassName =
  'rb-infinite-canvas-header-link'
export const infiniteCanvasSidebarItemClassName =
  'rb-infinite-canvas-dashboard-card'
export const infiniteCanvasSidebarActionClassName =
  'rb-infinite-canvas-dashboard-action'

type InfiniteCanvasNavigationContentProps = {
  title: string
  zone: 'header' | 'sidebar'
}

export function InfiniteCanvasNavigationContent(
  props: InfiniteCanvasNavigationContentProps
) {
  const usesCompactLabel = Array.from(props.title).length > 16

  return (
    <>
      <span
        className='rb-infinite-canvas-icon-shell'
        data-rb-infinite-canvas-icon-shell='1'
        data-rb-infinite-canvas-zone={props.zone}
        aria-hidden='true'
      >
        <InfiniteCanvasIcon />
      </span>
      <span
        className='rb-infinite-canvas-text'
        data-rb-infinite-canvas-text='1'
        data-rb-infinite-canvas-compact={usesCompactLabel ? '1' : undefined}
        title={props.title}
      >
        {props.title}
      </span>
      <span
        className='rb-infinite-canvas-badge'
        data-rb-infinite-canvas-badge='1'
        aria-hidden='true'
      >
        AI
      </span>
    </>
  )
}
