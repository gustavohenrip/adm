#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js nao encontrado. Instale Node.js 20 ou maior."
  echo
  read -r -p "Pressione Enter para fechar..."
  exit 1
fi

node "$DIR/build-app.mjs" "$@"
CODE=$?
echo
if [ "$CODE" -eq 0 ]; then
  echo "Build finalizado."
else
  echo "Build falhou com codigo $CODE."
fi
echo
read -r -p "Pressione Enter para fechar..."
exit "$CODE"
