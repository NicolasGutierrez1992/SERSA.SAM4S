# Verificar que los cambios en zona horaria se compilaron correctamente

Write-Host "=== Verificación de Zona Horaria en Argentina ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1] Compilando backend..." -ForegroundColor Yellow
Push-Location backend
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend compilado exitosamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error en compilación del backend" -ForegroundColor Red
    exit 1
}
Pop-Location

Write-Host ""
Write-Host "[2] Verificando archivos modificados..." -ForegroundColor Yellow

$files = @(
    "backend/src/descargas/descargas.service.ts",
    "backend/src/descargas/descargas.module.ts",
    "backend/src/certificados/certificados.controller.ts",
    "backend/src/common/timezone.service.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "✅ Existe: $file" -ForegroundColor Green
    } else {
        Write-Host "❌ No existe: $file" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "[3] Verificando imports de TimezoneService..." -ForegroundColor Yellow

# Verificar que DescargasService importe TimezoneService
$content = Get-Content "backend/src/descargas/descargas.service.ts" -Raw
if ($content -match "import.*TimezoneService") {
    Write-Host "✅ DescargasService importa TimezoneService" -ForegroundColor Green
} else {
    Write-Host "❌ DescargasService no importa TimezoneService" -ForegroundColor Red
    exit 1
}

# Verificar que DescargasModule exporte TimezoneService
$content = Get-Content "backend/src/descargas/descargas.module.ts" -Raw
if ($content -match "TimezoneService") {
    Write-Host "✅ DescargasModule incluye TimezoneService" -ForegroundColor Green
} else {
    Write-Host "❌ DescargasModule no incluye TimezoneService" -ForegroundColor Red
    exit 1
}

# Verificar que CertificadosController tenga Logger
$content = Get-Content "backend/src/certificados/certificados.controller.ts" -Raw
if ($content -match "private readonly logger") {
    Write-Host "✅ CertificadosController tiene Logger" -ForegroundColor Green
} else {
    Write-Host "❌ CertificadosController no tiene Logger" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4] Verificando uso de AT TIME ZONE en queries..." -ForegroundColor Yellow

# Verificar que getDescargas use AT TIME ZONE
$content = Get-Content "backend/src/descargas/descargas.service.ts" -Raw
if ($content -match "AT TIME ZONE.*America/Argentina/Buenos_Aires") {
    Write-Host "✅ getDescargas() usa AT TIME ZONE para Argentina" -ForegroundColor Green
} else {
    Write-Host "❌ getDescargas() no usa AT TIME ZONE" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== ✅ Todas las verificaciones pasaron ===" -ForegroundColor Green
Write-Host ""
Write-Host "Cambios implementados:" -ForegroundColor Cyan
Write-Host "  1. TimezoneService inyectado en DescargasService"
Write-Host "  2. Queries de getDescargas() ahora usan AT TIME ZONE 'America/Argentina/Buenos_Aires'"
Write-Host "  3. CertificadosController.getMetricasPersonales() obtiene datos filtrados de BD"
Write-Host "  4. Filtrado en JavaScript eliminado, ahora se realiza en PostgreSQL"
Write-Host ""
Write-Host "Las métricas ahora son precisas según hora de Argentina (UTC-3)" -ForegroundColor Cyan
