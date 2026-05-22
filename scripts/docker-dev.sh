#!/usr/bin/env bash
# ============================================================
# Script de arranque del entorno Docker local de SERSA
# Uso: ./scripts/docker-dev.sh [build|up|down|logs|reset]
# ============================================================
set -euo pipefail

COMPOSE_FILE="docker-compose.yml"
ACTION="${1:-up}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_env() {
  if [ ! -f "backend/.env.docker" ]; then
    echo -e "${RED}ERROR: No se encontró backend/.env.docker${NC}"
    echo "Copia backend/.env.example como backend/.env.docker y configura los valores."
    exit 1
  fi
}

case "$ACTION" in
  build)
    check_env
    echo -e "${YELLOW}Construyendo imágenes Docker...${NC}"
    docker compose -f "$COMPOSE_FILE" build --no-cache
    echo -e "${GREEN}Build completado.${NC}"
    ;;

  up)
    check_env
    echo -e "${YELLOW}Iniciando servicios SERSA (Docker)...${NC}"
    docker compose -f "$COMPOSE_FILE" up -d --build
    echo ""
    echo -e "${YELLOW}Esperando que los servicios estén listos...${NC}"
    sleep 5
    # Health check backend
    for i in {1..12}; do
      if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend listo en http://localhost:3001/api${NC}"
        break
      fi
      echo "  Esperando backend... ($i/12)"
      sleep 5
    done
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  SERSA corriendo en Docker local     ║${NC}"
    echo -e "${GREEN}║  Frontend:  http://localhost:3000    ║${NC}"
    echo -e "${GREEN}║  Backend:   http://localhost:3001    ║${NC}"
    echo -e "${GREEN}║  DB:        localhost:5433           ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
    ;;

  down)
    echo -e "${YELLOW}Deteniendo servicios...${NC}"
    docker compose -f "$COMPOSE_FILE" down
    echo -e "${GREEN}Servicios detenidos.${NC}"
    ;;

  logs)
    SERVICE="${2:-}"
    docker compose -f "$COMPOSE_FILE" logs -f $SERVICE
    ;;

  reset)
    echo -e "${RED}Eliminando contenedores Y volumen de datos (DB se borrará)...${NC}"
    read -p "¿Confirmar? (s/N): " confirm
    if [[ "$confirm" == "s" || "$confirm" == "S" ]]; then
      docker compose -f "$COMPOSE_FILE" down -v
      echo -e "${GREEN}Reset completo.${NC}"
    else
      echo "Cancelado."
    fi
    ;;

  *)
    echo "Uso: $0 [build|up|down|logs|reset]"
    exit 1
    ;;
esac
