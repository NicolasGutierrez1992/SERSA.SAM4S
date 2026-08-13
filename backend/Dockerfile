# ================================
# Stage 1: Build
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm install \
    && apk del .build-deps

COPY . .
RUN npm run build

# ================================
# Stage 2: Production
# ================================
FROM node:20-alpine AS production

WORKDIR /app

# postgresql18-client provee pg_dump, usado por el backup automático diario.
# OJO: el paquete genérico "postgresql-client" de Alpine puede resolver a
# postgresql-bdr-client (versión 9.4, obsoleta) — hay que pedir la versión
# explícita que coincide con la imagen de Postgres usada (ver docker-compose.yml).
RUN apk add --no-cache postgresql18-client

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm install --omit=dev \
    && apk del .build-deps \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Directorio para certificados AFIP (efímero — ver documentación)
RUN mkdir -p ./certs && chown nestjs:nodejs ./certs

USER nestjs

EXPOSE 3001

CMD ["node", "dist/src/main"]
