cask "typa" do
  arch arm: "aarch64", intel: "x64"

  version "0.1.0"
  sha256 arm: "feeb32c3d57fe6eea84dcb359ccc2980832b70030d178be1d6094308ac1fa3e5",
         intel: "3d8c6521e5bafe2d603f3234ff33aa4da1e8b9add07f06f594ec36e3a9f79144"

  url "https://github.com/tahsinature/typa/releases/download/v#{version}/Typa_#{version}_#{arch}.dmg"
  name "Typa"
  desc "Desktop workspace for text, data, and everyday tools"
  homepage "https://github.com/tahsinature/typa"

  auto_updates true

  app "Typa.app"
end
