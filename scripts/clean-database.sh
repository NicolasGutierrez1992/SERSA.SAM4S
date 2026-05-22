#!/bin/bash
# Script para limpiar la base de datos de SERSA

MODE="${1:-confirm}"

echo "=================================================="
echo "  Limpiador de Base de Datos - SERSA"
echo "=================================================="
echo ""

# Obtener configuración de .env
if [ ! -f "backend/.env" ]; then
    echo "❌ Error: No se encontró archivo .env"
    exit 1
fi

# Parsear variables de .env
DB_HOST=$(grep '^DB_HOST=' backend/.env | cut -d'=' -f2)
DB_PORT=$(grep '^DB_PORT=' backend/.env | cut -d'=' -f2)
DB_USERNAME=$(grep '^DB_USERNAME=' backend/.env | cut -d'=' -f2)
DB_PASSWORD=$(grep '^DB_PASSWORD=' backend/.env | cut -d'=' -f2)
DB_NAME=$(grep '^DB_NAME=' backend/.env | cut -d'=' -f2)

echo "📊 Configuración de BD:"
echo "   Host: $DB_HOST"
echo "   Puerto: $DB_PORT"
echo "   Usuario: $DB_USERNAME"
echo "   Base de datos: $DB_NAME"
echo ""

if [ "$MODE" = "confirm" ]; then
    echo "¿Qué deseas hacer?"
    echo "1. Limpiar TODO (elimina y recrea tablas)"
    echo "2. Solo limpiar datos (mantiene estructura)"
    echo "3. Cancelar"
    echo ""
    read -p "Selecciona una opción (1-3): " choice
    
    if [ "$choice" = "1" ]; then
        MODE="full"
    elif [ "$choice" = "2" ]; then
        MODE="data-only"
    else
        echo "Cancelado."
        exit 0
    fi
fi

echo ""
echo "⚠️  ADVERTENCIA"
echo "   Se van a eliminar datos de la base de datos."
echo "   Esta acción NO se puede deshacer."
echo ""

read -p "¿Estás seguro? (escribe 'SÍ' para confirmar): " confirm
if [ "$confirm" != "SÍ" ]; then
    echo "Cancelado."
    exit 0
fi

echo ""
echo "Ejecutando limpieza..."
echo ""

if [ "$MODE" = "full" ]; then
    echo "🗑️  Modo: Limpiar TODO (eliminar schema y recrear)"
    echo ""
    
    cd backend
    echo "Ejecutando: npm run typeorm schema:drop"
    npm run typeorm schema:drop -- --connection default
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Schema eliminado exitosamente"
        echo ""
        echo "Las tablas serán recreadas automáticamente cuando inicies la app:"
        echo "   npm start"
    else
        echo "❌ Error ejecutando limpieza"
        exit 1
    fi
    
elif [ "$MODE" = "data-only" ]; then
    echo "🗑️  Modo: Limpiar solo datos (mantener estructura)"
    echo ""
    
    # Crear archivo SQL temporal
    SQL_FILE="/tmp/clean_db_$RANDOM.sql"
    
    cat > "$SQL_FILE" << EOF
-- Limpiar datos de la base de datos
BEGIN;

TRUNCATE TABLE "certificados_maestro" CASCADE;
TRUNCATE TABLE "certificados_v2" CASCADE;
TRUNCATE TABLE "descargas" CASCADE;
TRUNCATE TABLE "auditoria" CASCADE;
TRUNCATE TABLE "users" CASCADE;

COMMIT;
EOF
    
    echo "Conectando a PostgreSQL..."
    export PGPASSWORD="$DB_PASSWORD"
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -f "$SQL_FILE"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Datos eliminados exitosamente"
        echo ""
        echo "Tablas limpiadas:"
        echo "   ✓ certificados_maestro"
        echo "   ✓ certificados_v2"
        echo "   ✓ descargas"
        echo "   ✓ auditoria"
        echo "   ✓ users"
    else
        echo "❌ Error ejecutando limpieza"
        rm -f "$SQL_FILE"
        exit 1
    fi
    
    rm -f "$SQL_FILE"
    unset PGPASSWORD
fi

echo ""
echo "=================================================="
echo "✅ Limpieza completada"
echo "=================================================="
echo ""
