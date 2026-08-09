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
import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/context/theme-provider'

import { withRelayBasesDocumentPreferences } from './document-preferences'
import { InfiniteCanvasIcon } from './infinite-canvas-icon'

const serviceStatusUrl = 'https://kuma.relaybases.com/status/relaybases'
const infiniteCanvasUrl = 'https://canvas.relaybases.com/'

export function useRelayBasesNavigation() {
  const { i18n, t } = useTranslation('relaybases')
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const canvasUrl = withRelayBasesDocumentPreferences(
    infiniteCanvasUrl,
    i18n.language,
    theme
  )

  return {
    topNavLinks: [
      {
        title: t('navigation.serviceStatus'),
        href: serviceStatusUrl,
        external: true as const,
      },
      {
        title: t('navigation.infiniteCanvas'),
        href: canvasUrl,
        external: true as const,
      },
    ],
    sidebarCanvasLink: {
      title: t('navigation.infiniteCanvas'),
      url: canvasUrl,
      icon: InfiniteCanvasIcon,
      external: true as const,
    },
    serviceStatusLink: {
      title: t('navigation.serviceStatus'),
      url: serviceStatusUrl,
      icon: Activity,
      external: true as const,
    },
    withDocumentPreferences: (url: string) =>
      withRelayBasesDocumentPreferences(url, i18n.language, theme),
  }
}
