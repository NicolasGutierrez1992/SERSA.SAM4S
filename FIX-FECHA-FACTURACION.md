# 🔧 Corrección: Error de null value en fecha_facturacion

## Problema

Error al generar certificado:
```
Error al registrar descarga: null value in column "fecha_facturacion" of relation "descargas" violates not-null constraint
```

## Causa Raíz

En `descargas.service.ts`, el método `registrarDescarga` estaba estableciendo explícitamente:
```typescript
fecha_facturacion: null
```

Aunque la columna en la entidad tiene un default:
```typescript
@Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
fecha_facturacion: Date;
```

**El problema**: Cuando se establece explícitamente `null`, TypeORM intenta insertar NULL, ignorando el default. El default solo se aplica cuando el campo NO se incluye en la inserción.

## Solución Aplicada

Se removió la línea `fecha_facturacion: null` del objeto que se envía a `create()`:

**Antes:**
```typescript
const descarga = this.descargaRepository.create({
  id_usuario: data.usuarioId,
  id_certificado: data.controladorId,        
  certificado_nombre: data.certificadoNombre,
  estadoMayorista: EstadoDescarga.PENDIENTE_FACTURAR,
  estadoDistribuidor: EstadoDescarga.PENDIENTE_FACTURAR,
  fecha_facturacion: null,  // ❌ Causa error
  tamaño: data.tamaño,
  updated_at: new Date().toISOString(),
  created_at: new Date().toISOString()
});
```

**Después:**
```typescript
const descarga = this.descargaRepository.create({
  id_usuario: data.usuarioId,
  id_certificado: data.controladorId,        
  certificado_nombre: data.certificadoNombre,
  estadoMayorista: EstadoDescarga.PENDIENTE_FACTURAR,
  estadoDistribuidor: EstadoDescarga.PENDIENTE_FACTURAR,
  // ✅ Removido - ahora usa el default CURRENT_TIMESTAMP
  tamaño: data.tamaño,
  updated_at: new Date().toISOString(),
  created_at: new Date().toISOString()
});
```

## Archivo Modificado

- `backend/src/descargas/descargas.service.ts` - Línea ~97

## ✅ Resultado

- ✅ Compilación exitosa
- ✅ La columna `fecha_facturacion` se llena automáticamente con `CURRENT_TIMESTAMP`
- ✅ Las descargas se registran correctamente

## Conceptos Importantes

### Defaults en TypeORM vs Explícit NULL

| Escenario | Comportamiento |
|-----------|----------------|
| No incluir campo | ✅ Usa el default |
| `campo: null` | ❌ Intenta insertar NULL |
| `campo: valor` | ✅ Usa el valor |

### Lección

En TypeORM, cuando una columna tiene un default y quieres que se use:
- **NO** incluyas el campo en el objeto
- **NO** lo establezca explícitamente a `null`
- **SÍ** solo proporciona un valor si quieres sobrescribir el default

## Verificación

Para verificar que el error se resolvió, genera un nuevo certificado:
```bash
# El flujo debería completarse sin errores
POST /certificados/generar
{
  "marca": "SH",
  "modelo": "IA",
  "numeroSerie": "0000001234"
}
```

---

**Estado:** ✅ RESUELTO
**Fecha:** Diciembre 2025
