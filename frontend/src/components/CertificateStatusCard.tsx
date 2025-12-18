'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface CertificateStatus {
  existe: boolean;
  estado?: 'ACTIVO' | 'EXPIRADO' | 'PROXIMO_A_VENCER';
  diasParaVencer?: number;
  fechaVencimiento?: string;
  metadata?: {
    subject?: string;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    thumbprint?: string;
  };
  alertas?: string[];
  uploaded_at?: string;
  updated_at?: string;
}

export function CertificateStatusCard() {
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const response = await api.get('/certificados-maestro/admin/status');
        setStatus(response.data);
      } catch (err: any) {
        console.error('Error fetching certificate status:', err);
        setError(err.response?.data?.message || 'Error al cargar estado del certificado');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    // Recargar cada 5 minutos
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="animate-pulse">
              <div className="h-6 w-48 bg-gray-200 rounded"></div>
              <div className="h-4 w-32 bg-gray-200 rounded mt-2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
        <div className="p-5">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Error al cargar estado</h3>
              <div className="text-sm text-red-700 mt-1">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!status?.existe) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
        <div className="p-5">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <dt className="text-sm font-medium text-yellow-800">
                Estado del Certificado
              </dt>
              <dd className="text-sm text-yellow-700 mt-1">
                ⚠️ No se ha cargado ningún certificado aún
              </dd>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (estado?: string) => {
    switch (estado) {
      case 'ACTIVO':
        return { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', text: 'text-green-800' };
      case 'PROXIMO_A_VENCER':
        return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-600', text: 'text-yellow-800' };
      case 'EXPIRADO':
        return { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', text: 'text-red-800' };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-600', text: 'text-gray-800' };
    }
  };

  const colors = getStatusColor(status?.estado);

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-lg overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start flex-1">
            <div className="flex-shrink-0">
              {status?.estado === 'ACTIVO' && (
                <svg className={`h-6 w-6 ${colors.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {status?.estado === 'PROXIMO_A_VENCER' && (
                <svg className={`h-6 w-6 ${colors.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {status?.estado === 'EXPIRADO' && (
                <svg className={`h-6 w-6 ${colors.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l-2-2m0 0l-2-2m2 2l2-2m-2 2l-2 2m2-2l2 2" />
                </svg>
              )}
            </div>
            <div className="ml-3 flex-1">
              <dt className={`text-sm font-medium ${colors.text}`}>
                Estado del Certificado
              </dt>
              <dd className={`text-lg font-bold ${colors.text} mt-1`}>
                {status?.estado === 'ACTIVO' && '✅ ACTIVO'}
                {status?.estado === 'PROXIMO_A_VENCER' && '⚠️ PRÓXIMO A VENCER'}
                {status?.estado === 'EXPIRADO' && '❌ EXPIRADO'}
              </dd>

              {status?.diasParaVencer !== undefined && (
                <div className={`text-sm ${colors.text} mt-2`}>
                  <div>📅 Días para vencer: <strong>{status.diasParaVencer}</strong></div>
                  {status?.fechaVencimiento && (
                    <div>
                      📆 Fecha de vencimiento:{' '}
                      <strong>{new Date(status.fechaVencimiento).toLocaleDateString('es-ES')}</strong>
                    </div>
                  )}
                </div>
              )}

              {status?.alertas && status.alertas.length > 0 && (
                <div className={`mt-3 space-y-1`}>
                  {status.alertas.map((alerta, idx) => (
                    <div key={idx} className={`text-sm ${colors.text}`}>
                      {alerta}
                    </div>
                  ))}
                </div>
              )}

              {status?.uploaded_at && (
                <div className={`text-xs ${colors.text} opacity-75 mt-3`}>
                  Cargado: {new Date(status.uploaded_at).toLocaleDateString('es-ES')} a las{' '}
                  {new Date(status.uploaded_at).toLocaleTimeString('es-ES')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
