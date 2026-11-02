#!/usr/bin/env bash
set -e

echo "=========================================="
echo "  ZapBasket Grocery Direct Run Setup"
echo "=========================================="

# 1. Ensure .env exists
if [ ! -f .env ]; then
  echo "[-] Creating .env from .env.example..."
  cp .env.example .env
  echo "[+] Created default .env"
fi

# 2. Check if frontend build exists for unified server
if [ ! -f "frontend/dist/frontend/browser/index.html" ]; then
  echo "[*] Frontend bundle not found. Building frontend..."
  npm run build:frontend
fi

echo ""
echo "[*] Launching ZapBasket with both backend and frontend..."
echo "    - Unified Mode URL: http://localhost:3000"
echo "    - API Base URL:     http://localhost:3000/api/v1"
echo "    - Swagger Docs:     http://localhost:3000/api/docs"
echo "    - API Health Check: http://localhost:3000/api/v1/health"
echo ""

npm run dev:all
