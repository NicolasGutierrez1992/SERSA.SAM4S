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
  const [downloadUserType, setDownloadUserType] = useState<'CUENTA_CORRIENTE' | 'PREPAGO' | "SIN_LIMITE" | null>(null);
    // Estados para filtros
  const [filtros, setFiltros] = useState({
    cuit: '',
    idMayorista: '',
    mes: '',
    controladorId: '',
    estadoMayorista: '',
    estadoDistribuidor: '', // ⭐ NUEVO: Para filtrar por estado distribuidor
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
  });  const [pendingEstadoChange, setPendingEstadoChange] = useState<{
    downloadId: string;
    nuevoEstado: string;
    tipo: 'mayorista' | 'distribuidor' | 'ambos';
    userid: number;
  } | null>(null);
  const [facturaLoading, setFacturaLoading] = useState(false);
  // Estado para columnas colapsables
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Estados para cambio masivo de estado
  const [selectedDownloadIds, setSelectedDownloadIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkNuevoEstado, setBulkNuevoEstado] = useState('');
  const [bulkFacturaData, setBulkFacturaData] = useState({
    numero_factura: '',
    referencia_pago: ''
  });
  const [bulkLoading, setBulkLoading] = useState(false);  const [bulkResults, setBulkResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // ⭐ Estados para modal de confirmación de descarga
  const [showDownloadConfirmModal, setShowDownloadConfirmModal] = useState(false);
  const [pendingDownloadData, setPendingDownloadData] = useState<CreateDescargaRequest | null>(null);
  const [downloadConfirmLoading, setDownloadConfirmLoading] = useState(false);
  const [acceptDownloadConfirm, setAcceptDownloadConfirm] = useState(false);
  
  const toggleRowExpanded = (downloadId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(downloadId)) {
        newSet.delete(downloadId);
      } else {
        newSet.add(downloadId);
      }
      return newSet;    });
  };

  // Funciones para selección de descargas
  const toggleSelectDownload = (downloadId: string) => {
    setSelectedDownloadIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(downloadId)) {
        newSet.delete(downloadId);
      } else {
        newSet.add(downloadId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    // Filtrar descargas que no sean PREPAGO
    const selectableIds = new Set(
      historial
        .filter(d => d.tipoDescarga !== 'PREPAGO')
        .map(d => d.id)
    );

    if (selectedDownloadIds.size === selectableIds.size) {
      // Si todos están seleccionados, desseleccionar todos
      setSelectedDownloadIds(new Set());
    } else {
      // Seleccionar todos los no-PREPAGO
      setSelectedDownloadIds(selectableIds);
    }
  };

  const handleBulkStatusChange = () => {
    // Reset form y abrir modal
    setBulkNuevoEstado('');
    setBulkFacturaData({ numero_factura: '', referencia_pago: '' });
    setBulkResults(null);
    setShowBulkModal(true);
  };

  const handleConfirmarCambioMasivo = async () => {
    if (!bulkNuevoEstado || bulkLoading) return;

    setBulkLoading(true);
    const selectedIds = Array.from(selectedDownloadIds);
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const downloadId of selectedIds) {
      try {
        const descarga = historial.find(d => d.id === downloadId);
        if (!descarga) continue;

        // Bloquear si es PREPAGO
        if (descarga.tipoDescarga === 'PREPAGO') {
          failedCount++;
          errors.push(`${descarga.controladorId}: PREPAGO - Inmutable`);
          continue;
        }

        // Construir datos de actualización
        const updateData: any = { estadoMayorista: bulkNuevoEstado };

        if (bulkNuevoEstado === 'Facturado' && bulkFacturaData.numero_factura) {
          updateData.numero_factura = bulkFacturaData.numero_factura;
        }

        if (bulkNuevoEstado === 'Cobrado' && bulkFacturaData.referencia_pago) {
          updateData.referencia_pago = bulkFacturaData.referencia_pago;
        }

        await certificadosApi.cambiarEstado(downloadId, updateData);
        successCount++;
      } catch (error: any) {
        failedCount++;
        const descarga = historial.find(d => d.id === downloadId);
        const controlador = descarga?.controladorId || downloadId;
        errors.push(`${controlador}: ${error.response?.data?.message || 'Error desconocido'}`);
      }
    }

    setBulkResults({ success: successCount, failed: failedCount, errors });
    setBulkLoading(false);

    // Si todo fue exitoso, cerrar modal y recargar
    if (failedCount === 0) {
      setTimeout(() => {
        setShowBulkModal(false);
        setSelectedDownloadIds(new Set());
        loadHistorial();
      }, 2000);
    }
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

  // ⭐ DEBUG: Verificar tipo_descarga del usuario
  useEffect(() => {
    if (user) {
      console.log('🔍 DEBUG - Usuario cargado:', {
        id: user.id,
        rol: user.rol,
        tipo_descarga: user.tipo_descarga,
        limite_descargas: user.limite_descargas
      });
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'historial') {
      loadHistorial();
    }  }, [activeTab, user, filtros]);

  // Limpiar selección cuando cambian los filtros
  useEffect(() => {
    setSelectedDownloadIds(new Set());
  }, [filtros]);

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
    
    // ⭐ IMPORTANTE: Pasar userRole al backend para filtrado inteligente
    filtrosFinal.userRole = user?.rol;
    
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
  };   // Validar límite de descargas (ahora función reutilizable)
  // ⭐ VALIDACIÓN CENTRALIZADA EN BACKEND - Elimina fallback defectuoso
  const validarLimiteDescargas = async () => {
    if (!user) return;
    try {
      // Usar endpoint de validación del backend (ÚNICA fuente de verdad)
      const validacion = await certificadosApi.validarDescarga();
      setCanDownload(validacion.canDownload);
      setDownloadMessage(validacion.message);
      setDownloadUserType(validacion.userType);
      
      console.log(`[Frontend] Validación de descarga: ${validacion.canDownload}`, {
        userType: validacion.userType,
        limiteDisponible: validacion.limiteDisponible,
        message: validacion.message
      });
    } catch (error) {
      console.error('Error validando límite de descargas:', error);
      // Si falla, asumir que NO puede descargar (modo seguro)
      setCanDownload(false);
      setDownloadMessage('Error al validar límite de descargas. Por favor, recarga la página.');
    }
  };

  useEffect(() => {
    validarLimiteDescargas();
  }, [user]);  const handleDescarga = async (e: React.FormEvent) => {
    e.preventDefault();
    setDescargaError('');

    try {
      // Validaciones locales
      if (descargaData.numeroSerie.length < 1 || descargaData.numeroSerie.length > 10) {
        throw new Error('El número de serie debe tener entre 1 y 10 dígitos');
      }

      // ⭐ NUEVA: Re-validar límite justo antes de mostrar el modal
      const validacionFinal = await certificadosApi.validarDescarga();
      if (!validacionFinal.canDownload) {
        throw new Error(validacionFinal.message);
      }

      // Guardar los datos pendientes y mostrar modal de confirmación
      setPendingDownloadData({ ...descargaData });
      setShowDownloadConfirmModal(true);
      
    } catch (error: any) {
      console.error('Error en validación de descarga:', error);
      
      if (error.response?.data?.message) {
        setDescargaError(error.response.data.message);
      } else if (error.message === 'Network Error') {
        setDescargaError('Error de conexión. Verifique que el servidor esté funcionando.');
      } else {
        setDescargaError(error.message || 'Error al descargar certificado. Por favor, inténtelo nuevamente.');
      }
    }
  };

  // ⭐ NUEVA: Confirmar descarga después de aceptar el modal
  const handleConfirmarDescarga = async () => {
    if (!pendingDownloadData) return;
    setDownloadConfirmLoading(true);
    setDescargaError('');

    try {
      // 1. Generar certificado
      const response = await certificadosApi.descargarCertificado(pendingDownloadData);
      
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
      window.URL.revokeObjectURL(url);      // 4. Cerrar modal
      setShowDownloadConfirmModal(false);
      setPendingDownloadData(null);
      setAcceptDownloadConfirm(false);

      // 5. Limpiar formulario y recargar métricas
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
      setDownloadConfirmLoading(false);
    }
  };
  const handleCancelarDescarga = () => {
    setShowDownloadConfirmModal(false);
    setPendingDownloadData(null);
    setAcceptDownloadConfirm(false);
    setDescargaError('');
  };  const handleEstadoChange = async (downloadId: string, nuevoEstado: string, rol: number, userid: number, tipoDescarga?: string, idMayorista?: number) => {
    try {
      // ⭐ NUEVA LÓGICA SIMPLIFICADA
      
      // Técnico (5): No puede cambiar nada
      if (rol === 5) {
        alert('Los técnicos no pueden cambiar estados de descargas.');
        return;
      }
      
      // Admin (1) y Facturación (4): Cambiar estadoMayorista
      if (rol === 1 || rol === 4) {
       
        
        // Si requiere datos de facturación, mostrar modal
        if (nuevoEstado === 'Facturado' || nuevoEstado === 'Cobrado') {
          setFacturaData({
            numero_factura: '',
            referencia_pago: ''
          });       
          setPendingEstadoChange({
            downloadId,
            nuevoEstado,
            tipo: 'ambos', // Admin/Fact SIEMPRE cambian solo estadoMayorista
            userid
          });
          setShowFacturacionModal(true);
          return;
        }
         // ÚNICA restricción: Si mayorista = 1 (SERSA), al ser Admin o Facturación, permitir cambio de ambos estados)
        if (idMayorista === 1) {
          await certificadosApi.cambiarEstado(downloadId, { estadoMayorista: nuevoEstado, estadoDistribuidor: nuevoEstado });
          console.log('cambio de estado ambos (admin/facturación, mayorista 1):', { estadoMayorista: nuevoEstado, estadoDistribuidor: nuevoEstado }); 
        } else {
          await certificadosApi.cambiarEstado(downloadId, { estadoMayorista: nuevoEstado });
        }
        await loadHistorial();
        //alert('Estado actualizado correctamente');
        return;
      }
      
      // Mayorista (2): Cambiar estadoDistribuidor
      if (rol === 2) {
        // Mayorista NO puede cambiar estado si la descarga es PREPAGO
        if (tipoDescarga === 'PREPAGO') {
          alert('No se puede modificar el estado de descargas PREPAGO. El estado es definitivo.');
          return;
        }
        
        const estado = { estadoDistribuidor: nuevoEstado };
        console.log('cambio de estado distribuidor (mayorista):', estado);        
        await certificadosApi.cambiarEstado(downloadId, estado);
        await loadHistorial();
        //alert('Estado actualizado correctamente');
        return;
      }
      
      // Distribuidor (3): No puede cambiar nada
      if (rol === 3) {
        alert('Los distribuidores no pueden cambiar estados de descargas.');
        return;
      }
      
    } catch (error) {
      console.error('Error cambiando estado:', error);
      alert('Error al cambiar estado');
    }
  };const handleConfirmarFacturacion = async () => {
    if (!pendingEstadoChange) return;
    if (facturaLoading) return; // Prevenir múltiples clics

    setFacturaLoading(true);
    try {
      // Si tipo es 'ambos', actualizar ambos estados
      const updateData: any = {};
      if (pendingEstadoChange.tipo === 'ambos') {
        updateData.estadoDistribuidor = pendingEstadoChange.nuevoEstado;
        updateData.estadoMayorista = pendingEstadoChange.nuevoEstado;
      } else if (pendingEstadoChange.tipo === 'mayorista') {
        updateData.estadoMayorista = pendingEstadoChange.nuevoEstado;
      } else {
        updateData.estadoDistribuidor = pendingEstadoChange.nuevoEstado;
      }
      
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
      //alert('Estado actualizado correctamente');
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
      case 5: return 'Técnico';
      default: return 'Usuario';
    }
  };const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'PREPAGO': return 'bg-red-100 text-red-800';
      case 'Pendiente de Facturar': return 'bg-yellow-100 text-yellow-800';
      case 'Facturado': return 'bg-blue-100 text-blue-800';
      case 'Cobrado': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calcular descargas seleccionadas válidas (no PREPAGO)
  const validSelectedCount = Array.from(selectedDownloadIds).filter(id =>
    historial.find(d => d.id === id && d.tipoDescarga !== 'PREPAGO')
  ).length;  const handleLogout = () => {
      authApi.logout();
    };
  
  // ⭐ REMOVIDO: getDescargasPendientes - La validación ahora es 100% en backend
  // El backend valida en canUserDownload() diferenciando:
  // - PREPAGO: Valida límite_descargas > 0
  // - CUENTA_CORRIENTE (rol 3): Valida estadoDistribuidor "Pendiente" >= límite
  // - CUENTA_CORRIENTE (otros): Valida estadoMayorista "Pendiente" >= límite

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
      </header>      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Métricas - Dinámicas según rol */}
        {metricas && (
          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            
            {/* ========== ADMIN (Rol 1) y FACTURADOR (Rol 4) ========== */}
            {(user?.rol === 1 || user?.rol === 4) && (
              <>
                {/* 1. Descargas Totales (histórico) */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Descargas Totales</dt>
                          <dd className="text-lg font-medium text-gray-900">{metricas.descargasTotales}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Descargas Esta Semana */}
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

                {/* 3. Pendiente de Facturar (Estado Mayorista) */}
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
              </>
            )}

            {/* ========== MAYORISTA (Rol 2) ========== */}
            {user?.rol === 2 && (
              <>
                {/* 1. Pendiente Mayorista */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Pendiente (Estado Mayorista)</dt>
                          <dd className="text-lg font-medium text-gray-900">{metricas.pendienteFacturarMayorista}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Pendiente Distribuidor */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Pendiente (Estado Distribuidor)</dt>
                          <dd className="text-lg font-medium text-gray-900">{metricas.pendienteFacturarDistribuidor}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Descargas Propias Total */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Descargas Propias</dt>
                          <dd className="text-lg font-medium text-gray-900">{metricas.descargasPropiasTotal}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}            {/* ========== DISTRIBUIDOR (Rol 3) ========== */}
            {user?.rol === 3 && (
              <>
                {/* 1. Pendiente de Facturar */}
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
                          <dt className="text-sm font-medium text-gray-500 truncate">Pendiente de Facturar</dt>
                          <dd className="text-lg font-medium text-gray-900">{metricas.pendienteFacturar}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Pendiente de Cobrar (Facturado) */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Pendiente de Pago</dt>
                          <dd className="text-lg font-medium text-gray-900">{metricas.pendienteCobrar || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Uso del Límite */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                          metricas.porcentajeLimite! >= 80 ? 'bg-red-400' : 'bg-green-400'
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
                            {(metricas.pendienteFacturar || 0) + (metricas.pendienteCobrar || 0)}/{metricas.limiteDescargas != 0 ? metricas.limiteDescargas : '∞'}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">              {/* Solo mostrar el tab de descarga si el usuario NO es mayorista ni facturación ni técnico */}
              {user?.rol !== 4 && user?.rol !== 5 && (
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

          <div className="p-6">            {/* Solo mostrar el formulario de descarga si el usuario NO es mayorista ni facturación */}
            {activeTab === 'descarga' && user?.rol !== 4 && user?.rol !== 5 && (
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-medium text-gray-900 mb-6">
                  Descargar Nuevo Certificado
                </h3>                {downloadMessage && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
                    {downloadMessage}
                  </div>                )}
                  {(downloadUserType === 'PREPAGO') && metricas && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
                    <strong>Sistema PREPAGO Activo:</strong> Tienes {metricas.limiteDescargas} descargas disponibles.
                  </div>
                )}
                {(downloadUserType === 'CUENTA_CORRIENTE') && metricas && user?.rol === 3 && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
                    <strong>Sistema CUENTA CORRIENTE Activo:</strong> Tienes {metricas.limiteDescargas! - ((metricas.pendienteFacturar||0) + (metricas.pendienteCobrar || 0))} de {metricas.limiteDescargas} descargas disponibles.
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
                  </div>                  <button
                    type="submit"
                    disabled={!descargaData.numeroSerie || !canDownload}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {!canDownload ? (
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
                </h3>                <button
                  onClick={() => {                    // Generar datos para Excel
                    const data = historial.map((descarga) => {
                      const baseData: Record<string, any> = {
                        Controlador: descarga.controladorId || descarga.certificadoNombre || '',
                        Usuario: descarga.usuario ? descarga.usuario.nombre : (descarga.usuarioId || ''),
                        CUIT: descarga.usuario?.cuit || '',
                        'Estado Mayorista': descarga.estadoMayorista || '',
                        'Fecha de Facturación': descarga.fechaFacturacion ? new Date(descarga.fechaFacturacion).toLocaleDateString() : 'Sin facturar',
                        'Estado Distribuidor': descarga.estadoDistribuidor || '',
                        'Ultima Creacion': descarga.updatedAt ? new Date(descarga.updatedAt).toLocaleDateString() : 'Sin fecha',
                      };

                      // ⭐ Agregar columnas de facturación SOLO si el usuario NO es distribuidor (rol ≠ 3)
                      if (user?.rol !== 3) {
                        baseData['Número de Factura'] = descarga.numero_factura || '-';
                        baseData['Referencia de Pago'] = descarga.referencia_pago || '-';
                      }

                      return baseData;
                    });
                    const ws = XLSX.utils.json_to_sheet(data);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Historial');
                    XLSX.writeFile(wb, 'historial_certificados.xlsx');
                  }}
                  className="mb-4 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded shadow"
                >                  Exportar a Excel
                </button>
                {/* Botón de cambio masivo de estado - solo para Admin y Facturación */}                {(user?.rol === 1 || user?.rol === 4) && (
                  <button
                    onClick={handleBulkStatusChange}
                    disabled={validSelectedCount === 0}
                    className="ml-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded shadow transition-colors"
                  >
                    Cambio de Estado Masivo ({validSelectedCount})
                  </button>
                )}
                {user?.rol === 5 && (
                  <div className="ml-2 inline-block p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                    ℹ️ Como técnico, tienes permiso para ver todas las descargas, pero no puedes cambiar estados.
                  </div>
                )}
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
                    </select>                  </div>                  <div>
                    <label className="block text-sm font-medium text-gray-700">Estado</label>
                    {/* ⭐ FILTRO DINÁMICO SEGÚN ROL */}
                    {(user?.rol === 1 || user?.rol === 4) ? (
                      // ROL 1 (Admin) y ROL 4 (Facturación): Filtrar por EstadoMayorista
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
                    ) : (
                      // ROL 2 (Mayorista) y ROL 3 (Distribuidor): Filtrar por EstadoDistribuidor
                      <select
                        value={filtros.estadoDistribuidor || ''}
                        onChange={e => setFiltros(prev => ({ ...prev, estadoDistribuidor: e.target.value }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Todos los estados</option>
                        <option value="PREPAGO">PREPAGO</option>
                        <option value="Pendiente de Facturar">Pendiente de Facturar</option>
                        <option value="Facturado">Facturado</option>
                        <option value="Cobrado">Cobrado</option>
                      </select>
                    )}
                  </div>
                </div>
                {/* Tabla */}
                {historialLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>                ) : (
                  <div>
                    <div className="overflow-x-auto">
                      <table>
                        <thead className="bg-gray-50">
                          <tr>
                            {(user?.rol === 1 || user?.rol === 4) && (
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                                <input
                                  type="checkbox"
                                  checked={selectedDownloadIds.size > 0 && selectedDownloadIds.size === historial.filter(d => d.tipoDescarga !== 'PREPAGO').length}
                                  onChange={toggleSelectAll}
                                  className="rounded"
                                  title="Seleccionar todos (excepto PREPAGO)"
                                />
                              </th>
                            )}
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Controlador</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Usuario</th>
                            {user?.rol === 4 && (
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">CUIT</th>
                            )}                            {(user?.rol === 1 || user?.rol === 4 || user?.rol === 5) && (
                              <>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado Mayorista</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha de Facturación</th>
                              </>
                            )}
                            {user?.rol === 2 && (
                              <>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado Mayorista</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado Distribuidor</th>
                              </>
                            )}
                            {user?.rol === 3 && (
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado Distribuidor</th>
                            )}
                            {user?.rol !== 4 && (
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Ultima Creacion</th>
                            )}
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {historial.map((descarga) => {
                            const esUltimo = descarga.controladorId && ultimosPorControlador[descarga.controladorId] === descarga.id;
                            return (
                              <tr key={descarga.id}>                                {(user?.rol === 1 || user?.rol === 4) && (
                                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <input
                                      type="checkbox"
                                      checked={selectedDownloadIds.has(descarga.id) && descarga.tipoDescarga !== 'PREPAGO'}
                                      onChange={() => descarga.tipoDescarga !== 'PREPAGO' && toggleSelectDownload(descarga.id)}
                                      disabled={descarga.tipoDescarga === 'PREPAGO'}
                                      className="rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={descarga.tipoDescarga === 'PREPAGO' ? 'PREPAGO no puede ser seleccionado' : 'Seleccionar para cambio masivo'}
                                    />
                                  </td>
                                )}<td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{descarga.controladorId || descarga.certificadoNombre}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{descarga.usuario ? descarga.usuario.nombre : descarga.usuarioId}</td>
                                {user?.rol === 4 && (
                                  <td className="px-3 py-4 whitespace-nowrap">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full `}>{descarga.usuario?.cuit}</span>
                                  </td>
                                )}                                {(user?.rol === 1 || user?.rol === 4 || user?.rol === 5) && (
                                  <td className="px-3 py-4 whitespace-nowrap">
                                    <div className="space-y-2">
                                      {/* Collapsible row header - ADMIN/FACTURACIÓN/TÉCNICO ven EstadoMayorista */}
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
                                        <div className="pl-6 space-y-2 border-l-2 border-gray-300">                                          {/* Estado change dropdown - Solo para Admin/Facturación, NO para Técnico */}
                                          {(user?.rol === 1 || user?.rol === 4) && (
                                            <div>
                                              {(descarga.usuario?.id_mayorista === 1 && descarga.tipoDescarga === "PREPAGO") ? (
                                                <div className="p-3 bg-red-50 border border-red-200 rounded">
                                                  <p className="text-xs font-semibold text-red-700">
                                                    ⚠️ Distri SERSA - PREPAGO - No modificable
                                                  </p>
                                                  <p className="text-xs text-red-600 mt-1">
                                                    No se puede modificar el estado de descargas para PREPAGO DE SERSA.
                                                  </p>
                                                </div>
                                              ) : (
                                                <>
                                                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                                                    Cambiar Estado:
                                                  </label>
                                                  <select
                                                    onChange={(e) => {
                                                      const nuevoEstado = e.target.value;
                                                      if (nuevoEstado !== descarga.estadoMayorista) {
                                                        handleEstadoChange(descarga.id, nuevoEstado, user.rol, descarga.usuarioId, descarga.tipoDescarga || undefined, descarga.usuario?.id_mayorista);
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
                                          
                                          {/* Mensaje para Técnico */}
                                          {user?.rol === 5 && (
                                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                                              <p className="text-xs font-semibold text-yellow-700">
                                                ℹ️ Técnico - Solo lectura
                                              </p>
                                              <p className="text-xs text-yellow-600 mt-1">
                                                No tienes permisos para cambiar estados de descargas.
                                              </p>
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
                                  </td>
                                )}                                {(user?.rol === 1 || user?.rol === 4 || user?.rol === 5) && (
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{
                                    !descarga.fechaFacturacion
                                      ? 'Sin facturar'
                                      : new Date(descarga.fechaFacturacion).toLocaleDateString()
                                  }</td>
                                )}
                                {user?.rol === 2 && (
                                  <>
                                    <td className="px-3 py-4 whitespace-nowrap">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(descarga.estadoMayorista)}`}>
                                        {descarga.estadoMayorista}
                                      </span>
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(descarga.estadoDistribuidor)}`}>
                                        {descarga.estadoDistribuidor}
                                      </span>
                                    </td>
                                  </>                                )}                                {user?.rol === 3 && (
                                  <td className="px-3 py-4 whitespace-nowrap">
                                    {/* Para Distribuidor SERSA (idMayorista=1): Mostrar estado con datos de facturación */}
                                    {descarga.usuario?.id_mayorista === 1 ? (
                                      <div className="space-y-2">
                                        {/* Collapsible row header - DISTRIBUIDOR SERSA ve EstadoDistribuidor + datos facturación */}
                                        <button
                                          onClick={() => toggleRowExpanded(descarga.id)}
                                          className="flex items-center gap-2 hover:opacity-80"
                                        >
                                          <svg
                                            className={`h-4 w-4 transition-transform ${expandedRows.has(descarga.id) ? 'rotate-90' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(descarga.estadoDistribuidor)}`}>
                                            {descarga.estadoDistribuidor}
                                          </span>
                                        </button>
                                        
                                        {/* Expanded content - Mostrar datos de facturación */}
                                        {expandedRows.has(descarga.id) && (
                                          <div className="pl-6 space-y-2 border-l-2 border-gray-300">
                                            <div className="space-y-1">
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
                                    ) : (
                                      /* Para otros mayoristas: Solo mostrar estado sin expandible */
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(descarga.estadoDistribuidor)}`}>
                                        {descarga.estadoDistribuidor}
                                      </span>
                                    )}
                                  </td>
                                )}
                                {user?.rol !== 4 && (
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {
                                      isNaN(new Date(descarga.updatedAt).getTime())
                                        ? 'Sin fecha'
                                        : new Date(descarga.updatedAt).toLocaleDateString()
                                    }
                                  </td>
                                )}                                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                  {user?.rol === 2 && (
                                    descarga.tipoDescarga === 'PREPAGO' ? (
                                      <span className="text-xs text-red-600 font-semibold">PREPAGO - Inmutable</span>
                                    ) : (
                                      <select
                                        onChange={(e) => {
                                          const nuevoEstado = e.target.value;
                                          if (nuevoEstado !== descarga.estadoDistribuidor) {
                                            handleEstadoChange(descarga.id, nuevoEstado, user.rol, descarga?.usuarioId, descarga.tipoDescarga || undefined);
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
                                  )}                                  {user?.rol !== 2 && user?.rol !== 4 && (
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
                  </div>
                )}
              </div>
            )}
          </div>
        </div>      </div>

      {/* Modal para cambio masivo de estado */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            {!bulkResults ? (
              <>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Cambio de Estado Masivo
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  {validSelectedCount} descarga{validSelectedCount !== 1 ? 's' : ''} seleccionada{validSelectedCount !== 1 ? 's' : ''}
                </p>

                {/* Estado selector */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nuevo Estado *
                  </label>
                  <select
                    value={bulkNuevoEstado}
                    onChange={(e) => {
                      setBulkNuevoEstado(e.target.value);
                      setBulkFacturaData({ numero_factura: '', referencia_pago: '' });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Seleccionar estado...</option>
                    <option value="Pendiente de Facturar">Pendiente de Facturar</option>
                    <option value="Facturado">Facturado</option>
                    <option value="Cobrado">Cobrado</option>
                  </select>
                </div>

                {/* Campo de Número de Factura */}
                {bulkNuevoEstado === 'Facturado' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número de Factura (Opcional)
                    </label>
                    <input
                      type="text"
                      value={bulkFacturaData.numero_factura}
                      onChange={(e) => setBulkFacturaData({ ...bulkFacturaData, numero_factura: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Ej: 2025-001"
                    />
                  </div>
                )}

                {/* Campo de Referencia de Pago */}
                {bulkNuevoEstado === 'Cobrado' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Referencia de Pago (Opcional)
                    </label>
                    <input
                      type="text"
                      value={bulkFacturaData.referencia_pago}
                      onChange={(e) => setBulkFacturaData({ ...bulkFacturaData, referencia_pago: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Ej: REF-123456"
                    />
                  </div>
                )}

                {/* Botones */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      if (bulkLoading) return;
                      setShowBulkModal(false);
                      setBulkNuevoEstado('');
                      setBulkFacturaData({ numero_factura: '', referencia_pago: '' });
                      setBulkResults(null);
                    }}
                    disabled={bulkLoading}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmarCambioMasivo}
                    disabled={bulkLoading || !bulkNuevoEstado}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {bulkLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Procesando ({validSelectedCount})...</span>
                      </>
                    ) : (
                      `Aplicar a ${validSelectedCount} descarga${validSelectedCount !== 1 ? 's' : ''}`
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Resultados del cambio masivo */}
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Resultado del Cambio Masivo
                </h3>

                <div className="space-y-3 mb-6">
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm text-green-800">
                      ✓ <strong>{bulkResults.success}</strong> descarga{bulkResults.success !== 1 ? 's' : ''} actualizada{bulkResults.success !== 1 ? 's' : ''} correctamente
                    </p>
                  </div>

                  {bulkResults.failed > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-800 mb-2">
                        ✗ <strong>{bulkResults.failed}</strong> descarga{bulkResults.failed !== 1 ? 's' : ''} con error{bulkResults.failed !== 1 ? 's' : ''}:
                      </p>
                      <ul className="text-xs text-red-700 space-y-1 ml-4">
                        {bulkResults.errors.map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowBulkModal(false);
                      setBulkNuevoEstado('');
                      setBulkFacturaData({ numero_factura: '', referencia_pago: '' });
                      setBulkResults(null);
                      setSelectedDownloadIds(new Set());
                    }}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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

      {/* ⭐ Modal de confirmación de descarga - Aviso de cobro y límites */}
      {showDownloadConfirmModal && user && metricas && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Confirmar Descarga de Certificado
              </h3>
              <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            {/* Información del certificado */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 mb-2">
                <span className="font-semibold">Certificado:</span> SE{pendingDownloadData?.marca}{pendingDownloadData?.modelo}{pendingDownloadData?.numeroSerie?.toString().padStart(10, '0')}
              </p>
                </div>

            {/* Aviso según tipo de descarga - PREPAGO si tipo_descarga='PREPAGO' O limite_descargas > 0, sino CUENTA_CORRIENTE */}
            {(downloadUserType === 'PREPAGO' ) ? (
              // PREPAGO: Se descuenta del límite disponible
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-purple-800 mb-2">
                  ⚡ Sistema PREPAGO
                </p>
                <p className="text-sm text-purple-700 mb-3">
                  Esta descarga te descontará <strong>1 descarga</strong> de tu límite disponible.
                </p>
                <div className="bg-white rounded p-2 mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Límite actual:</span>
                    <span className="font-semibold text-gray-900">{metricas?.limiteDescargas} descargas</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Después de la descarga:</span>
                    <span className="font-semibold text-indigo-600">{Math.max(0, (metricas?.limiteDescargas || 0) - 1)} descargas</span>
                  </div>
                </div>
              </div>
            ) : (
              // CUENTA_CORRIENTE: Genera una deuda a pagar
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-amber-800 mb-2">
                  💰 Cuenta Corriente - Deuda Pendiente
                </p>
                <p className="text-sm text-amber-700 mb-3">
                  Esta descarga generará un cargo en tu cuenta que deberá ser pagado.
                </p>                <div className="bg-white rounded p-2 mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Descargas pendientes:</span>
                    <span className="font-semibold text-gray-900">{(metricas?.pendienteFacturar || 0)} / {(metricas?.limiteDescargas || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Después de la descarga:</span>
                    <span className={`font-semibold ${(metricas?.pendienteFacturar || 0) + 1 >= (metricas?.limiteDescargas || 0) ? 'text-red-600' : 'text-orange-600'}`}>
                      {(metricas?.pendienteFacturar || 0) + 1} / {(metricas?.limiteDescargas || 0)}
                    </span>
                  </div>
                </div>
                {(metricas?.pendienteFacturar || 0) + 1 >= (metricas?.limiteDescargas || 0) && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                    <p className="text-xs text-red-700 font-semibold">
                      ⚠️ Alcanzarás tu límite de descargas pendientes
                    </p>
                  </div>
                )}
              </div>
            )}            {/* Confirmación */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 mb-3">
                Al descargar el certificado {(user?.tipo_descarga === 'PREPAGO' || (metricas?.limiteDescargas ?? 0) > 0) ? 
                  'se descontará de tu límite disponible' : 
                  'se agregará un cargo a tu cuenta que deberá ser abonado en el próximo período de facturación'}.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="confirmDownload"
                  className="h-4 w-4 rounded border-gray-300"
                  defaultChecked={false}
                  onChange={(e) => setAcceptDownloadConfirm(e.target.checked)}
                />
                <span className="text-sm text-gray-700">
                  Entiendo y acepto proceder con la descarga
                </span>
              </label>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={handleCancelarDescarga}
                disabled={downloadConfirmLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarDescarga}
                disabled={downloadConfirmLoading || !acceptDownloadConfirm}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {downloadConfirmLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Descargando...</span>
                  </>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar Certificado
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}