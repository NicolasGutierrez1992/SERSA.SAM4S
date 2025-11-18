@echo off
echo 🧪 Prueba Rapida - SERSA Backend
echo.

echo [1/3] Navegando al directorio backend...
cd /d "%~dp0backend"
if not exist "src\main.ts" (
    echo ❌ Error: No se encuentra el archivo main.ts
    echo Verifica que estes en el directorio correcto de SERSA
    pause
    exit /b 1
)

echo ✅ Directorio correcto

echo.
echo [2/3] Compilando TypeScript...
call npx tsc --noEmit
if %errorlevel% neq 0 (
    echo.
    echo ❌ Errores de compilación encontrados
    echo Revisa los errores arriba y corrígelos
    pause
    exit /b 1
)

echo ✅ TypeScript compila sin errores

echo.
echo [3/3] Iniciando servidor de prueba...
echo ⏳ Iniciando servidor (presiona Ctrl+C para parar)...
echo.

call npm run start:dev

pause