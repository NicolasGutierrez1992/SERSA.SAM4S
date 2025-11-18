#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 SERSA - Verificación Final de Compilación\n');

// Cambiar al directorio backend
process.chdir(path.join(__dirname, 'backend'));

console.log('📁 Directorio: backend/');
console.log('📋 Verificando compilación TypeScript...\n');

try {
  // Verificar compilación sin generar archivos
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  
  console.log('\n✅ TypeScript compila sin errores');
  console.log('\n🎉 Sistema listo para ejecutar!');
  console.log('\nComandos disponibles:');
  console.log('npm run start:dev    # Iniciar servidor desarrollo');
  console.log('npm run dev          # Con watch mode');
  console.log('npm run build        # Compilar para producción');
  
} catch (error) {
  console.log('\n❌ Errores de compilación encontrados');
  console.log('\n💡 Revisa los errores arriba y corrígelos antes de continuar');
  process.exit(1);
}