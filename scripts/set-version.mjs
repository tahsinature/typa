// Writes one version into every file that carries the app version.
// The release workflow runs this before building, without committing the result.
import { readFileSync, writeFileSync } from 'node:fs';

export function setVersion(version, root = new URL('../', import.meta.url)) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable MAJOR.MINOR.PATCH version.');

  const update = (path, change) => {
    const url = new URL(path, root);
    writeFileSync(url, change(readFileSync(url, 'utf8')));
  };
  const setJsonVersion = (text) => text.replace(/("version"\s*:\s*")[^"]+"/, `$1${version}"`);

  update('apps/desktop/package.json', setJsonVersion);
  update('apps/desktop/src-tauri/tauri.conf.json', setJsonVersion);
  update('apps/desktop/src-tauri/Cargo.toml', (text) => text.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`));
}

if (import.meta.main) {
  setVersion(process.argv[2]);
}
