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
import { cn } from '@/lib/utils'

export const publicHeaderDesktopNavigationClassName =
  'hidden shrink-0 items-center gap-0.5 whitespace-nowrap xl:flex'

export const publicHeaderDesktopLinkClassName =
  'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200'

export const publicHeaderMobileActionsClassName =
  'flex items-center gap-2 xl:hidden'

export const publicHeaderMobileOverlayClassName =
  'bg-background/98 fixed inset-0 z-40 backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] xl:pointer-events-none xl:hidden'

export function getPublicHeaderContainerClassName(scrolled: boolean): string {
  return cn(
    'pointer-events-auto mx-auto max-w-7xl transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
    scrolled ? 'px-3 pt-3' : 'px-4 pt-0 md:px-6'
  )
}
