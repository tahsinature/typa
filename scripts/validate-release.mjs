import { readFileSync } from 'node:fs';

export function validateRelease(tag, root = new URL('../', import.meta.url)) {
  const version = tag?.match(/^v(\d+\.\d+\.\d+)$/)?.[1];
  if (!version) throw new Error('Release tag must be vMAJOR.MINOR.PATCH (stable releases only).');

  const config = JSON.parse(readFileSync(new URL('apps/desktop/src-tauri/tauri.conf.json', root)));
  const desktop = JSON.parse(readFileSync(new URL('apps/desktop/package.json', root)));
  const cargo = readFileSync(new URL('apps/desktop/src-tauri/Cargo.toml', root), 'utf8');
  const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if ([config.version, desktop.version, cargoVersion].some((value) => value !== version)) {
    throw new Error('Tag, tauri.conf.json, desktop package.json, and Cargo.toml versions must match.');
  }
  return version;
}

if (import.meta.main) {
  console.log(validateRelease(process.argv[2]));
}
