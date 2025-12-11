# Fix: Zona Horaria de Argentina en Métricas y Reportes

## Problema

Las métricas de descargas por día/semana/mes estaban calculándose incorrectamente porque:

1. **Filtrado en JavaScript**: El código filtraba descargas EN MEMORIA después de obtenerlas de la BD, comparando fechas sin considerar correctamente la zona horaria de Argentina.
2. **Conversión incompleta**: Las fechas UTC almacenadas en PostgreSQL se comparaban directamente sin convertir a zona horaria Argentina.
3. **Resultados incorrectos**: Los conteos de "descargas hoy", "descargas esta semana", "descargas este mes" podían ser incorrectos dependiendo de la zona horaria del servidor.

### Ejemplos del Problema

- Si el servidor está en UTC:
  - Una descarga realizada a las 21:00 UTC sería contada como "mañana" en Argentina (donde sería las 18:00)
  - El cambio de día ocurriría a diferentes horas para usuarios en diferentes zonas horarias

- Si el servidor está en una zona horaria diferente a Argentina:
  - Las fechas se calculaban incorrectamente al convertir `createdAt` a string

## Solución

Se implementó un enfoque **de base de datos first** usando las capacidades de PostgreSQL para manejar zonas horarias:

### 1. **Filtrado en la Base de Datos (PostgreSQL)**

Se actualizó `DescargasService.getDescargas()` para usar `AT TIME ZONE` en las queries SQL:

```typescript
// Filtros de fecha usando zona horaria de Argentina
if (fechaDesde) {
  query.andWhere(
    '(descarga.created_at AT TIME ZONE \'America/Argentina/Buenos_Aires\')::date >= :fechaDesde', 
    { fechaDesde }
  );
}
if (mes) {
  query.andWhere(
    'EXTRACT(MONTH FROM descarga.created_at AT TIME ZONE \'America/Argentina/Buenos_Aires\') = :mes', 
    { mes: mesNum }
  );
}
```

**Ventajas:**
- PostgreSQL maneja correctamente los cambios de horario de verano/invierno en Argentina
- El filtrado es eficiente (realizado en la BD, no en JavaScript)
- Los resultados son precisos independientemente de la zona horaria del servidor

### 2. **Controlador Actualizado**

El método `getMetricasPersonales()` en `CertificadosController` ahora:

```typescript
// Obtener fechas en formato YYYY-MM-DD para las queries
const hoyString_query = this.timezoneService.formatDateToString(hoyArgentina);
const semanaString = this.timezoneService.formatDateToString(inicioSemanaArgentina);
const mesString = this.timezoneService.formatDateToString(inicioMesArgentina);

// Obtener descargas filtrando por fecha en BD (con zona horaria Argentina)
const descargasHoyResult = await this.descargasService.getDescargas({
  limit: 1000,
  usuarioId: userId,
  fechaDesde: hoyString_query,
  fechaHasta: hoyString_query
});

const descargasSemanaResult = await this.descargasService.getDescargas({
  limit: 1000,
  usuarioId: userId,
  fechaDesde: semanaString
});

const descargasMesResult = await this.descargasService.getDescargas({
  limit: 1000,
  usuarioId: userId,
  fechaDesde: mesString
});
```

**Cambios principales:**
- ❌ Ya no filtra descargas EN MEMORIA (en JavaScript)
- ✅ Pasa parámetros de fecha a `getDescargas()` que los usa en la query SQL
- ✅ Utiliza `TimezoneService` solo para calcular fechas en zona Argentina
- ✅ PostgreSQL realiza el filtrado real con consideración de zona horaria

## Archivos Modificados

### 1. `backend/src/descargas/descargas.service.ts`

**Cambios:**
- Inyectado `TimezoneService`
- Actualizado método `getDescargas()` para usar `AT TIME ZONE 'America/Argentina/Buenos_Aires'` en queries
- Filtros de `mes` y `anio` también usan zona horaria Argentina

### 2. `backend/src/descargas/descargas.module.ts`

**Cambios:**
- Agregado `TimezoneService` a providers
- Exportado `TimezoneService` para que otros módulos puedan usarlo

### 3. `backend/src/certificados/certificados.controller.ts`

**Cambios:**
- Agregado `Logger` para mejor debugging
- Actualizado `getMetricasPersonales()` para obtener descargas con filtros de fecha
- Eliminado filtrado en JavaScript
- Cada tipo de métrica (hoy, semana, mes) obtiene sus datos de BD con filtro específico

## Cómo Funciona la Zona Horaria

### PostgreSQL `AT TIME ZONE`

```sql
-- Antes (UTC, incorrecto):
SELECT * FROM descarga WHERE created_at >= '2025-12-10'

-- Después (Argentina/Buenos Aires, correcto):
SELECT * FROM descarga 
WHERE (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date >= '2025-12-10'
```

**¿Cómo funciona?**

1. PostgreSQL almacena `created_at` en UTC (zona horaria universal)
2. `AT TIME ZONE 'America/Argentina/Buenos_Aires'` convierte el timestamp UTC a zona horaria de Argentina
3. `::date` extrae solo la parte de fecha (año-mes-día)
4. La comparación se realiza con fechas en zona horaria Argentina

### Ejemplo Real

Descarga realizada a las **23:00 UTC del 10 de diciembre**:

| Contexto | Resultado |
|----------|-----------|
| En UTC | 2025-12-10 23:00:00 UTC |
| En Argentina (UTC-3) | 2025-12-10 20:00:00 | ← 20:00 del 10 de diciembre
| En servidor (UTC+0) | 2025-12-10 |
| Filtro de Argentina | ✅ Contado como "10 de diciembre" |

## Beneficios

1. **✅ Precisión**: Las métricas son correctas según hora de Argentina, independientemente de dónde esté el servidor
2. **✅ Eficiencia**: Filtrado realizado en BD (más rápido que JavaScript)
3. **✅ Mantenibilidad**: Cambios de horario de verano/invierno manejados automáticamente por PostgreSQL
4. **✅ Escalabilidad**: No depende de la zona horaria del servidor

## Testing

### Verificar que las métricas sean correctas

```bash
# Obtener métricas personales (requiere autenticación)
GET /certificados/metricas-personales
Authorization: Bearer <token>

# Respuesta esperada:
{
  "descargasHoy": 3,           # Descargas realizadas hoy en Argentina
  "descargasSemana": 15,       # Descargas realizadas esta semana en Argentina
  "descargasMes": 45,          # Descargas realizadas este mes en Argentina
  "pendienteFacturar": 2,      # Descargas en estado PENDIENTE_FACTURAR
  "limiteDescargas": 50,       # Límite de descargas del usuario
  "porcentajeLimite": 4,       # Porcentaje: 2/50 = 4%
  "horaServidor": "miércoles, 10 de diciembre de 2025 20:30:15" # Hora actual en Argentina
}
```

### Verificar en PostgreSQL

```sql
-- Ver descargas de hoy en Argentina
SELECT 
  id,
  created_at AT TIME ZONE 'America/Argentina/Buenos_Aires' as fecha_argentina,
  (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date as fecha_solo
FROM descarga
WHERE (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = CURRENT_DATE AT TIME ZONE 'America/Argentina/Buenos_Aires'
ORDER BY created_at DESC;
```

## Futuras Mejoras

1. **Reportes con zona horaria**: Los reportes de auditoría también deberían usar zona horaria Argentina
2. **Estadísticas por hora**: Posibles estadísticas adicionales por hora de Argentina
3. **Configuración de zona horaria**: Hacer configurable la zona horaria (aunque Argentina es el caso de uso actual)

## Referencias

- [PostgreSQL AT TIME ZONE Documentation](https://www.postgresql.org/docs/current/functions-datetime.html)
- [Zona horaria de Argentina (Buenos Aires)](https://en.wikipedia.org/wiki/Time_in_Argentina)
- [Intl.DateTimeFormat (usado en TimezoneService)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
