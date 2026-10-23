import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateCask } from './generate-cask.mjs';
import { validateRelease } from './validate-release.mjs';

const directories = [];
function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'typa-release-'));
  directories.push(directory);
  return directory;
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true })));

test('cask maps both architectures to their actual DMG checksums', () => {
  const directory = temporaryDirectory();
  writeFileSync(join(directory, 'Typa_1.2.3_aarch64.dmg'), 'arm fixture');
  writeFileSync(join(directory, 'Typa_1.2.3_x64.dmg'), 'intel fixture');
  const cask = generateCask('1.2.3', directory);
  const sha = (value) => createHash('sha256').update(value).digest('hex');
  expect(cask).toContain(`sha256 arm: "${sha('arm fixture')}"`);
  expect(cask).toContain(`intel: "${sha('intel fixture')}"`);
  expect(cask).toContain('arch arm: "aarch64", intel: "x64"');
  expect(cask).toContain('releases/download/v#{version}/Typa_#{version}_#{arch}.dmg');
  expect(cask).toContain('auto_updates true');
});

test('missing architecture fails instead of publishing an incomplete cask', () => {
  const directory = temporaryDirectory();
  writeFileSync(join(directory, 'Typa_1.2.3_aarch64.dmg'), 'arm fixture');
  expect(() => generateCask('1.2.3', directory)).toThrow();
});

test('rejects prerelease and malformed cask versions', () => {
  for (const version of ['1.0.0-beta.1', 'v1.0.0', '1.0', '1.0.0"\nmalicious']) {
    expect(() => generateCask(version, '/unused')).toThrow();
  }
});

test('release tags must match all three app version files', () => {
  const directory = temporaryDirectory();
  mkdirSync(join(directory, 'apps/desktop/src-tauri'), { recursive: true });
  writeFileSync(join(directory, 'apps/desktop/src-tauri/tauri.conf.json'), '{"version":"1.2.3"}');
  writeFileSync(join(directory, 'apps/desktop/package.json'), '{"version":"1.2.3"}');
  writeFileSync(join(directory, 'apps/desktop/src-tauri/Cargo.toml'), '[package]\nversion = "1.2.3"');
  const root = pathToFileURL(`${directory}/`);
  expect(validateRelease('v1.2.3', root)).toBe('1.2.3');
  expect(() => validateRelease('v1.2.4', root)).toThrow('must match');
  writeFileSync(join(directory, 'apps/desktop/package.json'), '{"version":"1.2.2"}');
  expect(() => validateRelease('v1.2.3', root)).toThrow('must match');
  expect(() => validateRelease('v1.2.3-beta.1', root)).toThrow('stable releases only');
});
