# Certificados AFIP - Configuración

## 📋 Archivos Requeridos

Esta carpeta debe contener los certificados digitales necesarios para la integración con AFIP:

```
certs/
├── sersa_certificate.pfx     # Certificado principal AFIP (OBLIGATORIO)
├── Root_RTI.pem             # Certificado raíz AFIP (opcional)
├── README.md                # Este archivo
└── .gitkeep                 # Mantener carpeta en Git
```

## 🔑 Certificado Principal (.pfx)

### ¿Qué es?
- Archivo que contiene el **certificado digital** + **clave privada**
- Formato PKCS#12 (.pfx o .p12)
- Protegido con contraseña
- Emitido por AFIP para fabricantes registrados

### ¿Cómo obtenerlo?
1. **Registrarse como fabricante** en AFIP
2. **Solicitar certificado** a través del portal AFIP
3. **Descargar el archivo .pfx** generado
4. **Colocar en esta carpeta** con el nombre configurado en `.env`

### Configuración en .env
```env
AFIP_CERT_PATH=./certs/sersa_certificate.pfx
AFIP_KEY_PASSWORD=tu_password_del_certificado
```

## 📜 Certificado Raíz (Root_RTI.pem)

### ¿Qué es?
- Certificado raíz de AFIP para validaciones
- Formato PEM
- **Opcional** para la mayoría de implementaciones

### ¿Cómo obtenerlo?
1. Descargar desde el sitio oficial de AFIP
2. Guardar como `Root_RTI.pem` en esta carpeta

## 🔒 Seguridad Importante

### ⚠️ NUNCA subir a Git
```gitignore
# En .gitignore del proyecto
certs/*.pfx
certs/*.p12
certs/*.key
```

### 🛡️ Permisos recomendados
```bash
# Solo lectura para el owner
chmod 600 sersa_certificate.pfx
```

### 🔐 Backup seguro
- Hacer backup encriptado del archivo .pfx
- Guardar password en gestor de contraseñas
- Tener procedimiento de renovación documentado

## 🧪 Testing

### Verificar certificado
```bash
# Ver información del certificado
openssl pkcs12 -info -in sersa_certificate.pfx -noout
```

### Validar configuración
```bash
# En el backend
npm run start:dev
# Verificar logs de inicialización AFIP
```

## 🚨 Troubleshooting

### Error: "Archivo no encontrado"
- Verificar que el archivo existe en la ruta correcta
- Comprobar permisos de lectura
- Validar nombre del archivo vs configuración .env

### Error: "Password incorrecto"
- Verificar `AFIP_KEY_PASSWORD` en .env
- Probar con herramientas como OpenSSL

### Error: "Certificado expirado"
- Verificar vigencia del certificado
- Renovar certificado en portal AFIP
- Actualizar archivo en servidor

## 📞 Soporte

- **AFIP Mesa de Ayuda**: [Contactar AFIP](https://www.afip.gob.ar/ayuda/)
- **Documentación Técnica**: [Portal Desarrolladores AFIP](https://www.afip.gob.ar/ws/)
- **Registro Fabricantes**: [Tramites AFIP](https://www.afip.gob.ar/fabricantes-software/)

---

**Importante**: Estos archivos contienen información sensible y deben manejarse con extremo cuidado. Nunca los compartas públicamente o los subas a repositorios de código.