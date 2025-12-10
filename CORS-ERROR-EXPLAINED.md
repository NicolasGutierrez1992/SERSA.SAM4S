# 🚨 Error CORS - Guía Rápida

## El Error

```
Access to XMLHttpRequest at 'https://sersa-backend-production.up.railway.app/api/auth/login' 
from origin 'https://sersa-sam-4-s-frontend-t6wz.vercel.app' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present in the requested resource.
```

## 🔴 Qué Significa

| Término | Explicación |
|---------|------------|
| **CORS Policy** | Regla de seguridad del navegador |
| **Blocked** | El navegador bloqueó tu solicitud |
| **No Access-Control-Allow-Origin header** | El servidor NO respondió con permiso |
| **Preflight request** | Test automático del navegador antes de la solicitud real |

## 🔍 Desglose

```
Tu Frontend          →  Tu Backend
(Vercel)               (Railway)
✓ Diferente origen
✓ Navegador bloquea
✓ Necesitas CORS headers
```

## ✅ Solución en 3 pasos

### 1️⃣ Backend - Configurar CORS

```typescript
app.enableCors({
  origin: [
    'https://sersa-sam-4-s-frontend-t6wz.vercel.app',  // ← Agrega tu URL
    'http://localhost:3000'
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### 2️⃣ Desplegar en Railway

```bash
git push origin main  # Railway detecta y redeploya automáticamente
```

### 3️⃣ Probar

```bash
curl https://sersa-backend-production.up.railway.app/api/health
# Debería responder correctamente
```

## 🧠 Cómo Funciona CORS

### Sin CORS (❌ Bloqueado)

```
Browser                Frontend              Backend
  |                      |                     |
  |--- POST /login ---→  |                     |
  |                      |--- REQUEST  ---→   |
  |                      |                  ❌ "Sin CORS header"
  |                      |← RESPONSE (bloqueado por browser)
  |
  ❌ Error de CORS
```

### Con CORS (✅ Permitido)

```
Browser                Frontend              Backend
  |                      |                     |
  |--- POST /login ---→  |                     |
  |                      |--- REQUEST  ---→   |
  |                      |                  ✓ "Access-Control-Allow-Origin: ..."
  |                      |← RESPONSE (permitido por browser)
  |
  ✅ Solicitud completada
```

## 📊 CORS Headers Necesarios

El backend debe responder con:

```
Access-Control-Allow-Origin: https://sersa-sam-4-s-frontend-t6wz.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Content-Type, Authorization, Accept
```

## 🔧 Configuración en NestJS (Backend)

### Opción Simple

```typescript
app.enableCors({
  origin: 'https://sersa-sam-4-s-frontend-t6wz.vercel.app',
  credentials: true,
});
```

### Opción Dinámica (Recomendada)

```typescript
const allowedOrigins = [
  'http://localhost:3000',
  'https://sersa-sam-4-s-frontend-t6wz.vercel.app'
];

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
```

### Opción Con Variables de Entorno (La que usamos)

```typescript
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',');

app.enableCors({
  origin: corsOrigins.map(url => url.trim()),
  credentials: true,
});
```

## 🌍 Orígenes Permitidos

Un **origen** es: `protocolo://dominio:puerto`

```
✓ https://sersa-sam-4-s-frontend-t6wz.vercel.app
✓ http://localhost:3000
✓ http://127.0.0.1:3000
✗ https://otro-dominio.com  (no configurado = bloqueado)
```

## 🔐 Seguridad

CORS **no es** solo un molesto mensaje de error. Es importante porque:

1. **Protege tu backend** - Solo sitios autorizados pueden hacer solicitudes
2. **Previene ataques** - Evita que sitios maliciosos accedan a tu API
3. **Control explícito** - Decides quién puede acceder

## 🚨 Problemas Comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| `No Access-Control-Allow-Origin` | Backend no configurado | Agregar CORS en backend |
| `Origin not allowed` | URL no está en whitelist | Agregar URL a array de orígenes |
| `Credentials mode is 'include'` | credentials: true sin header | Agregar `credentials: true` en CORS |
| `Method not allowed` | OPTIONS no permitido | Agregar OPTIONS a methods |

## 📝 Variables de Entorno Necesarias

**Backend (.env.production)**
```properties
CORS_ORIGINS=https://sersa-sam-4-s-frontend-t6wz.vercel.app,http://localhost:3000
FRONTEND_URL=https://sersa-sam-4-s-frontend-t6wz.vercel.app
```

**Frontend (.env.production)**
```properties
NEXT_PUBLIC_API_URL=https://sersa-backend-production.up.railway.app/api
```

## ✔️ Verificar que Funciona

### Test 1: Health Check
```bash
curl https://sersa-backend-production.up.railway.app/api/health
```
Respuesta:
```json
{ "status": "ok" }
```

### Test 2: Preflight CORS
```bash
curl -X OPTIONS https://sersa-backend-production.up.railway.app/api/auth/login \
  -H "Origin: https://sersa-sam-4-s-frontend-t6wz.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -i
```
Busca estos headers:
```
Access-Control-Allow-Origin: https://sersa-sam-4-s-frontend-t6wz.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
```

### Test 3: En el Navegador
1. Ve a frontend
2. Intenta login
3. Abre DevTools (F12) → Network
4. La solicitud POST a `/login` debe tener status 200/401 (no 0 o bloqueado)

## 🎯 Resumen

| Paso | Acción | Estado |
|------|--------|--------|
| 1 | Identificar error CORS | ✅ Hecho |
| 2 | Agregar URL frontend a CORS | ✅ Hecho |
| 3 | Configurar variables .env | ✅ Hecho |
| 4 | Hacer push a Git | ⏳ Tú |
| 5 | Railway redeploya | ⏳ Automático |
| 6 | Probar login | ⏳ Tú |

## 📞 Necesitas Help?

1. **Ver logs**: `railway logs`
2. **Verificar env vars**: `railway env list`
3. **Forzar redeploy**: `railway deploy`
4. **Limpiar caché**: DevTools → Clear all (Ctrl+Shift+Delete)

---

**Estado:** ✅ CORS configurado  
**Próximo paso:** Deployar en Railway
