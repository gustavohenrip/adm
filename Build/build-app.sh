#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js nao encontrado. Instale Node.js 20 ou maior."
  exit 1
fi

node "$DIR/build-app.mjs" "$@"
