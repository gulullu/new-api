import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import en from '@/features/relaybases/i18n/locales/en.json'
import fr from '@/features/relaybases/i18n/locales/fr.json'
import ja from '@/features/relaybases/i18n/locales/ja.json'
import ru from '@/features/relaybases/i18n/locales/ru.json'
import vi from '@/features/relaybases/i18n/locales/vi.json'
import zhTW from '@/features/relaybases/i18n/locales/zh-TW.json'
import zh from '@/features/relaybases/i18n/locales/zh.json'

import {
  microsFromUsd,
  netPartnerLifetimeUsdMicros,
  partnerListCount,
  percentFromBasisPoints,
  usdFromMicros,
} from '../lib'

const locales = { en, zh, zhTW, fr, ja, ru, vi }

describe('Partner program contract', () => {
  test('keeps exact USD micro accounting helpers', () => {
    assert.equal(microsFromUsd('20'), 20_000_000)
    assert.equal(microsFromUsd('20.123456'), 20_123_456)
    assert.equal(microsFromUsd('20,123456'), 20_123_456)
    assert.equal(microsFromUsd('20.1234567'), null)
    assert.equal(microsFromUsd('-1'), null)
    assert.equal(microsFromUsd('9007199254.740992'), null)
    assert.match(percentFromBasisPoints(3000), /^30\s?%$/)
    assert.match(usdFromMicros(30_500_000), /30[.,]5/)
    assert.equal(
      netPartnerLifetimeUsdMicros(125_000_000, 5_000_000),
      120_000_000
    )
    assert.equal(netPartnerLifetimeUsdMicros(5_000_000, 10_000_000), 0)
  })

  test('treats null and missing admin lists as empty', () => {
    assert.equal(partnerListCount(null), 0)
    assert.equal(partnerListCount(undefined), 0)
    assert.equal(partnerListCount([]), 0)
    assert.equal(partnerListCount([{ id: 1 }]), 1)
  })

  test('publishes complete rules in all seven locales without fee copy', () => {
    for (const [locale, resource] of Object.entries(locales)) {
      assert.equal(resource.partner.rules.items.length, 8, locale)
      assert.ok(
        resource.partner.rules.items.every((rule) => rule.trim().length > 20),
        locale
      )
      const copy = JSON.stringify(resource.partner)
      assert.doesNotMatch(copy, /gas fee|network fee|网络费|網路費|手续费/i)
      assert.match(copy, /20/)
      assert.match(copy, /7/)
    }
  })

  test('names BNB Smart Chain and BEP-20 in every locale', () => {
    for (const [locale, resource] of Object.entries(locales)) {
      assert.match(resource.partner.withdrawal.bsc, /BNB Smart Chain/i, locale)
      assert.match(resource.partner.withdrawal.bsc, /BEP-20/i, locale)
    }
  })
})
