#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 SERSA - Diagnóstico del Sistema\n');

// 1. Verificar estructura de directorios
console.log('📁 Verificando estructura...');
const requiredDirs = [
  'backend',
  'frontend', 
  'backend/src',
  'backend/src/auth',
  'backend/src/certificados',
  'backend/src/entities'
];

requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}`);
  } else {
    console.log(`❌ ${dir} - FALTA`);
  }
});

// 2. Verificar archivos críticos
console.log('\n📄 Verificando archivos críticos...');
const requiredFiles = [
  'package.json',
  'backend/package.json',
  'frontend/package.json',
  'backend/src/main.ts',
  'backend/src/app.module.ts',
  'frontend/src/pages/index.tsx'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - FALTA`);
  }
});

// 3. Verificar node_modules
console.log('\n📦 Verificando node_modules...');
const nodeModulesDirs = [
  'node_modules',
  'backend/node_modules', 
  'frontend/node_modules'
];

nodeModulesDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}`);
  } else {
    console.log(`❌ ${dir} - FALTA (ejecutar npm install)`);
  }
});

// 4. Verificar scripts en package.json
console.log('\n🔧 Verificando scripts...');
try {
  const rootPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const scripts = rootPackage.scripts || {};
  
  const requiredScripts = ['dev', 'dev:frontend', 'dev:backend'];
  requiredScripts.forEach(script => {
    if (scripts[script]) {
      console.log(`✅ ${script}: ${scripts[script]}`);
    } else {
      console.log(`❌ ${script} - FALTA`);
    }
  });
} catch (error) {
  console.log('❌ Error leyendo package.json:', error.message);
}

// 5. Verificar puertos
console.log('\n🌐 Verificando puertos...');
try {
  // Verificar si los puertos están ocupados
  const net = require('net');
  
  function checkPort(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.close(() => resolve(false)); // Puerto libre
      });
      server.on('error', () => resolve(true)); // Puerto ocupado
    });
  }
  
  Promise.all([
    checkPort(3000),
    checkPort(3001)
  ]).then(([frontend, backend]) => {
    console.log(`${frontend ? '⚠️' : '✅'} Puerto 3000 (frontend) ${frontend ? 'OCUPADO' : 'libre'}`);
    console.log(`${backend ? '⚠️' : '✅'} Puerto 3001 (backend) ${backend ? 'OCUPADO' : 'libre'}`);
  });
} catch (error) {
  console.log('❌ Error verificando puertos:', error.message);
}

// 6. Verificar versiones
console.log('\n📋 Verificando versiones...');
try {
  const nodeVersion = process.version;
  console.log(`✅ Node.js: ${nodeVersion}`);
  
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✅ npm: ${npmVersion}`);
} catch (error) {
  console.log('❌ Error verificando versiones:', error.message);
}

// 7. Verificar dependencias críticas de frontend
console.log('\n🎨 Verificando dependencias de frontend...');
try {
  const frontendPackageJson = path.join('frontend', 'package.json');
  if (fs.existsSync(frontendPackageJson)) {
    const frontendPackage = JSON.parse(fs.readFileSync(frontendPackageJson, 'utf8'));
    const dependencies = { ...frontendPackage.dependencies, ...frontendPackage.devDependencies };
    
    const criticalDeps = ['tailwindcss-animate', 'tailwindcss', '@tailwindcss/typography'];
    criticalDeps.forEach(dep => {
      if (dependencies[dep]) {
        console.log(`✅ ${dep}: ${dependencies[dep]}`);
      } else {
        console.log(`❌ ${dep} - FALTA (ejecutar: cd frontend && npm install ${dep})`);
      }
    });

    // Verificar versiones de React para detectar conflictos
    console.log('\n⚛️ Verificando versiones de React...');
    const reactVersion = dependencies['react'];
    const reactDomVersion = dependencies['react-dom'];
    
    if (reactVersion && reactDomVersion) {
      console.log(`✅ React: ${reactVersion}`);
      console.log(`✅ React DOM: ${reactDomVersion}`);
      
      // Verificar si las versiones coinciden
      const reactMajor = reactVersion.replace(/[^\d.]/g, '').split('.')[0];
      const reactDomMajor = reactDomVersion.replace(/[^\d.]/g, '').split('.')[0];
      
      if (reactMajor !== reactDomMajor) {
        console.log('⚠️ ADVERTENCIA: Versiones de React y React-DOM no coinciden');
        console.log('   Esto puede causar el error "Invalid hook call"');
      }
      
      // Verificar duplicación de React en workspaces
      const rootReactPath = path.join('node_modules', 'react');
      const frontendReactPath = path.join('frontend', 'node_modules', 'react');
      
      if (fs.existsSync(rootReactPath) && fs.existsSync(frontendReactPath)) {
        console.log('⚠️ ADVERTENCIA: React duplicado detectado en root y frontend');
        console.log('   Esto causa el error "Invalid hook call" - eliminar workspace config');
      }
    } else {
      console.log('❌ React o React-DOM faltantes');
    }
  } else {
    console.log('❌ frontend/package.json no encontrado');
  }
} catch (error) {
  console.log('❌ Error verificando dependencias frontend:', error.message);
}

// 8. Recomendaciones
console.log('\n💡 Recomendaciones de solución:');
console.log('1. Si faltan node_modules: npm install');
console.log('2. Si faltan archivos: verificar que todos los archivos fueron creados');
console.log('3. Si hay errores de compilación: revisar logs específicos');
console.log('4. Si puertos ocupados: matar procesos o cambiar puertos');
console.log('5. Si falta tailwindcss-animate: cd frontend && npm install tailwindcss-animate');
console.log('6. Si hay errores de React "Invalid hook call": revisar conflictos de versiones');

console.log('\n🚀 Para ejecutar el sistema:');
console.log('npm run dev                    # Ambos servicios');
console.log('npm run dev:frontend           # Solo frontend');
console.log('npm run dev:backend            # Solo backend');

console.log('\n📊 URLs después de iniciar:');
console.log('Frontend: http://localhost:3000');
console.log('Backend:  http://localhost:3001/api');
console.log('Swagger:  http://localhost:3001/api/docs');

console.log('\n🔧 Comandos de reparación rápida:');
console.log('# SOLUCIÓN INMEDIATA - Ejecutar en orden:');
console.log('1. Instalar dependencia faltante:');
console.log('   cd frontend && npm install tailwindcss-animate');
console.log('');
console.log('2. Si persiste error "Invalid hook call" (React duplicado):');
console.log('   # Eliminar workspaces del package.json root y reinstalar');
console.log('   # O usar --no-hoist para evitar duplicados');
console.log('');
console.log('# SOLUCIÓN COMPLETA - Limpiar y reinstalar:');
console.log('rm -rf node_modules frontend/node_modules backend/node_modules');
console.log('npm install');
console.log('cd frontend && npm install tailwindcss-animate');
console.log('cd ../backend && npm install');
console.log('');
console.log('# ALTERNATIVA - Sin workspaces:');
console.log('# Editar package.json root y eliminar la sección "workspaces"');
console.log('# Luego ejecutar: npm install && cd frontend && npm install && cd ../backend && npm install');