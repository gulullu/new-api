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
import { ExternalLink, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/context/theme-provider'
import { withRelayBasesDocumentPreferences } from '@/features/relaybases/navigation/document-preferences'

import { RELAYBASES_I18N_NAMESPACE } from '../i18n/manifest'
import {
  getRelayBasesCreditsDocsUrl,
  RELAYBASES_REFUND_POLICY_URL,
} from './policy'

export function RelayBasesCreditsNotice() {
  const { t, i18n } = useTranslation(RELAYBASES_I18N_NAMESPACE)
  const { resolvedTheme } = useTheme()
  const language = i18n.resolvedLanguage ?? i18n.language
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const docsUrl = withRelayBasesDocumentPreferences(
    getRelayBasesCreditsDocsUrl(language),
    language,
    theme
  )
  const refundUrl = withRelayBasesDocumentPreferences(
    RELAYBASES_REFUND_POLICY_URL,
    language,
    theme
  )

  return (
    <aside
      aria-labelledby='relaybases-credits-notice-title'
      className='bg-muted/30 space-y-2 rounded-xl border p-3.5 sm:p-4'
    >
      <div className='flex items-start gap-2.5'>
        <Info
          aria-hidden='true'
          className='text-muted-foreground mt-0.5 size-4 shrink-0'
        />
        <div className='min-w-0 space-y-1.5'>
          <h3
            id='relaybases-credits-notice-title'
            className='text-sm font-semibold'
          >
            {t('wallet.creditsNotice.title')}
          </h3>
          <p className='text-muted-foreground text-xs leading-5'>
            {t('wallet.creditsNotice.body')}
          </p>
          <p className='text-muted-foreground text-xs leading-5'>
            {t('wallet.creditsNotice.refund')}
          </p>
          <div className='flex flex-wrap gap-x-4 gap-y-1 pt-0.5 text-xs font-medium'>
            <a
              href={docsUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1 underline-offset-4 hover:underline'
            >
              {t('wallet.creditsNotice.docsLink')}
              <ExternalLink aria-hidden='true' className='size-3' />
            </a>
            <a
              href={refundUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1 underline-offset-4 hover:underline'
            >
              {t('wallet.creditsNotice.refundLink')}
            </a>
          </div>
        </div>
      </div>
    </aside>
  )
}
