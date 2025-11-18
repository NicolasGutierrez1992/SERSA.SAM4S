@echo off
echo.
echo =====================================================
echo    SERSA - Setup Completo del Proyecto
echo =====================================================
echo.

echo [1/6] Instalando dependencias del workspace raiz...
call npm install
if %errorlevel% neq 0 (
    echo Error: Fallo la instalacion de dependencias raiz
    pause
    exit /b 1
)

echo.
echo [2/6] Configurando Frontend...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo Error: Fallo la instalacion de dependencias del frontend
    pause
    exit /b 1
)

echo Creando archivo de configuracion del frontend...
if not exist .env.local (
    copy .env.example .env.local
    echo ✓ Archivo .env.local creado
)

cd ..

echo.
echo [3/6] Configurando Backend...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo Error: Fallo la instalacion de dependencias del backend
    pause
    exit /b 1
)

echo Creando archivo de configuracion del backend...
if not exist .env (
    copy .env.example .env
    echo ✓ Archivo .env creado
    echo.
    echo IMPORTANTE: Edite el archivo backend\.env con sus configuraciones:
    echo - DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
    echo - JWT_SECRET (clave secreta segura)
)

cd ..

echo.
echo [4/6] Configurando base de datos...
echo.
echo NOTA: Asegurese de que PostgreSQL este ejecutandose y que:
echo - La base de datos 'db_sersa' exista
echo - Las tablas esten creadas segun el script SQL proporcionado
echo - El usuario 's3rs4' tenga los permisos necesarios
echo.

echo [5/6] Verificando estructura de archivos...
if not exist "backend\src\entities" mkdir "backend\src\entities"
if not exist "backend\src\auth\dto" mkdir "backend\src\auth\dto"
if not exist "backend\src\users\dto" mkdir "backend\src\users\dto"
if not exist "backend\src\certificados\dto" mkdir "backend\src\certificados\dto"
if not exist "frontend\src\components" mkdir "frontend\src\components"
if not exist "frontend\src\hooks" mkdir "frontend\src\hooks"
if not exist "frontend\src\services" mkdir "frontend\src\services"
echo ✓ Estructura de directorios verificada

echo.
echo [6/6] Configuracion completada!
echo.
echo =====================================================
echo    PROXIMOS PASOS:
echo =====================================================
echo.
echo 1. Editar backend\.env con sus configuraciones de BD
echo 2. Verificar que PostgreSQL este ejecutandose
echo 3. Ejecutar: npm run dev (para iniciar ambos servicios)
echo.
echo URLs del sistema:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo   API Docs: http://localhost:3001/api/docs
echo.
echo =====================================================
echo    COMANDOS UTILES:
echo =====================================================
echo.
echo npm run dev              # Ejecutar frontend y backend
echo npm run dev:frontend     # Solo frontend
echo npm run dev:backend      # Solo backend
echo npm run build            # Compilar ambos proyectos
echo npm run lint             # Verificar codigo
echo npm run test             # Ejecutar tests
echo.

echo ¿Desea iniciar los servicios ahora? (S/N)
set /p respuesta=
if /i "%respuesta%"=="S" (
    echo.
    echo Iniciando servicios...
    start "SERSA Backend" cmd /k "cd backend && npm run start:dev"
    timeout /t 3 /nobreak > nul
    start "SERSA Frontend" cmd /k "cd frontend && npm run dev"
    echo.
    echo Servicios iniciados en ventanas separadas
) else (
    echo.
    echo Para iniciar los servicios manualmente, ejecute: npm run dev
)

echo.
echo Setup completo! Gracias por usar SERSA.
pause