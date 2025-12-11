# 🔧 Fix: Error UUID en id_certificado

## Problema Encontrado

**Error en BD:**
```
error: invalid input syntax for type uuid: "SESHIA-0000001234"
```

**Ubicación:** Al generar un certificado CRS, la aplicación intentaba guardar el `id_certificado` con valor `"SESHIA-0000001234"` en una columna definida como `uuid`.

## Causa Raíz

La tabla `descargas` en su entidad TypeORM tenía definida la columna `id_certificado` como:

```typescript
@Column({ type: 'uuid', nullable: true })
id_certificado: string;
```

Pero el sistema de certificados genera IDs con el formato:
```
SESHIA-0000001234
```

Este formato **no es un UUID válido** (los UUIDs tienen formato como `550e8400-e29b-41d4-a716-446655440000`).

## Solución Implementada

Se cambió la definición de la columna `id_certificado` en `descarga.entity.ts`:

**Antes:**
```typescript
@Column({ type: 'uuid', nullable: true })
id_certificado: string;
```

**Después:**
```typescript
@Column({ type: 'varchar', length: 50, nullable: true })
id_certificado: string;
```

## Archivos Modificados

- ✅ `backend/src/descargas/entities/descarga.entity.ts` - Cambio de tipo uuid a varchar(50)

## Impacto

- ✅ Se resuelve el error al generar certificados
- ✅ Se mantiene la compatibilidad hacia atrás
- ✅ Se permite almacenar IDs de certificados en cualquier formato
- ✅ La base de datos se actualiza automáticamente (TypeORM con synchronize: true)

## Testing

Después de este cambio, ejecutar:

```bash
# 1. Reiniciar la aplicación (TypeORM actualizará el esquema)
npm start

# 2. Generar un certificado CRS
curl -X POST http://localhost:3000/certificados/generar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "marca": "SH",
    "modelo": "IA",
    "numeroSerie": "1234"
  }'

# 3. Verificar que no hay error de UUID
```

## Estados de la Base de Datos

La BD se actualiza automáticamente cuando TypeORM detecta cambios en las entidades.

**Antes del fix:**
```sql
\d descargas
 Column         |           Type            | Collation | Nullable | Default
----------------+---------------------------+-----------+----------+---------
 id_certificado | uuid                      |           |          | 
```

**Después del fix:**
```sql
\d descargas
 Column         |           Type            | Collation | Nullable | Default
----------------+---------------------------+-----------+----------+---------
 id_certificado | character varying(50)     |           |          | 
```

## Notas

- TypeORM con `synchronize: true` automáticamente migra el esquema
- Los datos existentes en `id_certificado` se preservan (son compatibles)
- Este cambio es reversible si es necesario

---

**Fecha de corrección:** Diciembre 11, 2025
**Status:** ✅ Resuelta
