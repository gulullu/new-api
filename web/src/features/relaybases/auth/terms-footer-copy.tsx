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
import { Trans } from 'react-i18next'

const agreementLink = (
  <a
    href='/user-agreement'
    className='hover:text-primary underline underline-offset-4'
  />
)

const privacyLink = (
  <a
    href='/privacy-policy'
    className='hover:text-primary underline underline-offset-4'
  />
)

type RelayBasesTermsFooterCopyProps = {
  variant: 'sign-in' | 'sign-up'
  hasUserAgreement: boolean
  hasPrivacyPolicy: boolean
}

export function RelayBasesTermsFooterCopy(
  props: RelayBasesTermsFooterCopyProps
) {
  const action = props.variant === 'sign-in' ? 'signIn' : 'signUp'
  let policy = 'privacyOnly'
  if (props.hasUserAgreement && props.hasPrivacyPolicy) {
    policy = 'both'
  } else if (props.hasUserAgreement) {
    policy = 'agreementOnly'
  }

  return (
    <Trans
      ns='relaybases'
      i18nKey={`auth.termsFooter.${action}.${policy}`}
      components={{
        agreement: agreementLink,
        privacy: privacyLink,
      }}
    />
  )
}
