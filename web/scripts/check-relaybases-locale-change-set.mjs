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
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const baseSha = process.argv[2]
if (!baseSha) {
  throw new Error('Usage: check-relaybases-locale-change-set.mjs <base-sha>')
}

const localeNames = ['en', 'fr', 'ja', 'ru', 'vi', 'zh-TW', 'zh']
const repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim()
const localeDirectory = 'web/src/features/relaybases/i18n/locales'

function flattenLeaves(value, prefix = '', leaves = new Map()) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of Object.keys(value).sort()) {
      flattenLeaves(value[key], prefix ? `${prefix}.${key}` : key, leaves)
    }
    return leaves
  }

  leaves.set(prefix, JSON.stringify(value))
  return leaves
}

function changedLeafKeys(before, after) {
  const beforeLeaves = flattenLeaves(before)
  const afterLeaves = flattenLeaves(after)
  const keys = new Set([...beforeLeaves.keys(), ...afterLeaves.keys()])
  return [...keys]
    .filter((key) => beforeLeaves.get(key) !== afterLeaves.get(key))
    .sort()
}

function readBaseLocale(localeName) {
  const path = `${localeDirectory}/${localeName}.json`
  return JSON.parse(
    execFileSync('git', ['show', `${baseSha}:${path}`], {
      encoding: 'utf8',
    })
  )
}

function readCurrentLocale(localeName) {
  return JSON.parse(
    readFileSync(
      join(repositoryRoot, localeDirectory, `${localeName}.json`),
      'utf8'
    )
  )
}

const changesByLocale = new Map(
  localeNames.map((localeName) => [
    localeName,
    changedLeafKeys(readBaseLocale(localeName), readCurrentLocale(localeName)),
  ])
)
const expectedKeys = changesByLocale.get('en')
const mismatchedLocales = localeNames.filter(
  (localeName) =>
    JSON.stringify(changesByLocale.get(localeName)) !==
    JSON.stringify(expectedKeys)
)

if (mismatchedLocales.length > 0) {
  console.error(
    'RelayBases copy changes must update the same leaf keys in all seven locales.'
  )
  for (const localeName of localeNames) {
    const keys = changesByLocale.get(localeName)
    console.error(`${localeName}: ${keys.length ? keys.join(', ') : '(none)'}`)
  }
  process.exit(1)
}

console.log(
  expectedKeys.length === 0
    ? 'No RelayBases locale copy changes detected.'
    : `Validated ${expectedKeys.length} changed RelayBases copy key(s) across seven locales.`
)
