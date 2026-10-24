"""Check the built app, updater archive, and app inside every DMG before publication."""

import plistlib
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path


def verify_app(app):
    subprocess.run(
        ["codesign", "--verify", "--deep", "--strict", "--verbose=2", str(app)],
        check=True,
    )


def require_files(directory, pattern):
    paths = list(directory.glob(pattern))
    if not paths:
        raise RuntimeError(f"Missing release artifact: {directory / pattern}")
    return paths


def verify_bundles(directory):
    for app in require_files(directory / "macos", "*.app"):
        verify_app(app)

    for archive in require_files(directory / "macos", "*.app.tar.gz"):
        with tempfile.TemporaryDirectory(prefix="typa-archive-") as temporary:
            with tarfile.open(archive) as source:
                source.extractall(temporary, filter="data")
            for app in require_files(Path(temporary), "*.app"):
                verify_app(app)

    for image in require_files(directory / "dmg", "*.dmg"):
        with tempfile.TemporaryDirectory(prefix="typa-dmg-") as temporary:
            mount = Path(temporary) / "mount"
            result = subprocess.check_output([
                "hdiutil", "attach", "-readonly", "-nobrowse", "-plist",
                "-mountpoint", str(mount), str(image),
            ])
            try:
                plistlib.loads(result)  # Also reject an unexpected attach response.
                for app in require_files(mount, "*.app"):
                    verify_app(app)
            finally:
                subprocess.run(["hdiutil", "detach", str(mount)], check=True)


if __name__ == "__main__":
    verify_bundles(Path(sys.argv[1]))
