#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="/home/ole/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

case "${1:-}" in
  typecheck)
    echo "=== Type checking ==="
    npx tsc -b
    ;;
  build)
    echo "=== Building ==="
    npm run build
    ;;
  lint)
    echo "=== Linting ==="
    npm run lint
    ;;
  test)
    echo "=== Running tests ==="
    npx vitest run
    ;;
  verify)
    echo "=== Type checking ==="
    npx tsc -b
    echo "=== Linting ==="
    npm run lint
    echo "=== Building ==="
    npm run build
    echo "=== All checks passed ==="
    ;;
  *)
    echo "Usage: ./run.sh <typecheck|build|lint|test|verify>"
    exit 1
    ;;
esac
