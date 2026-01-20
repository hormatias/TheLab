#!/bin/bash

# Script para compilar e instalar la app en iPhone
# Uso: npm run ios:build

set -e

echo "🔨 Compilando frontend..."
npm run build

echo "📱 Compilando para iOS..."
unset CI
export PATH="/opt/homebrew/opt/ruby/bin:/opt/homebrew/lib/ruby/gems/4.0.0/bin:/opt/homebrew/bin:$PATH"

# Detectar el dispositivo conectado
DEVICE_ID=$(xcrun xctrace list devices | grep -i "imatias" | grep -oE "\([0-9A-F-]+\)" | tr -d '()' | head -1)

if [ -z "$DEVICE_ID" ]; then
  echo "❌ No se encontró el dispositivo 'iMatias'. Asegúrate de que esté conectado."
  exit 1
fi

echo "📲 Dispositivo detectado: $DEVICE_ID"

# Compilar
npx tauri ios build

# Instalar
IPA_PATH="src-tauri/gen/apple/build/arm64/TheLab.ipa"

if [ -f "$IPA_PATH" ]; then
  echo "📦 Instalando en iPhone..."
  xcrun devicectl device install app --device "$DEVICE_ID" "$IPA_PATH"
  echo "✅ App instalada exitosamente en tu iPhone!"
else
  echo "❌ No se encontró el archivo IPA en $IPA_PATH"
  exit 1
fi
