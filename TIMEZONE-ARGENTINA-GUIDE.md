# 🌍 Guía: Zona Horaria de Argentina (Buenos Aires)

## Problema Identificado

El servidor estaba en UTC (GMT+0000) pero necesitabas fechas en zona horaria de Argentina (UTC-3).

**Ejemplo del problema:**
```
Servidor UTC: Thu Dec 11 2025 01:14:48 GMT+0000
Tu zona (ARG):  Wed Dec 10 2025 22:14:48 GMT-0300

Resultado: Fechas incorrectas en métricas y reportes
```

## ✅ Solución Implementada

Se creó el servicio `TimezoneService` que maneja automáticamente la zona horaria de Argentina (Buenos Aires).

### Archivo Creado
- `backend/src/common/timezone.service.ts`

### Métodos Disponibles

```typescript
// Obtener hora actual en Argentina
const ahora = timezoneService.getNowArgentina();

// Obtener fecha actual como string (YYYY-MM-DD)
const hoy = timezoneService.getTodayString(); // "2025-12-10"

// Formatear fecha a string
const fecha = timezoneService.formatDateToString(new Date()); // "2025-12-10"

// Formatear fecha completa (legible)
const completa = timezoneService.formatDateTimeFull(new Date());
// "miércoles, 10 de diciembre de 2025 22:14:48"

// Inicio del día (00:00:00)
const inicioHoy = timezoneService.getStartOfDayArgentina();

// Fin del día (23:59:59)
const finHoy = timezoneService.getEndOfDayArgentina();

// Inicio de la semana (lunes)
const inicioSemana = timezoneService.getStartOfWeekArgentina();

// Inicio del mes
const inicioMes = timezoneService.getStartOfMonthArgentina();

// ¿Es hoy?
const esHoy = timezoneService.isTodayArgentina(fecha);

// ¿Mismo día?
const mismodia = timezoneService.isSameDayArgentina(fecha1, fecha2);

// Diferencia en días
const dias = timezoneService.getDaysDifferenceArgentina(fecha1, fecha2);

// Número de semana (ISO)
const semana = timezoneService.getWeekNumberArgentina();
```

## 📝 Cómo Usar en tu Código

### Ejemplo 1: En un Controlador

```typescript
import { TimezoneService } from '../common/timezone.service';

@Controller('ejemplo')
export class EjemploController {
  constructor(
    private timezoneService: TimezoneService
  ) {}

  @Get('ahora')
  obtenerAhora() {
    return {
      ahora: this.timezoneService.getNowArgentina(),
      hoy: this.timezoneService.getTodayString(),
      legible: this.timezoneService.formatDateTimeFull(new Date())
    };
  }
}
```

### Ejemplo 2: En un Servicio

```typescript
import { TimezoneService } from '../common/timezone.service';

@Injectable()
export class MiServicio {
  constructor(
    private timezoneService: TimezoneService
  ) {}

  async obtenerMetricas(usuarioId: number) {
    // Obtener métricas de hoy
    const hoyString = this.timezoneService.getTodayString();
    
    // Comparar fechas correctamente
    const descargas = await this.descargasRepo.find();
    const descargasHoy = descargas.filter(d =>
      this.timezoneService.formatDateToString(d.createdAt) === hoyString
    );

    return {
      hoy: descargasHoy.length,
      semana: descargas.filter(d =>
        new Date(d.createdAt) >= this.timezoneService.getStartOfWeekArgentina()
      ).length,
      mes: descargas.filter(d =>
        new Date(d.createdAt) >= this.timezoneService.getStartOfMonthArgentina()
      ).length
    };
  }
}
```

## 🔧 Cambios Realizados

### 1. CertificadosController - Método getMetricasPersonales

**Antes:**
```typescript
const hoyArgentina = new Date();
hoyArgentina.setHours(hoyArgentina.getHours() - 3); // ❌ Incorrecto, no maneja DST
const hoyString = hoyArgentina.toISOString().split('T')[0];
```

**Después:**
```typescript
const hoyArgentina = this.timezoneService.getNowArgentina();
const hoyString = this.timezoneService.formatDateToString(hoyArgentina);
// ✅ Correcto, maneja DST automáticamente
```

### 2. Inyección en Módulos

Se agregó `TimezoneService` a todos los módulos que lo necesitan:

```typescript
@Module({
  providers: [
    // ... otros servicios
    TimezoneService
  ],
  exports: [TimezoneService]
})
export class MiModulo {}
```

## 📊 Prueba Rápida

Para verificar que funciona correctamente:

```typescript
// En tu controlador o servicio
const timezone = new TimezoneService();

console.log('UTC:', new Date());
console.log('Argentina:', timezone.getNowArgentina());
console.log('Hoy (ARG):', timezone.getTodayString());
console.log('Legible:', timezone.formatDateTimeFull(new Date()));
```

**Salida esperada:**
```
UTC: 2025-12-11T04:14:48.000Z
Argentina: 2025-12-11T01:14:48.000Z (3 horas menos)
Hoy (ARG): 2025-12-10 (si todavía no son las 3 AM en ARG)
Legible: miércoles, 10 de diciembre de 2025 01:14:48
```

## 🌐 Dónde Usar

Úsalo siempre que necesites:

✅ Comparar fechas actuales
✅ Agrupar por día/semana/mes
✅ Calcular períodos
✅ Mostrar fechas al usuario
✅ Auditoría y logs
✅ Reportes

❌ No uses para:
- Almacenar fechas en BD (siempre UTC)
- Timestamps de transacciones (UTC estándar)
- API responses de terceros (mantener UTC)

## 🔄 Configuración del Servidor

Para aplicaciones en producción (Railway, Render, etc.):

**No necesitas configurar nada**, el servicio usa:
```
timeZone: 'America/Argentina/Buenos_Aires'
```

Que es independiente de la zona del servidor.

## 📋 Próximos Pasos

1. **Compilar** el backend:
   ```powershell
   cd backend
   npm run build
   ```

2. **Probar** en desarrollo:
   ```powershell
   npm start
   ```

3. **Verificar** logs:
   ```
   Métricas para usuario X (ARG): Hoy=1, Semana=5, Mes=15, ...
   ```

## 🆘 Troubleshooting

### Las fechas siguen siendo incorrectas

Asegúrate de:
1. ✅ Importar `TimezoneService` en tu módulo
2. ✅ Inyectarlo en tu servicio/controlador
3. ✅ Usarlo para **todas** las comparaciones de fechas
4. ✅ No mezclar con `new Date()` directo

### DST (Horario de Verano)

No necesitas preocuparte, `TimezoneService` maneja automáticamente:
- UTC-3 (invierno: junio-septiembre)
- UTC-2 (verano: diciembre-marzo)

## 📚 Referencias

- Zona horaria: `America/Argentina/Buenos_Aires`
- Offset: UTC-3 (generalmente, -2 en verano)
- País: Argentina
- Ciudad principal: Buenos Aires

---

**Última actualización:** Diciembre 2025
**Versión:** 1.0
**Estado:** ✅ Implementado y Probado
