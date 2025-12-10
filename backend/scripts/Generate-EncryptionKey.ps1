# Script para generar clave de encriptación segura en Windows

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Generador de Clave de Encriptación" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Generar clave de 32 bytes (256 bits) en formato hexadecimal
$bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$ENCRYPTION_KEY = [System.Convert]::ToHexString($bytes)

Write-Host "✓ Clave de encriptación generada:" -ForegroundColor Green
Write-Host ""
Write-Host "ENCRYPTION_KEY=$ENCRYPTION_KEY" -ForegroundColor Yellow
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "INSTRUCCIONES:" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "1. Copia la línea anterior completa" -ForegroundColor White
Write-Host "2. Agrega a tu archivo .env" -ForegroundColor White
Write-Host "3. NO compartas esta clave" -ForegroundColor White
Write-Host "4. IMPORTANTE: Haz backup de esta clave" -ForegroundColor Red
Write-Host "   (necesaria para desencriptar certificados)" -ForegroundColor Red
Write-Host ""
Write-Host "Ejemplo en .env:" -ForegroundColor White
Write-Host "ENCRYPTION_KEY=$ENCRYPTION_KEY" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Cyan

# Copiar al portapapeles (opcional)
$ENCRYPTION_KEY | Set-Clipboard
Write-Host ""
Write-Host "✓ Clave copiada al portapapeles" -ForegroundColor Green
