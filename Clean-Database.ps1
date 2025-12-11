#!/usr/bin/env pwsh
# Script para limpiar la base de datos de SERSA

param(
    [ValidateSet('full', 'data-only', 'confirm')]
    [string]$Mode = 'confirm'
)

Write-Host "=================================================="
Write-Host "  Limpiador de Base de Datos - SERSA" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host ""

# Obtener configuración de .env
$envFile = Join-Path -Path (Get-Location) -ChildPath "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ Error: No se encontró archivo .env" -ForegroundColor Red
    exit 1
}

# Parsear variables de .env
$dbHost = (Select-String -Path $envFile -Pattern '^DB_HOST=(.*)$' -AllMatches).Matches.Groups[1].Value
$dbPort = (Select-String -Path $envFile -Pattern '^DB_PORT=(.*)$' -AllMatches).Matches.Groups[1].Value
$dbUsername = (Select-String -Path $envFile -Pattern '^DB_USERNAME=(.*)$' -AllMatches).Matches.Groups[1].Value
$dbPassword = (Select-String -Path $envFile -Pattern '^DB_PASSWORD=(.*)$' -AllMatches).Matches.Groups[1].Value
$dbName = (Select-String -Path $envFile -Pattern '^DB_NAME=(.*)$' -AllMatches).Matches.Groups[1].Value

Write-Host "📊 Configuración de BD:" -ForegroundColor Yellow
Write-Host "   Host: $dbHost"
Write-Host "   Puerto: $dbPort"
Write-Host "   Usuario: $dbUsername"
Write-Host "   Base de datos: $dbName"
Write-Host ""

if ($Mode -eq 'confirm') {
    Write-Host "¿Qué deseas hacer?" -ForegroundColor Cyan
    Write-Host "1. Limpiar TODO (elimina y recrea tablas)"
    Write-Host "2. Solo limpiar datos (mantiene estructura)"
    Write-Host "3. Cancelar"
    Write-Host ""
    $choice = Read-Host "Selecciona una opción (1-3)"
    
    if ($choice -eq '1') {
        $Mode = 'full'
    } elseif ($choice -eq '2') {
        $Mode = 'data-only'
    } else {
        Write-Host "Cancelado." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "⚠️  ADVERTENCIA" -ForegroundColor Red
Write-Host "   Se van a eliminar datos de la base de datos."
Write-Host "   Esta acción NO se puede deshacer."
Write-Host ""

$confirm = Read-Host "¿Estás seguro? (escribe 'SÍ' para confirmar)"
if ($confirm -ne 'SÍ') {
    Write-Host "Cancelado." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Ejecutando limpieza..." -ForegroundColor Cyan
Write-Host ""

# Construir string de conexión
$connectionString = "postgresql://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/${dbName}"

if ($Mode -eq 'full') {
    Write-Host "🗑️  Modo: Limpiar TODO (eliminar schema y recrear)" -ForegroundColor Red
    Write-Host ""
    
    try {
        cd backend
        Write-Host "Ejecutando: npm run typeorm schema:drop" -ForegroundColor Gray
        npm run typeorm schema:drop -- --connection default 2>&1
        
        Write-Host ""
        Write-Host "✅ Schema eliminado exitosamente" -ForegroundColor Green
        Write-Host ""
        Write-Host "Las tablas serán recreadas automáticamente cuando inicies la app:" -ForegroundColor Yellow
        Write-Host "   npm start" -ForegroundColor Cyan
        
    } catch {
        Write-Host "❌ Error ejecutando limpieza: $_" -ForegroundColor Red
        exit 1
    }
    
} elseif ($Mode -eq 'data-only') {
    Write-Host "🗑️  Modo: Limpiar solo datos (mantener estructura)" -ForegroundColor Yellow
    Write-Host ""
    
    # Para PostgreSQL, usar TRUNCATE con CASCADE
    $truncateTables = @(
        'certificados_maestro',
        'certificados_v2',
        'descargas',
        'auditoria',
        'users'
    )
    
    # Crear archivo SQL temporal
    $sqlFile = "$env:TEMP\clean_db_$([DateTime]::Now.Ticks).sql"
    
    $sqlContent = @"
-- Limpiar datos de la base de datos
BEGIN;

"@
    
    foreach ($table in $truncateTables) {
        $sqlContent += "TRUNCATE TABLE `"$table`" CASCADE;`n"
    }
    
    $sqlContent += @"
COMMIT;
"@
    
    $sqlContent | Out-File -FilePath $sqlFile -Encoding UTF8
    
    try {
        # Ejecutar script SQL
        Write-Host "Conectando a PostgreSQL..." -ForegroundColor Gray
        $env:PGPASSWORD = $dbPassword
        
        & psql -h $dbHost -p $dbPort -U $dbUsername -d $dbName -f $sqlFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Datos eliminados exitosamente" -ForegroundColor Green
            Write-Host ""
            Write-Host "Tablas limpiadas:" -ForegroundColor Yellow
            foreach ($table in $truncateTables) {
                Write-Host "   ✓ $table" -ForegroundColor Green
            }
        } else {
            Write-Host "❌ Error ejecutando limpieza" -ForegroundColor Red
            exit 1
        }
        
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        exit 1
    } finally {
        # Limpiar archivo temporal
        Remove-Item -Path $sqlFile -Force -ErrorAction SilentlyContinue
        Remove-Item -Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "=================================================="
Write-Host "✅ Limpieza completada" -ForegroundColor Green
Write-Host "=================================================="
Write-Host ""
