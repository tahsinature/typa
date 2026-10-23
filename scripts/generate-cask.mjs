import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function generateCask(version, directory) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable MAJOR.MINOR.PATCH version.');
  const checksum = (arch) => createHash('sha256')
    .update(readFileSync(join(directory, `Typa_${version}_${arch}.dmg`)))
    .digest('hex');

  return `cask "typa" do
  arch arm: "aarch64", intel: "x64"

  version "${version}"
  sha256 arm: "${checksum('aarch64')}",
         intel: "${checksum('x64')}"

  url "https://github.com/tahsinature/typa/releases/download/v#{version}/Typa_#{version}_#{arch}.dmg"
  name "Typa"
  desc "Desktop workspace for text, data, and everyday tools"
  homepage "https://github.com/tahsinature/typa"

  auto_updates true

  app "Typa.app"
end
`;
}

if (import.meta.main) {
  const [, , version, directory, output] = process.argv;
  if (!directory || !output) throw new Error('Usage: bun scripts/generate-cask.mjs VERSION DMG_DIRECTORY OUTPUT');
  const cask = generateCask(version, directory);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, cask);
}
