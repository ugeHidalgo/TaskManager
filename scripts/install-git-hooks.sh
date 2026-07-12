#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

if [[ ! -f "${repo_root}/.githooks/pre-commit" ]]; then
  echo "Missing hook file: ${repo_root}/.githooks/pre-commit" >&2
  exit 1
fi

chmod +x "${repo_root}/.githooks/pre-commit"
git -C "${repo_root}" config core.hooksPath .githooks

echo "Git hooks installed. core.hooksPath=$(git -C "${repo_root}" config --get core.hooksPath)"
