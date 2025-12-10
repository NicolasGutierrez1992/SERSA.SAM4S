#!/bin/bash
# Script para generar clave de encriptación segura

echo "======================================"
echo "Generador de Clave de Encriptación"
echo "======================================"
echo ""

# Generar clave de 32 bytes (256 bits)
ENCRYPTION_KEY=$(openssl rand -hex 32)

echo "✓ Clave de encriptación generada:"
echo ""
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""
echo "======================================"
echo "INSTRUCCIONES:"
echo "======================================"
echo "1. Copia la línea anterior completa"
echo "2. Agrega a tu archivo .env"
echo "3. NO compartas esta clave"
echo "4. IMPORTANTE: Haz backup de esta clave"
echo "   (necesaria para desencriptar certificados)"
echo ""
echo "Ejemplo en .env:"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "======================================"
