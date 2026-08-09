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

const offerRows = [
  ['auth.signupOffer.trial', 'auth.signupOffer.trialDetail'],
  ['auth.signupOffer.models', 'auth.signupOffer.modelsDetail'],
  ['auth.signupOffer.credits', 'auth.signupOffer.creditsDetail'],
  ['auth.signupOffer.pricing', 'auth.signupOffer.pricingDetail'],
] as const

export function RelayBasesSignupOffer() {
  const { t } = useTranslation('relaybases')

  return (
    <section
      aria-label={t('auth.signupOffer.ariaLabel')}
      className='relative overflow-hidden rounded-xl border border-white/10 bg-[#454640] font-mono text-[12px] leading-relaxed text-[#f0f0e8] shadow-lg sm:text-[13px]'
      data-relaybases-signup-offer
    >
      <div className='flex min-h-10 items-center gap-2 border-b border-white/10 bg-[#393a36] px-3 py-2.5'>
        <span className='size-2.5 rounded-full bg-[#ff6257]' />
        <span className='size-2.5 rounded-full bg-[#f8c14d]' />
        <span className='size-2.5 rounded-full bg-[#58d26b]' />
        <span className='ml-2 min-w-0 flex-1 truncate text-white/70'>
          relaybases/signup
        </span>
        <span className='text-[11px] text-emerald-300'>
          {t('auth.signupOffer.status')}
        </span>
      </div>

      <div className='space-y-2.5 bg-[radial-gradient(circle_at_15%_5%,rgba(142,220,255,.08),transparent_35%),radial-gradient(circle_at_90%_5%,rgba(169,139,255,.09),transparent_36%)] px-4 py-4'>
        <p className='font-semibold text-white'>
          <span className='mr-2 text-emerald-300'>›</span>
          relaybases signup --offer
        </p>
        {offerRows.map(([titleKey, detailKey]) => (
          <p key={titleKey} className='flex flex-col gap-0.5 sm:block'>
            <span className='rounded bg-emerald-300/10 px-1.5 py-0.5 text-emerald-100'>
              {t(titleKey)}
            </span>
            <span className='text-white/60 sm:ml-2'>// {t(detailKey)}</span>
          </p>
        ))}
        <p className='pt-1 text-white'>
          <span className='mr-2 text-emerald-300'>
            {t('auth.signupOffer.status')}
          </span>
          {t('auth.signupOffer.ready')}
        </p>
      </div>
    </section>
  )
}
