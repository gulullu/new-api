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
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/context/theme-provider'

import { withRelayBasesDocumentPreferences } from './document-preferences'

const RELAYBASES_PREFERENCE_PAGE_PATHS = new Set([
  '/usage-doc',
  '/relaybases-usage-doc-inline',
  '/aup',
  '/privacy',
  '/terms',
  '/refund',
  '/privacy-policy',
  '/user-agreement',
  '/refund-policy',
])

function relayBasesStaticDocumentLink(anchor: HTMLAnchorElement): boolean {
  try {
    const url = new URL(anchor.href, window.location.origin)
    const path = (url.pathname.replace(/\/+$/, '') || '/')
      .replace(/\.html$/i, '')
      .toLowerCase()
    const allowedHost =
      url.hostname === 'site.relaybases.com' ||
      /^(cn|china)\.relaybases\.com$/i.test(url.hostname)
    return allowedHost && RELAYBASES_PREFERENCE_PAGE_PATHS.has(path)
  } catch {
    return false
  }
}

export function RelayBasesPreferenceLinkBridge() {
  const { i18n } = useTranslation()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || !relayBasesStaticDocumentLink(anchor)) return
      anchor.href = withRelayBasesDocumentPreferences(
        anchor.href,
        i18n.resolvedLanguage || i18n.language,
        resolvedTheme === 'dark' ? 'dark' : 'light'
      )
    }

    const eventTypes = ['pointerdown', 'click', 'auxclick'] as const
    for (const eventType of eventTypes) {
      document.addEventListener(eventType, handleClick, true)
    }
    return () => {
      for (const eventType of eventTypes) {
        document.removeEventListener(eventType, handleClick, true)
      }
    }
  }, [i18n.language, i18n.resolvedLanguage, resolvedTheme])

  return null
}
