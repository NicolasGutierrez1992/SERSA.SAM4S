#!/bin/bash

# Script de limpieza para eliminar archivos duplicados del proyecto SERSA
# Ejecutar desde la carpeta backend: bash cleanup-duplicates.sh

echo "🧹 Iniciando limpieza de archivos duplicados..."

# Archivos duplicados a eliminar del módulo certificados
FILES_TO_DELETE=(
    "src/certificados/entities/descarga.entity.ts"
    "src/certificados/descargas.service.ts" 
    "src/certificados/dto/descarga.dto.ts"
    "src/certificados/certificados.service.real.ts"
)

for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        echo "🗑️  Eliminando: $file"
        rm "$file"
    else
        echo "✅ Ya eliminado: $file"
    fi
done

echo ""
echo "📋 Verificando estructura correcta:"
echo "✅ src/descargas/entities/descarga.entity.ts - $([ -f "src/descargas/entities/descarga.entity.ts" ] && echo "EXISTE" || echo "FALTA")"
echo "✅ src/descargas/descargas.service.ts - $([ -f "src/descargas/descargas.service.ts" ] && echo "EXISTE" || echo "FALTA")"
echo "✅ src/descargas/dto/descarga.dto.ts - $([ -f "src/descargas/dto/descarga.dto.ts" ] && echo "EXISTE" || echo "FALTA")"
echo "✅ src/certificados/certificados.service.ts - $([ -f "src/certificados/certificados.service.ts" ] && echo "EXISTE" || echo "FALTA")"

echo ""
echo "🎯 Estructura final deseada:"
echo "📁 src/certificados/"
echo "   ├── certificados.controller.ts"
echo "   ├── certificados.service.ts (solo generación AFIP)"
echo "   ├── certificados.module.ts"
echo "   └── entities/"
echo "       └── certificado.entity.ts"
echo ""
echo "📁 src/descargas/"
echo "   ├── descargas.service.ts (manejo completo descargas)"
echo "   ├── descargas.module.ts"
echo "   ├── entities/"
echo "   │   └── descarga.entity.ts"
echo "   └── dto/"
echo "       └── descarga.dto.ts"

echo ""
echo "✨ Limpieza completada!"
echo "🔄 Ejecuta 'npm run build' para verificar que no hay errores de compilación."