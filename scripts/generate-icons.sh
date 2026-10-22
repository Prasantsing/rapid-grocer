#!/usr/bin/env bash
set -e

PUBLIC_DIR="frontend/public"
mkdir -p "$PUBLIC_DIR"

# 1. Standard icon SVG
cat << 'EOF' > "$PUBLIC_DIR/icon-standard.svg"
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0e6b4f"/>
  <g transform="translate(64, 64) scale(6)">
    <path d="M18 38c0-10 8-18 18-18 1 6-1 10-5 13 6 0 11 4 12 10H22c-2 0-4-2-4-5z" fill="#f0b429"/>
    <path d="M32 16c2 4 2 8 0 12" stroke="#fffdf8" stroke-width="3.2" stroke-linecap="round"/>
  </g>
</svg>
EOF

# 2. Maskable icon SVG (full bleed #0e6b4f background, 20% safe zone padding)
cat << 'EOF' > "$PUBLIC_DIR/icon-maskable.svg"
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0e6b4f"/>
  <g transform="translate(100, 100) scale(4.875)">
    <path d="M18 38c0-10 8-18 18-18 1 6-1 10-5 13 6 0 11 4 12 10H22c-2 0-4-2-4-5z" fill="#f0b429"/>
    <path d="M32 16c2 4 2 8 0 12" stroke="#fffdf8" stroke-width="3.2" stroke-linecap="round"/>
  </g>
</svg>
EOF

echo "Rendering PNG icons using ImageMagick..."
convert -background none -resize 192x192 "$PUBLIC_DIR/icon-standard.svg" "$PUBLIC_DIR/icon-192.png"
convert -background none -resize 512x512 "$PUBLIC_DIR/icon-standard.svg" "$PUBLIC_DIR/icon-512.png"
convert -background none -resize 180x180 "$PUBLIC_DIR/icon-standard.svg" "$PUBLIC_DIR/apple-touch-icon.png"
convert -background none -resize 512x512 "$PUBLIC_DIR/icon-maskable.svg" "$PUBLIC_DIR/icon-maskable-512.png"

echo "Generated icons successfully:"
ls -la "$PUBLIC_DIR"/icon-*.png "$PUBLIC_DIR"/apple-touch-icon.png
