#!/usr/bin/env node

/**
 * Script para generar clave de encriptación segura
 * Uso: node backend/scripts/generate-encryption-key.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('\n======================================');
console.log('Generador de Clave de Encriptación');
console.log('======================================\n');

// Generar clave de 32 bytes (256 bits)
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('✓ Clave de encriptación generada:\n');
console.log(`ENCRYPTION_KEY=${encryptionKey}\n`);

console.log('======================================');
console.log('INSTRUCCIONES:');
console.log('======================================');
console.log('1. Copia la línea anterior completa');
console.log('2. Agrega a tu archivo .env');
console.log('3. NO compartas esta clave');
console.log('4. IMPORTANTE: Haz backup de esta clave');
console.log('   (necesaria para desencriptar certificados)\n');
console.log('Ejemplo en .env:');
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log('======================================\n');

// Opción de guardar en archivo
const args = process.argv.slice(2);
if (args.includes('--save')) {
  const envPath = path.join(__dirname, '../../.env');
  const envContent = `ENCRYPTION_KEY=${encryptionKey}\n`;
  
  try {
    fs.appendFileSync(envPath, envContent);
    console.log(`✓ Clave guardada en ${envPath}`);
  } catch (error) {
    console.error(`✗ Error guardando en ${envPath}:`, error.message);
  }
}

// Opción de guardar en archivo separado
if (args.includes('--file')) {
  const keyFile = path.join(__dirname, '../../.encryption-key');
  try {
    fs.writeFileSync(keyFile, encryptionKey, { mode: 0o600 });
    console.log(`✓ Clave guardada en ${keyFile}`);
    console.log('⚠ IMPORTANTE: Guarda este archivo en lugar seguro\n');
  } catch (error) {
    console.error(`✗ Error guardando en ${keyFile}:`, error.message);
  }
}
