# Qué es esta carpeta

Este directorio junta ~200 documentos generados sesión a sesión durante el desarrollo del proyecto (resúmenes de implementación, checklists, notas de fixes puntuales, etc.). Son un **registro histórico**, no documentación vigente: muchos describen un estado del código que ya cambió o directamente ya no existe.

**No los uses como referencia de cómo funciona el sistema hoy.** Las fuentes de verdad actuales son:

- [`README.md`](../README.md) — qué es el sistema, arquitectura, roles, flujo de certificados, variables de entorno, deploy
- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — arquitectura y flujo de autenticación en detalle
- [`CLAUDE.md`](../CLAUDE.md) — convenciones para trabajar en el código
- `backend/README.md` / `frontend/README.md` — específico de cada app

Si algo de acá adentro parece relevante para una tarea actual, conviene verificar contra el código real antes de confiar en el documento — puede estar desactualizado.
