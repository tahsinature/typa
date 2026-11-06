import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setVersion } from './set-version.mjs';

const directories = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true })));

function appFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'typa-release-'));
  directories.push(directory);
  mkdirSync(join(directory, 'apps/desktop/src-tauri'), { recursive: true });
  writeFileSync(join(directory, 'apps/desktop/package.json'), '{\n  "name": "@typa/desktop",\n  "version": "0.1.0"\n}');
  writeFileSync(join(directory, 'apps/desktop/src-tauri/tauri.conf.json'), '{\n  "productName": "Typa",\n  "version": "0.1.0"\n}');
  writeFileSync(join(directory, 'apps/desktop/src-tauri/Cargo.toml'), '[package]\nname = "typa"\nversion = "0.1.0"\n\n[dependencies]\nserde = { version = "1" }\n');
  return directory;
}

test('writes the version into all three app files and leaves dependency versions alone', () => {
  const directory = appFixture();
  setVersion('1.2.3', pathToFileURL(`${directory}/`));
  const read = (path) => readFileSync(join(directory, path), 'utf8');
  expect(JSON.parse(read('apps/desktop/package.json')).version).toBe('1.2.3');
  expect(JSON.parse(read('apps/desktop/src-tauri/tauri.conf.json')).version).toBe('1.2.3');
  expect(read('apps/desktop/src-tauri/Cargo.toml')).toContain('version = "1.2.3"\n\n[dependencies]\nserde = { version = "1" }');
});

test('rejects prerelease and malformed versions', () => {
  for (const version of ['1.0.0-beta.1', 'v1.0.0', '1.0', '1.0.0"\nmalicious']) {
    expect(() => setVersion(version, '/unused/')).toThrow();
  }
});
