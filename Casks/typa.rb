cask "typa" do
  arch arm: "aarch64", intel: "x64"

  version "0.1.3"
  sha256 arm: "f4c3822de74b6dd8ebcefc26aac08022536ebd6b7f5cc72be265510661204d27",
         intel: "cca0979f37c46e3aebd70e16517ce160418d752a35993c09e3fcf9442ebc5df8"

  url "https://github.com/tahsinature/typa/releases/download/v#{version}/Typa_#{version}_#{arch}.dmg"
  name "Typa"
  desc "Desktop workspace for text, data, and everyday tools"
  homepage "https://github.com/tahsinature/typa"

  auto_updates true

  app "Typa.app"
end
