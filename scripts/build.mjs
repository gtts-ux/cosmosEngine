import { build } from 'esbuild';
import { mkdir, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { ensureAssets } from './assets.mjs';
await ensureAssets();
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/app.js'], bundle: true, format: 'esm',
  outfile: 'dist/app.js', target: 'chrome140', sourcemap: true,
  minify: true, legalComments: 'eof',
});
execFileSync('node', ['node_modules/@tailwindcss/cli/dist/index.mjs', '-i', 'src/styles.css', '-o', 'dist/styles.css', '--minify'], { stdio: 'inherit' });
await cp('src/index.html', 'dist/index.html');
await cp('assets', 'dist/assets', { recursive: true });
console.log('Built offline renderer in dist/');
