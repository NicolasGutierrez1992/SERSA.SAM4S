# Script de limpieza para eliminar archivos duplicados del proyecto SERSA
# Ejecutar desde la carpeta backend: .\cleanup-duplicates.ps1

Write-Host "🧹 Iniciando limpieza de archivos duplicados..." -ForegroundColor Green

# Archivos duplicados a eliminar del módulo certificados
$filesToDelete = @(
    "src\certificados\entities\descarga.entity.ts",
    "src\certificados\descargas.service.ts",
    "src\certificados\dto\descarga.dto.ts", 
    "src\certificados\certificados.service.real.ts"
)

foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        Write-Host "🗑️  Eliminando: $file" -ForegroundColor Red
        Remove-Item $file -Force
    } else {
        Write-Host "✅ Ya eliminado: $file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📋 Verificando estructura correcta:" -ForegroundColor Cyan

$requiredFiles = @{
    "src\descargas\entities\descarga.entity.ts" = "Entidad Descarga"
    "src\descargas\descargas.service.ts" = "Servicio Descargas"
    "src\descargas\dto\descarga.dto.ts" = "DTOs Descargas"
    "src\certificados\certificados.service.ts" = "Servicio Certificados"
}

foreach ($file in $requiredFiles.Keys) {
    $status = if (Test-Path $file) { "EXISTE ✅" } else { "FALTA ❌" }
    Write-Host "  $($requiredFiles[$file]) - $status"
}

Write-Host ""
Write-Host "🎯 Estructura final deseada:" -ForegroundColor Magenta
Write-Host "📁 src/certificados/"
Write-Host "   ├── certificados.controller.ts"
Write-Host "   ├── certificados.service.ts (solo generación AFIP)"
Write-Host "   ├── certificados.module.ts"
Write-Host "   └── entities/"
Write-Host "       └── certificado.entity.ts"
Write-Host ""
Write-Host "📁 src/descargas/"
Write-Host "   ├── descargas.service.ts (manejo completo descargas)"
Write-Host "   ├── descargas.module.ts"
Write-Host "   ├── entities/"
Write-Host "   │   └── descarga.entity.ts"
Write-Host "   └── dto/"
Write-Host "       └── descarga.dto.ts"

Write-Host ""
Write-Host "✨ Limpieza completada!" -ForegroundColor Green
Write-Host "🔄 Ejecuta 'npm run build' para verificar que no hay errores de compilación." -ForegroundColor Blue