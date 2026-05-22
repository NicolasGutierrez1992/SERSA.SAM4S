#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando SERSA en modo desarrollo...\n');

// Función para ejecutar comandos
function runCommand(command, args, cwd, label, color = '\x1b[36m') {
  const child = spawn(command, args, {
    cwd: path.join(__dirname, cwd),
    stdio: 'pipe',
    shell: true
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${color}[${label}]\x1b[0m ${line}`);
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`\x1b[31m[${label} ERROR]\x1b[0m ${line}`);
    });
  });

  child.on('close', (code) => {
    console.log(`\x1b[33m[${label}]\x1b[0m Proceso terminado con código ${code}`);
  });

  return child;
}

// Verificar puertos disponibles
async function checkPort(port) {
  const net = require('net');
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => resolve(false));
  });
}

async function startServices() {
  // Verificar puertos
  const backendPortFree = await checkPort(3001);
  const frontendPortFree = await checkPort(3000);

  if (!backendPortFree) {
    console.log('\x1b[31m❌ Puerto 3001 ocupado. Detén el proceso que usa este puerto.\x1b[0m');
    process.exit(1);
  }

  if (!frontendPortFree) {
    console.log('\x1b[31m❌ Puerto 3000 ocupado. Detén el proceso que usa este puerto.\x1b[0m');
    process.exit(1);
  }

  console.log('✅ Puertos 3000 y 3001 disponibles\n');

  // Iniciar servicios
  console.log('🔧 Iniciando Backend (Puerto 3001)...');
  const backend = runCommand('npm', ['run', 'start:dev'], 'backend', 'BACKEND', '\x1b[32m');

  // Esperar un poco antes de iniciar el frontend
  setTimeout(() => {
    console.log('🎨 Iniciando Frontend (Puerto 3000)...');
    const frontend = runCommand('npm', ['run', 'dev'], 'frontend', 'FRONTEND', '\x1b[34m');
  }, 3000);

  // Manejar cierre
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Cerrando servicios...');
    backend.kill();
    setTimeout(() => process.exit(0), 1000);
  });

  // Mostrar URLs después de un momento
  setTimeout(() => {
    console.log('\n' + '='.repeat(60));
    console.log('🌐 SERSA está corriendo en:');
    console.log('   Frontend: \x1b[34mhttp://localhost:3000\x1b[0m');
    console.log('   Backend:  \x1b[32mhttp://localhost:3001/api\x1b[0m');
    console.log('   API Docs: \x1b[33mhttp://localhost:3001/api/docs\x1b[0m');
    console.log('   Health:   \x1b[36mhttp://localhost:3001/api/health\x1b[0m');
    console.log('='.repeat(60) + '\n');
  }, 8000);
}

startServices();