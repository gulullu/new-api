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
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/context/theme-provider'
import { withRelayBasesDocumentPreferences } from '@/features/relaybases/navigation/document-preferences'

import { RELAYBASES_I18N_NAMESPACE } from '../i18n/manifest'

const USAGE_DOCUMENT_URL = 'https://site.relaybases.com/usage-doc.html'

export function RelayBasesPricingCreditNote() {
  const { t, i18n } = useTranslation(RELAYBASES_I18N_NAMESPACE)
  const { resolvedTheme } = useTheme()
  const documentLanguage = i18n.resolvedLanguage || i18n.language || 'en'
  const section = documentLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  const href = withRelayBasesDocumentPreferences(
    `${USAGE_DOCUMENT_URL}#${section}-credits`,
    documentLanguage,
    resolvedTheme === 'dark' ? 'dark' : 'light'
  )

  return (
    <aside
      aria-label={t('pricing.creditNote.accessibleName')}
      className='border-border/70 bg-muted/30 text-muted-foreground mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-lg border px-3 py-2 text-xs leading-relaxed sm:mt-5 sm:text-sm'
    >
      <span>{t('pricing.creditNote.body')}</span>
      <a
        href={href}
        target='_blank'
        rel='noopener noreferrer'
        className='text-foreground font-semibold underline underline-offset-4'
      >
        {t('pricing.creditNote.link')}
      </a>
    </aside>
  )
}
