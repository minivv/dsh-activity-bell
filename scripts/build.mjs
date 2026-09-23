// Build script: tsc for the host half + activity model, esbuild + the DSH
// module-loader wrapper for the client half.
//
// Mirrors the official client build contract (see the dsh-plugin-development
// skill): the client bundle keeps React and the shared platform modules
// external (the Web shell's module table provides them) and inlines everything
// else, then wraps the CJS output in `window.__ModuleLoader__.load`.
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

// 1) Host half + the shared activity model: tsc emits ESM to lib/ with
//    declarations and sourcemaps. The model is compiled here (not only
//    bundled) so the plain-node tests can import it from lib/.
execSync('npx tsc -p tsconfig.json', { cwd: root, stdio: 'inherit' })

// Publish client-side declarations alongside the browser bundle: the publish
// config checks with noEmit, so the build opts into declaration output
// explicitly and every `types` export in package.json resolves in the tarball.
rmSync(join(root, 'lib/types'), { recursive: true, force: true })
execSync(
  'npx tsc -p tsconfig.client.json --declaration --emitDeclarationOnly --noEmit false --outDir lib/types --rootDir src',
  { cwd: root, stdio: 'inherit' },
)

// 2) Client half.
const tmp = join(root, '.tmp')
mkdirSync(tmp, { recursive: true })
await esbuild.build({
  entryPoints: [join(root, 'src/client/index.ts')],
  outfile: join(tmp, 'client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2020'],
  // Exactly the Web shell's platform module table: everything else is inlined.
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives',
  ],
  jsx: 'automatic',
  sourcemap: true,
  logLevel: 'info',
})

// 3) Wrap into the DSH browser module-loader contract.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const bundle = readFileSync(join(tmp, 'client.js'), 'utf8')
const wrapped = [
  'window.__ModuleLoader__.load({',
  `  id: ${JSON.stringify(pkg.name)},`,
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  "    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });",
  bundle.trim(),
  '    return module.exports;',
  '  }',
  '});',
  '',
  '//# sourceMappingURL=client.js.map',
].join('\n')

mkdirSync(join(root, 'lib'), { recursive: true })
writeFileSync(join(root, 'lib/client.js'), wrapped)
