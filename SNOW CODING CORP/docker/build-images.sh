#!/bin/bash
# Build all Docker images for SNOW IDE code execution
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGES_DIR="$SCRIPT_DIR/images"
failed=0
build_args=()
if [ -n "${CODEX_PROXY_CERT:-}" ]; then
  build_args+=(--secret "id=proxy_ca,src=$CODEX_PROXY_CERT")
fi

echo "========================================="
echo "  Building SNOW IDE Docker Images"
echo "========================================="

for lang_dir in "$IMAGES_DIR"/*/; do
  lang=$(basename "$lang_dir")
  if [ -f "$lang_dir/Dockerfile" ]; then
    echo ""
    echo "[Building] snow-ide-$lang..."
    if docker build "${build_args[@]}" -t "snow-ide-$lang" "$lang_dir"; then
      echo "[OK] snow-ide-$lang built successfully"
    else
      echo "[ERROR] Failed to build snow-ide-$lang"
      failed=1
    fi
  fi
done

echo ""
echo "========================================="
echo "  Build complete!"
echo "========================================="
exit "$failed"
