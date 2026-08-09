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
export type RelayBasesDocumentTheme = 'light' | 'dark'

const SITE_HOME_VERSION = 'site-home-lang-sync-20260704-v4'
const CN_HOME_VERSION = 'cn-home-20260621-v14'

function isChineseEntryHostname(hostname: string): boolean {
  return /^(cn|china)\.relaybases\.com$/i.test(hostname)
}

function isRelayBasesHostname(hostname: string): boolean {
  return hostname === 'relaybases.com' || hostname.endsWith('.relaybases.com')
}

function isSiteHomeUrl(url: URL): boolean {
  const path = url.pathname.replace(/\/+$/, '') || '/'
  return (
    (url.hostname === 'site.relaybases.com' ||
      isChineseEntryHostname(url.hostname)) &&
    (path === '/' || path === '/index.html')
  )
}

export function relayBasesDocumentLanguage(language: string): 'en' | 'zh' {
  const normalized = language.trim().toLowerCase().replaceAll('_', '-')
  return normalized === 'zh' ||
    normalized === 'zhcn' ||
    normalized === 'zhtw' ||
    normalized.startsWith('zh-')
    ? 'zh'
    : 'en'
}

export function withRelayBasesDocumentPreferences(
  rawUrl: string,
  language: string,
  theme: RelayBasesDocumentTheme
): string {
  try {
    const baseUrl =
      typeof window === 'undefined'
        ? 'https://relaybases.com/'
        : window.location.origin
    const url = new URL(rawUrl, baseUrl)
    if (!isRelayBasesHostname(url.hostname)) return rawUrl

    const currentHostname =
      typeof window === 'undefined' ? '' : window.location.hostname
    if (isChineseEntryHostname(currentHostname) && isSiteHomeUrl(url)) {
      url.protocol = window.location.protocol
      url.host = window.location.host
      url.pathname = '/index.html'
      url.searchParams.set('market', 'cn')
      url.searchParams.set('v', CN_HOME_VERSION)
    }
    if (isSiteHomeUrl(url)) {
      url.searchParams.set('rbv', SITE_HOME_VERSION)
    }
    url.searchParams.set('lang', relayBasesDocumentLanguage(language))
    url.searchParams.set('theme', theme)
    return url.toString()
  } catch {
    return rawUrl
  }
}

export function relayBasesDocumentFrameSandbox(
  rawUrl: string,
  baseSandbox: string
): string {
  try {
    const url = new URL(
      rawUrl,
      typeof window === 'undefined'
        ? 'https://relaybases.com/'
        : window.location.origin
    )
    if (!isSiteHomeUrl(url)) return baseSandbox
    const tokens = new Set(baseSandbox.split(/\s+/).filter(Boolean))
    tokens.add('allow-same-origin')
    return [...tokens].join(' ')
  } catch {
    return baseSandbox
  }
}

export function postRelayBasesDocumentPreferences(
  frame: HTMLIFrameElement | null,
  rawUrl: string,
  language: string,
  theme: RelayBasesDocumentTheme
): void {
  if (!frame?.contentWindow) return
  try {
    const url = new URL(
      rawUrl,
      typeof window === 'undefined'
        ? 'https://relaybases.com/'
        : window.location.origin
    )
    if (!isRelayBasesHostname(url.hostname)) return
    frame.contentWindow.postMessage(
      {
        type: 'relaybases:prefs',
        theme,
        lang: relayBasesDocumentLanguage(language),
        market: isChineseEntryHostname(url.hostname) ? 'cn' : '',
      },
      url.origin
    )
  } catch {
    // Ignore malformed or transient iframe URLs.
  }
}
