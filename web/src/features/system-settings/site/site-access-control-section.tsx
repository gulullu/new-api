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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Switch } from '@/components/ui/switch'

import {
  getSiteAccessPolicy,
  updateSiteAccessPolicy,
} from '../api'
import {
  SettingsSwitchContent,
  SettingsSwitchRow,
} from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'

export function SiteAccessControlSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const policyQuery = useQuery({
    queryKey: ['site-access-policy'],
    queryFn: async () => {
      const response = await getSiteAccessPolicy()
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Request failed')
      }
      return response
    },
    retry: false,
  })
  const [override, setOverride] = useState<boolean | null>(null)
  const enabled = override ?? policyQuery.data?.data?.enabled ?? true
  const degraded = policyQuery.isError || policyQuery.data?.data?.degraded === true
  let statusText = t('Currently allowed for mainland China IPs.')
  if (policyQuery.isPending) {
    statusText = t('Loading...')
  } else if (degraded) {
    statusText = t(
      'Policy unavailable; the Worker is keeping the block enabled.'
    )
  } else if (enabled) {
    statusText = t('Currently blocked for mainland China IPs.')
  }

  const policyMutation = useMutation({
    mutationFn: async (nextEnabled: boolean) => {
      const response = await updateSiteAccessPolicy(nextEnabled)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Request failed')
      }
      return response
    },
    onMutate: (nextEnabled) => {
      const previous = enabled
      setOverride(nextEnabled)
      return { previous }
    },
    onSuccess: (response) => {
      setOverride(null)
      queryClient.setQueryData(['site-access-policy'], response)
      toast.success(
        response.data?.enabled
          ? t('Mainland website access is blocked')
          : t('Mainland website access is allowed')
      )
    },
    onError: (_error, _nextEnabled, context) => {
      setOverride(context?.previous ?? null)
      toast.error(t('Failed to update website access policy'))
    },
  })

  const handleChange = (nextEnabled: boolean) => {
    policyMutation.mutate(nextEnabled)
  }

  return (
    <SettingsSection title={t('Website access control')}>
      <div className='bg-muted/20 rounded-xl border px-4 py-3'>
        <SettingsSwitchRow>
          <SettingsSwitchContent>
            <div className='text-sm font-medium'>
              {t('Block mainland China website access')}
            </div>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Only website pages on relaybases.com are affected. API requests, image routes, and payment callbacks remain available.'
              )}
            </p>
            <p className='text-muted-foreground text-xs'>
              {statusText}
            </p>
          </SettingsSwitchContent>
          <Switch
            checked={enabled}
            disabled={policyQuery.isPending || policyMutation.isPending}
            onCheckedChange={handleChange}
            aria-label={t('Block mainland China website access')}
          />
        </SettingsSwitchRow>
      </div>
    </SettingsSection>
  )
}
