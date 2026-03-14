#!/bin/bash
# Build all Docker images for SNOW IDE code execution

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGES_DIR="$SCRIPT_DIR/images"

echo "========================================="
echo "  Building SNOW IDE Docker Images"
echo "========================================="

for lang_dir in "$IMAGES_DIR"/*/; do
  lang=$(basename "$lang_dir")
  if [ -f "$lang_dir/Dockerfile" ]; then
    echo ""
    echo "[Building] snow-ide-$lang..."
    docker build -t "snow-ide-$lang" "$lang_dir"
    if [ $? -eq 0 ]; then
      echo "[OK] snow-ide-$lang built successfully"
    else
      echo "[ERROR] Failed to build snow-ide-$lang"
    fi
  fi
done

echo ""
echo "========================================="
echo "  Build complete!"
echo "========================================="
