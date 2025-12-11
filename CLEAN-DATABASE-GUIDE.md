# 🗑️ Guía: Limpiar la Base de Datos

## Opciones Disponibles

### ✅ Opción 1: Usar Script PowerShell (Recomendado para Windows)

**Lo más fácil - Script automático interactivo:**

```powershell
# Desde la raíz del proyecto
.\Clean-Database.ps1

# O con parámetro directo:
.\Clean-Database.ps1 -Mode full      # Eliminar TODO
.\Clean-Database.ps1 -Mode data-only # Solo datos
```

**Ventajas:**
- ✅ Interfaz interactiva
- ✅ Validación de configuración
- ✅ Pide confirmación antes de ejecutar
- ✅ Limpia solo las tablas necesarias

---

### ✅ Opción 2: Usar Script Bash (Linux/Mac)

**Para sistemas Unix:**

```bash
# Dar permisos de ejecución
chmod +x clean-database.sh

# Ejecutar
./clean-database.sh

# O con parámetro:
./clean-database.sh full      # Eliminar TODO
./clean-database.sh data-only # Solo datos
```

---

### ✅ Opción 3: Comandos Manuales

#### A) Limpiar TODO (Eliminar y recrear schema)

```powershell
# En PowerShell
cd backend
npm run typeorm schema:drop -- --connection default

# Luego iniciar la app (recrea las tablas)
npm start
```

**Efectos:**
- ❌ Elimina TODAS las tablas
- ❌ Elimina TODOS los datos
- ✅ Recrea la estructura automáticamente

---

#### B) Limpiar solo datos (Mantener estructura)

**Opción B1 - Con TypeORM query:**

```powershell
cd backend

# Ejecutar para cada tabla
npm run typeorm query -- "TRUNCATE TABLE certificados_maestro CASCADE;"
npm run typeorm query -- "TRUNCATE TABLE certificados_v2 CASCADE;"
npm run typeorm query -- "TRUNCATE TABLE descargas CASCADE;"
npm run typeorm query -- "TRUNCATE TABLE auditoria CASCADE;"
npm run typeorm query -- "TRUNCATE TABLE users CASCADE;"
```

**Opción B2 - Directamente con psql:**

```powershell
# Conectar a PostgreSQL
psql -h localhost -U s3rs4 -d db_sersa

# Dentro de psql:
TRUNCATE TABLE certificados_maestro CASCADE;
TRUNCATE TABLE certificados_v2 CASCADE;
TRUNCATE TABLE descargas CASCADE;
TRUNCATE TABLE auditoria CASCADE;
TRUNCATE TABLE users CASCADE;

-- Salir
\q
```

---

## 📊 Qué se Limpia en Cada Opción

| Tabla | Full | Data-Only |
|-------|------|-----------|
| `certificados_maestro` | ❌ Elimina | ✓ Vacía |
| `certificados_v2` | ❌ Elimina | ✓ Vacía |
| `descargas` | ❌ Elimina | ✓ Vacía |
| `auditoria` | ❌ Elimina | ✓ Vacía |
| `users` | ❌ Elimina | ✓ Vacía |
| Estructura | ❌ Elimina | ✓ Mantiene |

---

## 🔄 Flujo Típico

### Limpiar TODO y empezar desde cero:

```powershell
# 1. Ejecutar script
.\Clean-Database.ps1

# Elegir opción "1. Limpiar TODO"

# 2. Confirmar
# Escribe "SÍ" y presiona Enter

# 3. Esperar a que se complete

# 4. Iniciar la app
cd backend
npm start

# Las tablas se recrearán automáticamente (sincronización: true)
```

---

## ⚙️ Configuración Requerida

El script lee automáticamente del archivo `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=s3rs4
DB_PASSWORD=tu_password
DB_NAME=db_sersa
```

**Asegúrate de que estos valores sean correctos antes de ejecutar.**

---

## 🆘 Troubleshooting

### Error: "psql: command not found"
- PostgreSQL no está en el PATH
- **Solución:** Instalar PostgreSQL o agregar al PATH

### Error: "FATAL: password authentication failed"
- Contraseña incorrecta en `.env`
- **Solución:** Verificar `DB_PASSWORD` en `.env`

### Error: "database does not exist"
- Base de datos no existe
- **Solución:** Crear BD con: `createdb -U s3rs4 db_sersa`

### Error: "permission denied"
- No tienes permisos en PowerShell
- **Solución:** Ejecutar con: `powershell -ExecutionPolicy Bypass -File .\Clean-Database.ps1`

---

## 💡 Recomendaciones

### Para Desarrollo:
Use **Opción 1** (Script PowerShell)
- Más fácil
- Interfaz amigable
- Menos propenso a errores

### Para CI/CD:
Use **Opción 3A** (Comandos TypeORM)
- Más predecible
- Ideal para automatización
- Sin confirmaciones interactivas

### Para Reset Completo:
1. Ejecute: `.\Clean-Database.ps1 -Mode full`
2. Luego: `npm start` en backend
3. Las tablas se recrearán automáticamente

---

## ⚠️ Advertencia

**IMPORTANTE:** 
- ❌ Esta acción NO se puede deshacer
- ❌ Se perderán TODOS los datos
- ❌ Haz backup antes si es necesario

---

## 📋 Checklist Post-Limpieza

Después de limpiar, verifica:

- [ ] Base de datos vacía
- [ ] Aplicación inicia sin errores
- [ ] Puedes crear usuarios
- [ ] Puedes generar certificados
- [ ] Las descargas se registran

---

**Última actualización:** Diciembre 2025
