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
import { fileURLToPath } from 'node:url'

import { configDefaults, defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function findLegacyTestFiles(directory: string): string[] {
  const files: string[] = []
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
      files.push(
        path.relative(__dirname, absolutePath).replaceAll(path.sep, '/')
      )
    }
  }
  return files
}

const legacyTestFiles = findLegacyTestFiles(path.resolve(__dirname, './src'))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // RelayBases extensions written before rc.25 use Bun's node:test runner.
    // Keep them in CI without asking Vitest to browser-bundle node:test.
    exclude: [...configDefaults.exclude, ...legacyTestFiles],
  },
})
