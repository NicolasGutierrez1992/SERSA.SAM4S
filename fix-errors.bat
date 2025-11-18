@echo off
echo 🔧 SERSA - Arreglo Rapido de Errores
echo.

echo [1/5] Verificando directorio actual...
if not exist "package.json" (
    echo ❌ Error: No estas en el directorio raiz de SERSA
    echo Navega a: C:\Users\Nicol\OneDrive\Documentos\GitHub\SERSA
    pause
    exit /b 1
)
echo ✅ Directorio correcto

echo.
echo [2/5] Limpiando instalaciones anteriores...
if exist "node_modules" rmdir /s /q "node_modules"
if exist "backend\node_modules" rmdir /s /q "backend\node_modules"  
if exist "frontend\node_modules" rmdir /s /q "frontend\node_modules"
echo ✅ Cache limpiado

echo.
echo [3/5] Instalando dependencias raiz...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Error instalando dependencias raiz
    pause
    exit /b 1
)

echo.
echo [4/5] Instalando dependencias backend...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Error instalando dependencias backend
    pause
    exit /b 1
)

echo ✅ Backend instalado
cd ..

echo.
echo [5/5] Instalando dependencias frontend...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Error instalando dependencias frontend
    pause
    exit /b 1
)

echo ✅ Frontend instalado
cd ..

echo.
echo 🎉 Instalacion completada!
echo.
echo Probando el sistema...
echo =====================

echo.
echo Iniciando backend (10 segundos)...
start "SERSA Backend" cmd /k "cd backend && npm run start:dev"

timeout /t 5 /nobreak > nul

echo.
echo Iniciando frontend...
start "SERSA Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ✅ Sistema iniciado!
echo.
echo URLs disponibles:
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:3001/api
echo - Docs:     http://localhost:3001/api/docs
echo.
echo Credenciales de prueba:
echo CUIT: 20123456789
echo Password: admin
echo.

pause