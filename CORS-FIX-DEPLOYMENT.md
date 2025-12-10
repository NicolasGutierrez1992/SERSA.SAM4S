# 🚀 CORS Fix - Instrucciones de Despliegue

## Problema
```
Error CORS: Access to XMLHttpRequest at 'https://sersa-backend-production.up.railway.app/api/auth/login' 
has been blocked by CORS policy
```

## Causa
El backend no tenía configurado tu URL de Vercel como origen permitido.

## Solución Aplicada

### 1. ✅ Backend - Cambios Realizados

**Archivo:** `backend/src/main.ts`
```typescript
// Ahora lee CORS_ORIGINS desde variables de entorno
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://sersa-sam-4-s-frontend-t6wz.vercel.app',
  process.env.FRONTEND_URL || 'http://localhost:3000'
];

app.enableCors({
  origin: corsOrigins.map(url => url.trim()),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
});
```

**Archivo:** `backend/.env.production`
```properties
FRONTEND_URL=https://sersa-sam-4-s-frontend-t6wz.vercel.app
CORS_ORIGINS=https://sersa-sam-4-s-frontend-t6wz.vercel.app
```

### 2. ✅ Frontend - Verificado
```properties
# backend/.env.production
NEXT_PUBLIC_API_URL=https://sersa-backend-production.up.railway.app/api
```

---

## 🔄 Pasos para Desplegar

### Opción A: Si usas Railway CLI

```bash
# 1. Haz commit de los cambios
git add .
git commit -m "fix: CORS configuration for production deployment"

# 2. Push a tu repositorio
git push origin main

# 3. Railway detectará automáticamente los cambios y hará redeploy
# Espera a que se complete el despliegue en https://railway.app
```

### Opción B: Si no usas Railway CLI

**En Railway Dashboard:**
1. Ve a tu proyecto
2. Haz clic en el servicio de backend
3. Ve a la sección "Environment"
4. Asegúrate que estas variables estén configuradas:
   ```
   CORS_ORIGINS=https://sersa-sam-4-s-frontend-t6wz.vercel.app
   FRONTEND_URL=https://sersa-sam-4-s-frontend-t6wz.vercel.app
   ```
5. Haz clic en "Redeploy"

---

## ✅ Verificar que Funciona

### Paso 1: Comprueba que el backend esté activo
```bash
curl -X GET https://sersa-backend-production.up.railway.app/api/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "message": "Health check passed"
}
```

### Paso 2: Prueba CORS con preflight
```bash
curl -X OPTIONS https://sersa-backend-production.up.railway.app/api/auth/login \
  -H "Origin: https://sersa-sam-4-s-frontend-t6wz.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**Deberías ver estos headers en la respuesta:**
```
Access-Control-Allow-Origin: https://sersa-sam-4-s-frontend-t6wz.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Content-Type, Authorization, Accept
```

### Paso 3: Prueba login en el frontend
1. Ve a `https://sersa-sam-4-s-frontend-t6wz.vercel.app`
2. Intenta hacer login
3. Debería funcionar sin errores CORS

---

## 🔍 Debugging

### Si aún tienes error CORS:

**1. Verifica las variables de entorno en Railway:**
```bash
# Railway CLI
railway env list
```

**2. Revisa los logs del backend:**
```bash
# Railway Dashboard → Backend Service → Logs
# Deberías ver: "CORS origins configured: ..."
```

**3. Limpia la caché del navegador:**
- Abre DevTools (F12)
- Network → Desactiva "Disable cache"
- Recarga la página

**4. Verifica la URL exacta:**
- Frontend: `https://sersa-sam-4-s-frontend-t6wz.vercel.app` ✓
- Backend: `https://sersa-backend-production.up.railway.app` ✓

---

## 📚 Qué es CORS

**CORS (Cross-Origin Resource Sharing)** es un mecanismo de seguridad del navegador que permite que un dominio haga solicitudes a otro dominio, pero solo si el servidor lo permite explícitamente.

### Flujo sin CORS configurado:
```
1. Frontend intenta: POST to Backend API
2. Browser: "¿Es seguro acceder a backend.com desde frontend.com?"
3. Backend: (no responde con CORS headers)
4. Browser: "NO, bloqueo la solicitud" ❌
```

### Flujo CON CORS configurado:
```
1. Frontend intenta: POST to Backend API
2. Browser: "¿Es seguro acceder a backend.com desde frontend.com?"
3. Backend responde: "Sí, permito solicitudes desde frontend.com" ✓
4. Browser: "OK, dejo que la solicitud pase" ✓
```

---

## 📋 Checklist de Despliegue

- [ ] Código actualizado en `backend/src/main.ts`
- [ ] Variables `.env.production` configuradas
- [ ] Cambios comiteados a Git
- [ ] Railway redeploy completado
- [ ] `https://sersa-backend-production.up.railway.app/api/health` responde
- [ ] Preflight OPTIONS funciona
- [ ] Login en frontend funciona sin errores CORS
- [ ] No aparecen mensajes CORS en DevTools

---

## 🆘 Si necesitas help

**Opción 1: Verificar logs en tiempo real**
```bash
# Ver logs del backend en Railway
railway logs
```

**Opción 2: Revisar configuración actual**
```bash
# Mostrar variables de entorno
railway env list
```

**Opción 3: Forzar redeploy**
```bash
# Desplegar última versión
railway deploy
```

---

**Última actualización:** Diciembre 9, 2025
**Estado:** ✅ CORS configurado para producción
