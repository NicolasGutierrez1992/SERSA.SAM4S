'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {authApi, getUser, certificadosApi, type CreateDescargaRequest, type DescargaHistorial, type MetricasPersonales } from '@/lib/api';
import Image from 'next/image';
import * as XLSX from 'xlsx';

export default function CertificadosPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'descarga' | 'historial'>('descarga');
  
  // Estados para descarga
  const [descargaData, setDescargaData] = useState<CreateDescargaRequest>({
    controladorId: '',
    marca: 'SH',
    modelo: 'IA',
    numeroSerie: ''
  });
  const [descargaLoading, setDescargaLoading] = useState(false);
  const [descargaError, setDescargaError] = useState('');
  const [canDownload, setCanDownload] = useState(true);
  const [downloadMessage, setDownloadMessage] = useState('');
  
  // Estados para filtros
  const [filtros, setFiltros] = useState({
    cuit: '',
    idMayorista: '',
    mes: '',
    controladorId: '',
    estadoMayorista: '',
    marca: '',
    anio: ''
  });

  // Estado para historial
  const [historial, setHistorial] = useState<DescargaHistorial[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);

  // Estados para métricas
  const [metricas, setMetricas] = useState<MetricasPersonales | null>(null);

  // Estados para modal de facturación
  const [showFacturacionModal, setShowFacturacionModal] = useState(false);
  const [facturaData, setFacturaData] = useState({
    numero_factura: '',
    referencia_pago: ''
  });
  const [pendingEstadoChange, setPendingEstadoChange] = useState<{
    downloadId: string;
    nuevoEstado: string;
    tipo: 'mayorista' | 'distribuidor';
    userid: number;
  } | null>(null);
  const [facturaLoading, setFacturaLoading] = useState(false);

  // Estado para columnas colapsables
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const toggleRowExpanded = (downloadId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(downloadId)) {
        newSet.delete(downloadId);
      } else {
        newSet.add(downloadId);
      }
      return newSet;
    });
  };
  
  const router = useRouter();

  useEffect(() => {
    const userData = getUser();
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(userData);
    setLoading(false);
    loadMetricas();
    // Solo setFiltros si es distribuidor, sin llamar a loadHistorial aquí
    if (activeTab === 'historial' && userData.rol === 3) {
      setFiltros(f => ({ ...f, cuit: userData.cuit, idMayorista: String(userData.id_mayorista) }));
    }
  }, [router]);

   
  useEffect(() => {
    if (activeTab === 'historial') {
      loadHistorial();
    }
  }, [activeTab, user, filtros]);


  const loadMetricas = async () => {
    try {
      const metricasData = await certificadosApi.getMetricas();
      console.log('Métricas cargadas:', metricasData);
      console.log('Porcentaje límite:', metricasData.porcentajeLimite);
      console.log('Límite de descargas:', metricasData.limiteDescargas);
        
      setMetricas(metricasData);
    } catch (error) {
      console.error('Error cargando métricas:', error);
    }
  };  // Función para cargar historial según rol
  const loadHistorial = async () => {
    setHistorialLoading(true);
    // Construir filtrosFinal con tipos correctos
    let filtrosFinal: any = { ...filtros, page: 1, limit: 50 };
    
    if (user?.rol === 3) {
      filtrosFinal.cuit = user.cuit;
      filtrosFinal.idMayorista = String(user.id_mayorista);
    }
    if (user?.rol === 2) {
      filtrosFinal.idMayorista = String(user.id_mayorista);
    }
    
    // Validar CUIT antes de hacer la petición
    if (filtrosFinal.cuit && !/^\d{8,}$/.test(filtrosFinal.cuit)) {
      setHistorial([]);
      setHistorialLoading(false);
      return;
    }
    
    // Limpiar filtros vacíos y undefined
    filtrosFinal = Object.fromEntries(
      Object.entries(filtrosFinal).filter(([_, v]) => v !== '' && v !== undefined && v !== null)
    );
    
    // Convertir mes y anio a número
    if (filtrosFinal.mes) {
      const mesNum = Number(filtrosFinal.mes);
      if (isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
        delete filtrosFinal.mes;
      } else {
        filtrosFinal.mes = mesNum;
      }
    }
    
    if (filtrosFinal.anio) {
      const anioNum = Number(filtrosFinal.anio);
      if (isNaN(anioNum) || anioNum < 2025 || anioNum > 2100) {
        delete filtrosFinal.anio;
      } else {
        filtrosFinal.anio = anioNum;
      }
    }
    
    // Siempre usar getHistorialDescargas con los filtros
    const response = await certificadosApi.getHistorialDescargas(filtrosFinal);
    setHistorial(response.descargas || []);
    setHistorialLoading(false);
  };
   // Validar límite de descargas (ahora función reutilizable)
  const validarLimiteDescargas = async () => {
    if (!user) return;
    try {
      // Intentar usar el nuevo endpoint de validación PREPAGO
      const validacion = await certificadosApi.validarDescarga();
      setCanDownload(validacion.canDownload);
      setDownloadMessage(validacion.message);
    } catch (error) {
      // Fallback al método anterior si el endpoint no existe aún
      const limite = user.limite_descargas;
      const pendientes = await getDescargasPendientes(user.cuit, limite);
      
      if (user.rol === 1) {
        setCanDownload(true);
        setDownloadMessage('');
      } else if (pendientes >= limite) {
        setCanDownload(false);
        setDownloadMessage(`Has alcanzado el límite de descargas pendientes (${pendientes} de ${limite}). No puedes descargar certificados hasta que se libere el límite.`);
      } else {
        setCanDownload(true);
        setDownloadMessage('');
      }
    }
  };

  useEffect(() => {
    validarLimiteDescargas();
  }, [user]);

  const handleDescarga = async (e: React.FormEvent) => {
    e.preventDefault();
    setDescargaLoading(true);
    setDescargaError('');

    try {
      // Validaciones
      if (descargaData.numeroSerie.length < 1 || descargaData.numeroSerie.length > 10) {
        throw new Error('El número de serie debe tener entre 1 y 10 dígitos');
      }

      // 1. Generar certificado
      const response = await certificadosApi.descargarCertificado(descargaData);
      
      // 2. Descargar archivo automáticamente
      const blob = await certificadosApi.descargarArchivo(response.downloadId);
      
      // 3. Crear enlace de descarga
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // 4. Limpiar formulario y recargar métricas
      setDescargaData({
        controladorId: '',
        marca: 'SH',
        modelo: 'IA',
        numeroSerie: ''
      });
      await validarLimiteDescargas();
      await loadMetricas();
      
      alert('¡Certificado descargado exitosamente!');
      
    } catch (error: any) {
      console.error('Error en descarga:', error);
      
      if (error.response?.data?.message) {
        setDescargaError(error.response.data.message);
      } else if (error.message === 'Network Error') {
        setDescargaError('Error de conexión. Verifique que el servidor esté funcionando.');
      } else {
        setDescargaError(error.message || 'Error al descargar certificado. Por favor, inténtelo nuevamente.');
      }
    } finally {
      setDescargaLoading(false);
     
    }
  };  const handleEstadoChange = async (downloadId: string, nuevoEstado: string, tipo: 'mayorista' | 'distribuidor', userid: number, tipoDescarga?: string) => {
    try {
      // Bloquear cambios si es PREPAGO
      if (tipoDescarga === 'PREPAGO') {
        alert('No se puede modificar el estado de descargas PREPAGO. El estado PREPAGO es definitivo e inmutable.');
        return;
      }

      // Si requiere número de factura o referencia, mostrar modal
      if ((nuevoEstado === 'Facturado' || nuevoEstado === 'Cobrado') && tipo === 'mayorista') {
        setFacturaData({
          numero_factura: '',
          referencia_pago: ''
        });
        setPendingEstadoChange({
          downloadId,
          nuevoEstado,
          tipo,
          userid
        });
        setShowFacturacionModal(true);
        return;
      }
      
      // Si no requiere datos, hacer cambio directo
      if (user?.id_mayorista === 1) {
        await certificadosApi.cambiarEstado(downloadId, { estadoDistribuidor: nuevoEstado, estadoMayorista: nuevoEstado });
      }
      else { 
        const estado = tipo === 'mayorista' 
          ? { estadoMayorista: nuevoEstado }
          : { estadoDistribuidor: nuevoEstado };
        console.log('cambio de estado:', estado);        
        await certificadosApi.cambiarEstado(downloadId, estado);
      }
      await loadHistorial();
    } catch (error) {
      console.error('Error cambiando estado:', error);
      alert('Error al cambiar estado');
    }
  };
  const handleConfirmarFacturacion = async () => {
    if (!pendingEstadoChange) return;
    if (facturaLoading) return; // Prevenir múltiples clics

    setFacturaLoading(true);
    try {
      const updateData: any = { [pendingEstadoChange.tipo === 'mayorista' ? 'estadoMayorista' : 'estadoDistribuidor']: pendingEstadoChange.nuevoEstado };
      
      // Agregar número de factura si se está cambiando a Facturado
      if (pendingEstadoChange.nuevoEstado === 'Facturado' && facturaData.numero_factura) {
        updateData.numero_factura = facturaData.numero_factura;
      }

      // Agregar referencia de pago si se está cambiando a Cobrado
      if (pendingEstadoChange.nuevoEstado === 'Cobrado' && facturaData.referencia_pago) {
        updateData.referencia_pago = facturaData.referencia_pago;
      }

      await certificadosApi.cambiarEstado(pendingEstadoChange.downloadId, updateData);
      setShowFacturacionModal(false);
      setPendingEstadoChange(null);
      setFacturaData({ numero_factura: '', referencia_pago: '' });
      await loadHistorial();
      alert('Estado actualizado correctamente');
    } catch (error) {
      console.error('Error al confirmar facturación:', error);
      alert('Error al actualizar estado');
    } finally {
      setFacturaLoading(false);
    }
  };

  const getRoleName = (rol: number) => {
    switch (rol) {
      case 1: return 'Administrador';
      case 2: return 'Mayorista';
      case 3: return 'Distribuidor';
      case 4: return 'Facturación';
      default: return 'Usuario';
    }
  };
  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'PREPAGO': return 'bg-red-100 text-red-800';
      case 'Pendiente de Facturar': return 'bg-yellow-100 text-yellow-800';
      case 'Facturado': return 'bg-blue-100 text-blue-800';
      case 'Cobrado': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  const handleLogout = () => {
      authApi.logout();
    };  // Función auxiliar para obtener descargas pendientes
  async function getDescargasPendientes(userCuit: string, limite: number) {
    const params: any = {
      estadoMayorista: 'Pendiente de Facturar',
      page: 1,
      limit: 1000
    };
    // Solo incluir parámetros que tengan valores
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
    );
    
    const response = await certificadosApi.getHistorialDescargas(filteredParams);
    // Filtrar solo las descargas del usuario actual por cuit
    return response.descargas.filter(d => d.usuario && d.usuario.cuit === userCuit).length;
  }

  // Identificar el último registro por controladorId antes del return
  const ultimosPorControlador: Record<string, string> = {};
  historial.forEach((descarga) => {
    const key = descarga.controladorId;
    if (!key) return; // Ignorar si no hay controladorId
    if (!ultimosPorControlador[key] || new Date(descarga.updatedAt) > new Date(historial.find(d => d.id === ultimosPorControlador[key])?.updatedAt || 0)) {
      ultimosPorControlador[key] = descarga.id;
    }
  });

  useEffect(() => {
    // Solo ejecutar si user existe y no es null
    if (user && user.id_mayorista !== undefined && user.rol !== 1) {
      setFiltros(f => ({ ...f, idMayorista: String(user.id_mayorista) }));
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                disabled={user.rol === 3}
                onClick={() => router.push('/dashboard')}
                className="mr-4 p-2 rounded-md hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <Image
                src="/assets/images/logo.SERSA.jpg"
                alt="SERSA Logo"
                width={80}
                height={40}
                className="h-6 w-auto mr-3"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Certificados SAM4S</h1>
                <p className="text-sm text-gray-600">Gestión y descarga de certificados</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user?.nombre}
                </p>
                <p className="text-xs text-gray-500">
                  {getRoleName(user?.rol)} • CUIT: {user?.cuit}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Métricas */}
        {metricas && (
          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/*  Descargas Esta semana */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Esta Semana</dt>
                      <dd className="text-lg font-medium text-gray-900">{metricas.descargasSemana}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            {/*  Pendientes Facturar*/}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Pendiente Facturar</dt>
                      <dd className="text-lg font-medium text-gray-900">{metricas.pendienteFacturar}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            {/*  Limite de descarga */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                      metricas.porcentajeLimite >= 80 ? 'bg-red-400' : 'bg-green-400'
                    }`}>
                      <span className="text-xs font-bold text-white">
                        {metricas.porcentajeLimite}%
                      </span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Uso del Límite</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {metricas.pendienteFacturar}/{metricas.limiteDescargas!=0 ? metricas.limiteDescargas : '∞'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {/* Solo mostrar el tab de descarga si el usuario NO es mayorista ni facturación */}
              {user?.rol !== 4 && (
                <button
                  onClick={() => setActiveTab('descarga')}
                  className={`${
                    activeTab === 'descarga'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
                >
                  Nueva Descarga
                </button>
              )}
              <button
                onClick={() => {
                  setActiveTab('historial');
                  loadHistorial();
                }}
                className={`${
                  activeTab === 'historial'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
              >
                Historial
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Solo mostrar el formulario de descarga si el usuario NO es mayorista ni facturación */}
            {activeTab === 'descarga' && user?.rol !== 4 && (
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-medium text-gray-900 mb-6">
                  Descargar Nuevo Certificado
                </h3>                {downloadMessage && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
                    {downloadMessage}
                  </div>
                )}
                
                {user?.tipo_descarga === 'PREPAGO' && metricas && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
                    <strong>Sistema PREPAGO Activo:</strong> Tienes {metricas.limiteDescargas} descargas disponibles.
                  </div>
                )}

                <form onSubmit={handleDescarga} className="space-y-6">
                  {descargaError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                      {descargaError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Marca *
                    </label>
                    <select
                      value={descargaData.marca}
                      onChange={(e) => setDescargaData(prev => ({ ...prev, marca: e.target.value as 'SH' }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="SH">SAM4S</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Modelo *
                    </label>
                    <select
                      value={descargaData.modelo}
                      onChange={(e) => setDescargaData(prev => ({ ...prev, modelo: e.target.value as 'IA' | 'RA' }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="IA">ELLIX40F</option>
                      <option value="RA">NR330F</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Número de Serie *
                    </label>
                    <input
                      type="text"
                      value={descargaData.numeroSerie}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          setDescargaData(prev => ({ ...prev, numeroSerie: value }));
                        }
                      }}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="1-10 dígitos numéricos"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Solo números, entre 1 y 10 dígitos. Se completará con ceros a la izquierda.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={descargaLoading || !descargaData.numeroSerie || !canDownload}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {descargaLoading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Procesando descarga...
                      </span>
                    ) : !canDownload ? (
                      'SOLICITAR LIMITE A TU PROVEEDOR'
                    ) : (
                      'Descargar Certificado'
                    )}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'historial' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-6">
                  Historial de Descargas
                </h3>
                <button
                  onClick={() => {
                    // Generar datos para Excel
                    const data = historial.map((descarga) => ({
                      Controlador: descarga.controladorId || descarga.certificadoNombre,
                      Usuario: descarga.usuario ? descarga.usuario.nombre : descarga.usuarioId,
                      CUIT: descarga.usuario?.cuit || '',
                      'Estado Mayorista': descarga.estadoMayorista || '',
                      'Fecha de Facturación': descarga.fechaFacturacion ? new Date(descarga.fechaFacturacion).toLocaleDateString() : 'Sin facturar',
                      'Estado Distribuidor': descarga.estadoDistribuidor || '',
                      'Ultima Creacion': descarga.updatedAt ? new Date(descarga.updatedAt).toLocaleDateString() : 'Sin fecha',
                    }));
                    const ws = XLSX.utils.json_to_sheet(data);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Historial');
                    XLSX.writeFile(wb, 'historial_certificados.xlsx');
                  }}
                  className="mb-4 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded shadow"
                >
                  Exportar a Excel
                </button>
                {/* Filtros */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
                  {user?.rol !== 3 && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">CUIT</label>
                        <input
                          type="text"
                          value={filtros.cuit}
                          onChange={e => setFiltros(f => ({ ...f, cuit: e.target.value }))}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          disabled={user?.rol === 3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Mayorista</label>
                        <select
                          value={filtros.idMayorista}
                          onChange={e => setFiltros(f => ({ ...f, idMayorista: e.target.value }))}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          disabled={user?.rol !== 1 && user?.rol !== 4}
                        >
                          <option value="">Todos</option>
                          <option value="1">SERSA</option>
                          <option value="2">OLICART</option>
                          <option value="3">MARINUCCI</option>
                          <option value="4">COLOMA</option>
                          <option value="5">SANTICH</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Mes</label>
                    <select
                      value={filtros.mes || ''}
                      onChange={e => setFiltros(f => ({ ...f, mes: e.target.value }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Todas</option>
                      <option value="1">Enero</option>
                      <option value="2">Febrero</option>
                      <option value="3">Marzo</option>
                      <option value="4">Abril</option>
                      <option value="5">Mayo</option>
                      <option value="6">Junio</option>
                      <option value="7">Julio</option>
                      <option value="8">Agosto</option>
                      <option value="9">Septiembre</option>
                      <option value="10">Octubre</option>
                      <option value="11">Noviembre</option>
                      <option value="12">Diciembre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Año</label>
                    <select
                      value={filtros.anio || ''}
                      onChange={e => setFiltros(f => ({ ...f, anio: e.target.value }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Todos</option>
                      {Array.from({ length: 2100 - 2025 + 1 }, (_, i) => 2025 + i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>                  <div>
                    <label className="block text-sm font-medium text-gray-700">Estado</label>
                    <select
                      value={filtros.estadoMayorista}
                      onChange={e => setFiltros(prev => ({ ...prev, estadoMayorista: e.target.value }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Todos los estados</option>
                      <option value="PREPAGO">PREPAGO</option>
                      <option value="Pendiente de Facturar">Pendiente de Facturar</option>
                      <option value="Facturado">Facturado</option>
                      <option value="Cobrado">Cobrado</option>
                    </select>
                  </div>
                </div>
                {/* Tabla */}
                {historialLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : (
                  <div>
                    <div className="overflow-x-auto">
                      <table>                        <thead className="bg-gray-50">                          <tr>
                            <th className="px-3 py-3  text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Controlador</th>
                            <th className="px-3 py-3  text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Usuario</th>
                            {user?.rol == 4   && (<th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">CUIT</th>)}                            {user?.rol !== 3   && (<th className="px-3 py-3  text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado Mayorista</th>)}
                            {user?.rol !== 3   && (<th className="px-3 py-3  text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha de Facturación</th>)}
                            {(user?.rol === 2 || user?.rol === 3)   && (<th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado Distribuidor</th>)}
                            {user?.rol !== 4   && (<th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Ultima Creacion</th>)}
                            {user?.rol == 4   && (<th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">CUIT</th>)}
                            <th className="px-3 py-3  text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {historial.map((descarga) => {
                            const esUltimo = descarga.controladorId && ultimosPorControlador[descarga.controladorId] === descarga.id;
                            return (                              <tr key={descarga.id}>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{descarga.controladorId || descarga.certificadoNombre}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{descarga.usuario ? descarga.usuario.nombre : descarga.usuarioId}</td>
                                {user?.rol == 4   && (<td className="px-3 py-4  whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full `}>{descarga.usuario?.cuit}</span>
                                </td>)}{user?.rol !== 3   && (<td className="px-3 py-4 whitespace-nowrap">
                                  <div className="space-y-2">
                                    {/* Collapsible row header */}
                                    <button
                                      onClick={() => toggleRowExpanded(descarga.id)}
                                      className="flex items-center gap-2 w-full hover:opacity-80"
                                    >
                                      <svg
                                        className={`h-4 w-4 transition-transform ${expandedRows.has(descarga.id) ? 'rotate-90' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(descarga.estadoMayorista)}`}>
                                        Estado: {descarga.estadoMayorista}
                                      </span>
                                    </button>
                                    
                                    {/* Expanded content */}
                                    {expandedRows.has(descarga.id) && (
                                      <div className="pl-6 space-y-2 border-l-2 border-gray-300">                                        {/* Estado change dropdown */}                                        {(user?.rol === 1 || user?.rol === 4) && (
                                          <div>
                                            {descarga.tipoDescarga === 'PREPAGO' ? (
                                              <div className="p-3 bg-red-50 border border-red-200 rounded">
                                                <p className="text-xs font-semibold text-red-700">
                                                  ⚠️ Estado PREPAGO - Inmutable
                                                </p>
                                                <p className="text-xs text-red-600 mt-1">
                                                  No se puede modificar el estado de descargas PREPAGO. El estado PREPAGO es definitivo.
                                                </p>
                                              </div>                                            ) : (
                                              <>
                                                <label className="block text-xs font-semibold text-gray-700 mb-2">
                                                  Cambiar Estado:
                                                </label>
                                                <select
                                                  onChange={(e) => {
                                                    const nuevoEstado = e.target.value;
                                                    if (nuevoEstado !== descarga.estadoMayorista) {
                                                      handleEstadoChange(descarga.id, nuevoEstado, 'mayorista', descarga.usuarioId, descarga.tipoDescarga || undefined);
                                                      // Reset al valor actual para evitar que se quede seleccionado el otro estado
                                                      e.target.value = descarga.estadoMayorista;
                                                    }
                                                  }}
                                                  className="mt-1 text-xs border border-gray-300 rounded px-2 py-1 w-full hover:border-indigo-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                                  value={descarga.estadoMayorista}
                                                >
                                                  <option value={descarga.estadoMayorista}>{descarga.estadoMayorista}</option>
                                                  <option value="Pendiente de Facturar">Pendiente de Facturar</option>
                                                  <option value="Facturado">Facturado</option>
                                                  <option value="Cobrado">Cobrado</option>
                                                </select>
                                              </>
                                            )}
                                          </div>
                                        )}
                                        
                                        {/* Invoice and payment reference fields */}
                                        <div className="space-y-1 pt-2">
                                          {descarga.numero_factura && (
                                            <div className="text-xs">
                                              <span className="font-semibold text-gray-700">Nro Factura:</span>
                                              <span className="ml-2 text-gray-600">{descarga.numero_factura}</span>
                                            </div>
                                          )}
                                          {descarga.referencia_pago && (
                                            <div className="text-xs">
                                              <span className="font-semibold text-gray-700">Referencia:</span>
                                              <span className="ml-2 text-gray-600">{descarga.referencia_pago}</span>
                                            </div>
                                          )}
                                          {!descarga.numero_factura && !descarga.referencia_pago && (
                                            <div className="text-xs text-gray-500">
                                              Sin datos de facturación
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>)}                                {user?.rol !== 3   && (<td className="px-3 py-4  whitespace-nowrap text-sm text-gray-900">{
                                  !descarga.fechaFacturacion
                                    ? 'Sin facturar'
                                    : new Date(descarga.fechaFacturacion).toLocaleDateString()
                                }</td>)}

                                {(user?.rol === 2 || user?.rol === 3)   && (<td className="px-3 py-4  whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(descarga.estadoDistribuidor)}`}>{descarga.estadoDistribuidor}</span>
                                </td>)}
                              
                                {user?.rol !== 4   && (<td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{
                                  isNaN(new Date(descarga.updatedAt).getTime())
                                    ? 'Sin fecha'
                                    : new Date(descarga.updatedAt).toLocaleDateString()
                                }</td>)}                                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                  {/* Cambiar estado distribuidor (Mayorista) */}
                                  {user?.rol === 2 && (
                                    descarga.tipoDescarga === 'PREPAGO' ? (
                                      <span className="text-xs text-red-600 font-semibold">PREPAGO - Inmutable</span>                                    ) : (
                                      <select
                                        onChange={(e) => {
                                          const nuevoEstado = e.target.value;
                                          if (nuevoEstado !== descarga.estadoDistribuidor) {
                                            handleEstadoChange(descarga.id, nuevoEstado, 'distribuidor', descarga?.usuarioId, descarga.tipoDescarga || undefined);
                                            // Reset al valor actual para evitar que se quede seleccionado el otro estado
                                            e.target.value = descarga.estadoDistribuidor;
                                          }
                                        }}
                                        className="text-xs border border-gray-300 rounded px-2 py-1 hover:border-indigo-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                        value={descarga.estadoDistribuidor}
                                      >
                                        <option value={descarga.estadoDistribuidor}>{descarga.estadoDistribuidor}</option>
                                        <option value="Pendiente de Facturar">Pendiente de Facturar</option>
                                        <option value="Facturado">Facturado</option>
                                      </select>
                                    )
                                  )}
                                  {/* Descargar archivo: oculto para mayorista y facturación */}
                                  {user?.rol !== 2 && user?.rol !== 4 && (
                                    <button
                                      onClick={async () => {
                                        if (!esUltimo) return;
                                        try {
                                          const blob = await certificadosApi.descargarArchivo(descarga.id);
                                          const url = window.URL.createObjectURL(blob);
                                          const link = document.createElement('a');
                                          link.href = url;
                                          link.download = descarga.certificadoNombre ? descarga.certificadoNombre : 'error.pem';
                                          document.body.appendChild(link);
                                          link.click();
                                          document.body.removeChild(link);
                                          window.URL.revokeObjectURL(url);
                                        } catch (error) {
                                          alert('Error al descargar archivo');
                                        }
                                      }}
                                      className={`text-indigo-600 hover:text-indigo-900 ${!esUltimo ? 'opacity-40 cursor-not-allowed' : ''}`}
                                      disabled={!esUltimo}
                                      title={!esUltimo ? 'Solo se puede descargar el último certificado generado por controlador' : 'Descargar certificado'}
                                    >
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {historial.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No se encontraron descargas</p>
                        </div>
                      )}
                    </div>
                  </div>                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para entrada de número de factura y referencia de pago */}
      {showFacturacionModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {pendingEstadoChange?.nuevoEstado === 'Facturado' 
                ? 'Número de Factura' 
                : 'Referencia de Pago'}
            </h3>

            {pendingEstadoChange?.nuevoEstado === 'Facturado' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Factura (Opcional)
                </label>
                <input
                  type="text"
                  value={facturaData.numero_factura}
                  onChange={(e) => setFacturaData({ ...facturaData, numero_factura: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ej: 2025-001"
                />
              </div>
            )}

            {pendingEstadoChange?.nuevoEstado === 'Cobrado' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referencia de Pago (Opcional)
                </label>
                <input
                  type="text"
                  value={facturaData.referencia_pago}
                  onChange={(e) => setFacturaData({ ...facturaData, referencia_pago: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ej: REF-123456"
                />
              </div>
            )}            <div className="flex space-x-3">
              <button
                onClick={() => {
                  if (facturaLoading) return;
                  setShowFacturacionModal(false);
                  setPendingEstadoChange(null);
                  setFacturaData({ numero_factura: '', referencia_pago: '' });
                }}
                disabled={facturaLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarFacturacion}
                disabled={facturaLoading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {facturaLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Procesando...</span>
                  </>
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}