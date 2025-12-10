# Script para desplegar cambios a Railway
# Uso: .\deploy-to-railway.ps1

param(
    [switch]$SkipBuild = $false
)

Write-Host "🚀 SERSA Backend - Deploy a Railway" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Función para imprimir con colores
function Write-Step {
    param([string]$step, [string]$message)
    Write-Host "[$step] $message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$message)
    Write-Host "✅ $message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$message)
    Write-Host "❌ $message" -ForegroundColor Red
}

# Paso 1: Verificar rama
Write-Step "1/5" "Verificando rama de Git..."
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main" -and $branch -ne "master") {
    Write-Error-Custom "Debes estar en rama 'main' o 'master'. Rama actual: $branch"
    exit 1
}
Write-Success "Rama correcta: $branch"
Write-Host ""

# Paso 2: Compilar (opcional)
if (-not $SkipBuild) {
    Write-Step "2/5" "Compilando backend..."
    Set-Location backend
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Error compilando backend"
        exit 1
    }
    Set-Location ..
    Write-Success "Backend compilado exitosamente"
} else {
    Write-Host "[2/5] Compilación saltada (--SkipBuild)" -ForegroundColor Yellow
}
Write-Host ""

# Paso 3: Hacer commit
Write-Step "3/5" "Preparando cambios para commit..."
git add .
$changes = git diff --cached --quiet
if ($changes) {
    Write-Host "No hay cambios para commitear" -ForegroundColor Yellow
} else {
    git commit -m "fix: CORS configuration for production deployment

- Added Vercel frontend URL to CORS allowed origins
- Configured dynamic CORS origin loading from environment variables
- Updated .env.production with correct origins
- Backend now allows requests from https://sersa-sam-4-s-frontend-t6wz.vercel.app"
    Write-Success "Cambios comiteados"
}
Write-Host ""

# Paso 4: Push
Write-Step "4/5" "Enviando cambios a GitHub..."
git push origin $branch
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Error en push. Verifica tu conexión a Git"
    exit 1
}
Write-Success "Push completado"
Write-Host ""

# Paso 5: Información
Write-Step "5/5" "Información de despliegue..."
Write-Host ""
Write-Success "Cambios enviados a Git"
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Railway detectará automáticamente los cambios"
Write-Host "2. El despliegue comenzará en unos segundos"
Write-Host "3. Puedes monitorear el despliegue en: https://railway.app"
Write-Host ""
Write-Host "🔍 Verificar despliegue:" -ForegroundColor Cyan
Write-Host "   - Con Railway CLI: railway logs"
Write-Host "   - O revisa el dashboard de Railway"
Write-Host ""
Write-Host "🧪 Probar después del despliegue:" -ForegroundColor Cyan
Write-Host "   curl https://sersa-backend-production.up.railway.app/api/health"
Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ Deploy iniciado exitosamente" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
