export const afipConfig = {
  // URLs de servicios AFIP
  wsaa: {
    production: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    testing: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms'
  },
  
  wsCert: {
    production: 'https://certificado.afip.gov.ar/ws/services/CertificadoService?wsdl',
    testing: 'https://wswhomo.afip.gov.ar/wshab/service.asmx?wsdl'
  },

  // Servicios disponibles
  services: {
    constancia_inscripcion: 'arbccf',
    certificados: 'ws_certificados'
  },

  // Configuración de certificados
  certificates: {
    // Ruta relativa desde la raíz del proyecto
    pfxPath: './certs/certificado.pfx',
    rootRtiPath: './certs/Root_RTI.txt',
    passwordFile: './certs/pwrCst.txt'
  },

  // Timeouts y reintentos
  timeouts: {
    wsaa: 30000, // 30 segundos
    wsCert: 60000, // 60 segundos
    maxRetries: 3
  }
};

// Función para obtener configuración según ambiente
export function getAfipConfig(environment: 'production' | 'testing' = 'testing') {
  return {
    wsaaUrl: afipConfig.wsaa[environment],
    wsCertUrl: afipConfig.wsCert[environment],
    services: afipConfig.services,
    certificates: afipConfig.certificates,
    timeouts: afipConfig.timeouts
  };
}