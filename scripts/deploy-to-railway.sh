#!/bin/bash

# Script para desplegar cambios a Railway
# Uso: ./deploy-to-railway.sh

set -e

echo "🚀 SERSA Backend - Deploy a Railway"
echo "======================================"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paso 1: Verificar que estamos en la rama correcta
echo -e "${YELLOW}[1/5]${NC} Verificando rama de Git..."
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
  echo -e "${RED}❌ ERROR: Debes estar en rama 'main' o 'master'${NC}"
  echo "Rama actual: $BRANCH"
  exit 1
fi
echo -e "${GREEN}✅ Rama correcta: $BRANCH${NC}"
echo ""

# Paso 2: Compilar backend localmente
echo -e "${YELLOW}[2/5]${NC} Compilando backend..."
cd backend
npm run build || {
  echo -e "${RED}❌ Error compilando backend${NC}"
  exit 1
}
echo -e "${GREEN}✅ Backend compilado exitosamente${NC}"
cd ..
echo ""

# Paso 3: Hacer commit
echo -e "${YELLOW}[3/5]${NC} Preparando cambios para commit..."
git add .
if git diff --cached --quiet; then
  echo -e "${YELLOW}⚠️  No hay cambios para commitear${NC}"
else
  git commit -m "fix: CORS configuration for production deployment

- Added Vercel frontend URL to CORS allowed origins
- Configured dynamic CORS origin loading from environment variables
- Updated .env.production with correct origins
- Backend now allows requests from https://sersa-sam-4-s-frontend-t6wz.vercel.app"
  echo -e "${GREEN}✅ Cambios comiteados${NC}"
fi
echo ""

# Paso 4: Push a repositorio
echo -e "${YELLOW}[4/5]${NC} Enviando cambios a GitHub..."
git push origin $BRANCH
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Push completado${NC}"
else
  echo -e "${RED}❌ Error en push. Verifica tu conexión a Git${NC}"
  exit 1
fi
echo ""

# Paso 5: Información sobre Railway
echo -e "${YELLOW}[5/5]${NC} Información de despliegue..."
echo ""
echo -e "${GREEN}✅ Cambios enviados a Git${NC}"
echo ""
echo "📋 Próximos pasos:"
echo "1. Railway detectará automáticamente los cambios"
echo "2. El despliegue comenzará en unos segundos"
echo "3. Puedes monitorear el despliegue en: https://railway.app"
echo ""
echo "🔍 Verificar despliegue:"
echo "   - Con Railway CLI: railway logs"
echo "   - O revisa el dashboard de Railway"
echo ""
echo "🧪 Probar después del despliegue:"
echo "   curl https://sersa-backend-production.up.railway.app/api/health"
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Deploy iniciado exitosamente${NC}"
echo -e "${GREEN}================================${NC}"
