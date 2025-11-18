const fs = require('fs');
const forge = require('node-forge');
const axios = require('axios');
const { compile } = require('morgan');
const he = require('he'); // Instala con: npm install he

async function logearNode({ pfxPath, pfxPassword, service, wsaaUrl }) {
  try {
    console.log('[logearNode] Iniciando proceso de login con AFIP...');
    // 1. Crear el TRA (loginTicketRequest)
    const now = new Date();
    const tra = `
    <loginTicketRequest version="1.0">
      <header>
        <uniqueId>${Math.floor(Math.random() * 999999)}</uniqueId>
        <generationTime>${new Date(now.getTime() - 600000).toISOString()}</generationTime>
        <expirationTime>${new Date(now.getTime() + 600000).toISOString()}</expirationTime>
      </header>
      <service>${service}</service>
    </loginTicketRequest>`;
    console.log('[logearNode] TRA generado:', tra);

    // 2. Leer y extraer certificado y clave privada del .pfx
    console.log(`[logearNode] Leyendo archivo PFX: ${pfxPath}`);
    const pfxBuffer = fs.readFileSync(pfxPath);
    console.log('[logearNode] Archivo PFX leído correctamente');
    const pfxAsn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, pfxPassword);
    console.log('[logearNode] PFX parseado correctamente');

    let cert, key;
    for (const safeContent of pfx.safeContents) {
      for (const safeBag of safeContent.safeBags) {
        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
          key = forge.pki.privateKeyToPem(safeBag.key);
          console.log('[logearNode] Clave privada extraída');
        }
        if (safeBag.type === forge.pki.oids.certBag) {
          cert = forge.pki.certificateToPem(safeBag.cert);
          console.log('[logearNode] Certificado extraído');
        }
      }
    }
    if (!cert || !key) throw new Error('No se pudo extraer certificado o clave del PFX');

    // 3. Firmar el TRA (PKCS#7)
    console.log('[logearNode] Firmando el TRA...');
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(tra, 'utf8');
    p7.addCertificate(cert);
    p7.addSigner({
      key,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date() }
      ]
    });
    p7.sign();
    console.log('[logearNode] TRA firmado correctamente');
    const cmsFirmadoBase64 = forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
    console.log('[logearNode] CMS firmado (base64):', cmsFirmadoBase64.substring(0, 60) + '...');

    // 4. Enviar el CMS al WSAA
    const soapEnvelope = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://wsaa.view.afip.gov">
      <soapenv:Header/>
      <soapenv:Body>
        <ser:loginCms>
          <ser:in>${cmsFirmadoBase64}</ser:in>
        </ser:loginCms>
      </soapenv:Body>
    </soapenv:Envelope>`;
    console.log('[logearNode] Enviando CMS al WSAA...');
    const response = await axios.post(wsaaUrl, soapEnvelope, {
      headers: { 'SOAPAction': '""', 'Content-Type': 'text/xml' }
    });
    console.log('[logearNode] Respuesta recibida del WSAA');

    const loginCmsReturn = response.data.match(/<loginCmsReturn>([\s\S]*?)<\/loginCmsReturn>/)?.[1];
    if (!loginCmsReturn) {
      console.error('[logearNode] No se encontró loginCmsReturn en la respuesta');
      throw new Error('No se encontró loginCmsReturn en la respuesta');
    }

    // Desescapa el XML
    const xmlLoginTicketResponse = he.decode(loginCmsReturn);
    console.log('[logearNode] XML desescapado:', xmlLoginTicketResponse.substring(0, 200) + '...');

    // Extrae token, sign y expirationTime del XML real
    const token = xmlLoginTicketResponse.match(/<token>(.*?)<\/token>/)?.[1];
    const sign = xmlLoginTicketResponse.match(/<sign>(.*?)<\/sign>/)?.[1];
    const expirationTime = xmlLoginTicketResponse.match(/<expirationTime>(.*?)<\/expirationTime>/)?.[1];

    if (!token || !sign) {
      console.error('[logearNode] No se pudo extraer token/sign del XML desescapado');
      throw new Error('No se pudo extraer token/sign del XML desescapado');
    }

    fs.writeFileSync('respuesta.xml', xmlLoginTicketResponse);
    console.log('[logearNode] Respuesta guardada en respuesta.xml');
    console.log('[logearNode] Login exitoso. Token y Sign obtenidos.');

    return { token, sign, expirationTime };
  } catch (err) {
    console.error('[logearNode] Error:', err.message);
    console.error('[logearNode] Error:', err);
    return 'ERROR';
  }
}

module.exports = { logearNode };