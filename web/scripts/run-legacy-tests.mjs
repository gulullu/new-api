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
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const webDirectory = path.resolve(scriptDirectory, '..')

function findLegacyTestFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...findLegacyTestFiles(absolutePath))
      continue
    }
    if (
      /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name) &&
      readFileSync(absolutePath, 'utf8').includes("from 'node:test'")
    ) {
      files.push(path.relative(webDirectory, absolutePath))
    }
  }
  return files.sort()
}

const legacyTestFiles = findLegacyTestFiles(path.join(webDirectory, 'src'))
for (const testFile of legacyTestFiles) {
  const result = Bun.spawnSync([process.execPath, 'test', testFile], {
    cwd: webDirectory,
    stderr: 'inherit',
    stdout: 'inherit',
  })
  if (!result.success) {
    process.exit(result.exitCode ?? 1)
  }
}
