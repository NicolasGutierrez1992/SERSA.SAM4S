# 🚀 Deploy en Render - SERSA Frontend

## Prerrequisitos

1. ✅ Código subido a GitHub
2. ✅ Cuenta en [Render.com](https://render.com)
3. ✅ Variables de entorno configuradas

## 📋 Instrucciones Paso a Paso

### Opción 1: Deploy Automático con render.yaml

1. **Conectar repositorio:**
   - Ve a [Render Dashboard](https://dashboard.render.com)
   - Haz clic en "New +"
   - Selecciona "Blueprint"
   - Conecta tu repositorio de GitHub
   - Render detectará automáticamente el `render.yaml`

### Opción 2: Deploy Manual

1. **Crear nuevo Web Service:**
   - Ve a [Render Dashboard](https://dashboard.render.com)
   - Haz clic en "New +" → "Web Service"
   - Conecta tu repositorio de GitHub

2. **Configurar el servicio:**
   ```
   Name: sersa-frontend
   Region: Oregon (US West)
   Branch: main
   Root Directory: . (raíz del proyecto)
   Environment: Node
   Build Command: cd frontend && npm ci && npm run build
   Start Command: cd frontend && npm start
   ```

3. **Variables de Entorno:**
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://tu-backend-url.onrender.com
   ```

4. **Plan:**
   - Selecciona "Free" (para testing) o "Starter" (para producción)

## 🔧 Configuración Avanzada

### Variables de Entorno Importantes

```env
# URL del backend (OBLIGATORIO)
NEXT_PUBLIC_API_URL=https://tu-backend-url.onrender.com

# Configuración de Next.js
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# Si usas autenticación
NEXTAUTH_URL=https://tu-frontend-url.onrender.com
NEXTAUTH_SECRET=tu-secret-muy-seguro
```

### Build Settings Recomendados

```yaml
# En render.yaml (ya configurado)
buildCommand: cd frontend && npm ci && npm run build
startCommand: cd frontend && npm start
```

## 🚀 Deploy Steps

### 1. Preparar el código
```bash
# Verificar que el build funciona localmente
cd frontend
npm install
npm run build
npm start
```

### 2. Subir a GitHub
```bash
git add .
git commit -m "Configure frontend for Render deployment"
git push origin main
```

### 3. Deploy en Render
- El deploy se activará automáticamente
- Monitorea los logs en el dashboard de Render
- El proceso toma aproximadamente 5-10 minutos

## 📝 Logs y Debugging

### Ver logs en tiempo real:
1. Ve a tu servicio en Render Dashboard
2. Haz clic en "Logs" en la barra lateral
3. Los logs se actualizan automáticamente

### Errores comunes:

1. **Build failed - Module not found:**
   ```
   Solución: Verificar que todas las dependencias estén en package.json
   ```

2. **Start command failed:**
   ```
   Solución: Verificar que 'npm start' funcione localmente después del build
   ```

3. **API calls failing:**
   ```
   Solución: Verificar NEXT_PUBLIC_API_URL en variables de entorno
   ```

## 🔄 Actualizaciones Automáticas

- Render se actualizará automáticamente con cada push a la branch `main`
- Los cambios tardan ~3-5 minutos en reflejarse
- Puedes hacer deploy manual desde el dashboard si es necesario

## 🌐 URLs

Una vez deployado, tu aplicación estará disponible en:
```
https://sersa-frontend.onrender.com
```

## 📊 Monitoreo

- **Health Check:** Render monitorea automáticamente la salud del servicio
- **Logs:** Disponibles en tiempo real en el dashboard
- **Métricas:** CPU, memoria y requests disponibles en la consola

## 🔐 Seguridad

1. **HTTPS:** Habilitado automáticamente
2. **Variables de entorno:** Nunca expongas secrets en el código
3. **CORS:** Configura correctamente en el backend

## 💡 Tips de Optimización

1. **Usa `output: 'standalone'` en next.config.js** ✅ (ya configurado)
2. **Habilita SWC minification** ✅ (ya configurado)
3. **Optimiza imágenes con next/image**
4. **Usa variables de entorno para configuración**

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en Render Dashboard
2. Verifica que el build funcione localmente
3. Checkea las variables de entorno
4. Consulta la [documentación de Render](https://render.com/docs)