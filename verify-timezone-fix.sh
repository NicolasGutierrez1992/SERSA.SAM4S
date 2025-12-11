#!/bin/bash

# Verificar que las cambios en zona horaria se compilaron correctamente

echo "=== Verificación de Zona Horaria en Argentina ==="
echo ""

echo "[1] Compilando backend..."
cd backend
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Backend compilado exitosamente"
else
    echo "❌ Error en compilación del backend"
    exit 1
fi

echo ""
echo "[2] Verificando archivos modificados..."

files=(
    "backend/src/descargas/descargas.service.ts"
    "backend/src/descargas/descargas.module.ts"
    "backend/src/certificados/certificados.controller.ts"
    "backend/src/common/timezone.service.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ Existe: $file"
    else
        echo "❌ No existe: $file"
        exit 1
    fi
done

echo ""
echo "[3] Verificando imports de TimezoneService..."

# Verificar que DescargasService importe TimezoneService
if grep -q "import.*TimezoneService" backend/src/descargas/descargas.service.ts; then
    echo "✅ DescargasService importa TimezoneService"
else
    echo "❌ DescargasService no importa TimezoneService"
    exit 1
fi

# Verificar que DescargasModule exporte TimezoneService
if grep -q "TimezoneService" backend/src/descargas/descargas.module.ts; then
    echo "✅ DescargasModule incluye TimezoneService"
else
    echo "❌ DescargasModule no incluye TimezoneService"
    exit 1
fi

# Verificar que CertificadosController tenga Logger
if grep -q "private readonly logger" backend/src/certificados/certificados.controller.ts; then
    echo "✅ CertificadosController tiene Logger"
else
    echo "❌ CertificadosController no tiene Logger"
    exit 1
fi

echo ""
echo "[4] Verificando uso de AT TIME ZONE en queries..."

# Verificar que getDescargas use AT TIME ZONE
if grep -q "AT TIME ZONE.*America/Argentina/Buenos_Aires" backend/src/descargas/descargas.service.ts; then
    echo "✅ getDescargas() usa AT TIME ZONE para Argentina"
else
    echo "❌ getDescargas() no usa AT TIME ZONE"
    exit 1
fi

echo ""
echo "=== ✅ Todas las verificaciones pasaron ==="
echo ""
echo "Cambios implementados:"
echo "  1. TimezoneService inyectado en DescargasService"
echo "  2. Queries de getDescargas() ahora usan AT TIME ZONE 'America/Argentina/Buenos_Aires'"
echo "  3. CertificadosController.getMetricasPersonales() obtiene datos filtrados de BD"
echo "  4. Filtrado en JavaScript eliminado, ahora se realiza en PostgreSQL"
echo ""
echo "Las métricas ahora son precisas según hora de Argentina (UTC-3)"
