cask "typa" do
  arch arm: "aarch64", intel: "x64"

  version "0.1.2"
  sha256 arm: "0a59e6ec8d685ea574b4e87dcc9e51d418ea34e11efbb8174c2c5078827f5e03",
         intel: "f1df4bb52288d22fec323e92fe9551fd1c32b35d4240ba9fbe48ea05137142e8"

  url "https://github.com/tahsinature/typa/releases/download/v#{version}/Typa_#{version}_#{arch}.dmg"
  name "Typa"
  desc "Desktop workspace for text, data, and everyday tools"
  homepage "https://github.com/tahsinature/typa"

  auto_updates true

  app "Typa.app"
end
