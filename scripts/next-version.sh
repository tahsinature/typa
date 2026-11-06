#!/usr/bin/env bash
# Prints the next version, based on the commits since the latest v* tag.
#
#   scripts/next-version.sh [auto|patch|minor|major]
#
# In auto mode (the default), commit messages decide the bump:
#   feat!: ... or a "BREAKING CHANGE:" line   -> major
#   feat: ...                                -> minor
#   anything else                            -> patch
# Prints nothing when there are no new commits.
set -euo pipefail

bump="${1:-auto}"
last_tag="$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || true)"

if [[ -n "$last_tag" ]]; then
  range="$last_tag..HEAD"
  version="${last_tag#v}"
else
  range="HEAD"
  version="0.0.0"
fi

if [[ "$bump" == "auto" ]]; then
  [[ -n "$(git rev-list "$range")" ]] || exit 0
  subjects="$(git log "$range" --format='%s')"
  bodies="$(git log "$range" --format='%b')"
  if grep -qE '^[a-z]+(\([^)]*\))?!:' <<<"$subjects" || grep -q '^BREAKING CHANGE:' <<<"$bodies"; then
    bump="major"
  elif grep -qE '^feat(\([^)]*\))?:' <<<"$subjects"; then
    bump="minor"
  else
    bump="patch"
  fi
fi

IFS=. read -r major minor patch <<<"$version"
case "$bump" in
  major) echo "$((major + 1)).0.0" ;;
  minor) echo "$major.$((minor + 1)).0" ;;
  patch) echo "$major.$minor.$((patch + 1))" ;;
  *) echo "Unknown bump: $bump" >&2; exit 1 ;;
esac
