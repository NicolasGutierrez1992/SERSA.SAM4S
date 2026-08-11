# Instalación

> Para arquitectura, flujo de certificados, roles y variables de entorno en detalle, ver [`README.md`](./README.md) y [`ARCHITECTURE.md`](./ARCHITECTURE.md). Esta guía es solo los pasos para dejar el proyecto corriendo localmente.

El proyecto está completo — no hay servicios "simplificados" ni mocks que activar manualmente (`MOCK_MODE` existe como variable de entorno para desarrollo sin conexión real a AFIP, pero todo el resto — TypeORM, JWT, bcrypt, AFIP real — ya está integrado).

## Opción A — Docker Compose (recomendado)

Requiere Docker Desktop instalado y corriendo.

```bash
git clone <repo>
cd SERSA.SAM4S
cp backend/.env.example backend/.env.docker
# Completar backend/.env.docker: como mínimo DB_PASSWORD, JWT_SECRET, ENCRYPTION_KEY
# (generar valores con los comandos en README.md § Variables de entorno)

docker compose up -d --build
```

- Frontend: http://localhost:3010
- Backend: http://localhost:3011/api
- Swagger: http://localhost:3011/api/docs

Al primer arranque no hay certificado AFIP cargado — seguir "Configuración inicial" en `README.md` (subir PFX + Root_RTI desde `/dashboard/cert-archivos` como Admin).

## Opción B — Local sin Docker

Requiere Node.js 20.x y una instancia de PostgreSQL accesible.

```bash
npm run setup          # instala dependencias de backend, frontend y raíz (workspaces)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Completar ambos .env

npm run dev            # backend (:3001) + frontend (:3000) en paralelo
```

## Verificar que todo funciona

```bash
npm run lint            # ESLint en backend y frontend
npm run build            # Build de producción de ambos
npm run test:backend      # Tests E2E del backend (requiere una BD accesible — nunca producción)
npm run test:frontend     # Tests E2E de Playwright (requiere el stack corriendo en :3010)
```

Estos mismos pasos corren automáticamente en cada push vía GitHub Actions (`.github/workflows/ci.yml`).

## Problemas comunes

**TypeORM no conecta**: verificar que Postgres esté corriendo y que `DB_HOST/PORT/USERNAME/PASSWORD/NAME` en el `.env` correspondan a una base accesible.

**El backend no arranca / "Variables de entorno requeridas no configuradas"**: faltan `JWT_SECRET`, `ENCRYPTION_KEY` o `DB_PASSWORD` — el arranque falla explícitamente por diseño si no están seteadas (ver `validateRequiredEnv()` en `backend/src/main.ts`).

**AFIP no responde**: en desarrollo, revisar `GET /api/certificados/afip/status`; en producción, confirmar que el certificado PFX y el Root_RTI estén cargados desde el panel de Admin (`/dashboard/cert-archivos`), no en archivos locales — ya no se leen desde `backend/certs/`.
