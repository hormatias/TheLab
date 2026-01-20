#!/bin/bash

# Script para ejecutar migraciones de Supabase
# Uso: ./scripts/migrate.sh [project-ref]

set -e

echo "🚀 Ejecutando migraciones de Supabase..."

# Verificar si se proporcionó el project-ref
if [ -z "$1" ]; then
    echo "❌ Error: Necesitas proporcionar el project reference ID"
    echo ""
    echo "Para obtenerlo:"
    echo "1. Ve a https://supabase.com/dashboard"
    echo "2. Selecciona tu proyecto"
    echo "3. Ve a Settings > General"
    echo "4. Copia el 'Reference ID'"
    echo ""
    echo "Uso: ./scripts/migrate.sh <project-ref>"
    echo ""
    echo "O ejecuta manualmente:"
    echo "  supabase link --project-ref <tu-project-ref>"
    echo "  supabase db push"
    exit 1
fi

PROJECT_REF=$1

echo "📦 Vinculando con el proyecto: $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF"

echo "📤 Enviando migraciones..."
supabase db push

echo "✅ Migraciones ejecutadas exitosamente!"
