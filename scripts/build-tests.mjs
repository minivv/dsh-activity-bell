// Emit the plugin sources as plain ESM for the node tests: the same files the
// bundles are built from, without the browser module-loader wrapper, so the
// pure projection and the DOM anchor helpers under test are the shipped ones.
import { execSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

execSync('npx tsc -p tsconfig.test.json', { cwd: root, stdio: 'inherit' })
