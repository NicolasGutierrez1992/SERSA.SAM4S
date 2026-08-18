'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Table, DatePicker, Select, Button, Tabs, Pagination, message } from 'antd';
import { DownloadOutlined, ReloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  authApi,
  auditoriaApi,
  type AuditoriaLog,
  type AuditoriaStatistics,
} from '@/lib/api';
import api from '@/lib/api';
import { BarList, type BarListItem } from '@/components/charts/BarList';
import { AreaTrend } from '@/components/charts/AreaTrend';

interface UsuarioOption {
  id_usuario: number;
  nombre: string;
  cuit: string;
}

interface UsuarioActual {
  nombre: string;
  rol: number;
  cuit: string;
}

const { RangePicker } = DatePicker;

const ACCIONES = ['CREAR', 'ACTUALIZAR', 'ELIMINAR', 'LOGIN', 'LOGIN_FALLIDO', 'LOGOUT', 'DOWNLOAD', 'UPDATE', 'ERROR', 'DESCARGAR'];
const ENTIDADES = ['USER', 'CERTIFICADO', 'DESCARGA', 'NOTIFICACION', 'APP_SETTING', 'COMPRA_PREPAGO', 'CERTIFICADO_MAESTRO'];

const accionColor: Record<string, string> = {
  DOWNLOAD: 'text-indigo-700 bg-indigo-50',
  UPDATE: 'text-amber-700 bg-amber-50',
  ERROR: 'text-red-700 bg-red-50',
  ELIMINAR: 'text-red-700 bg-red-50',
  CREAR: 'text-green-700 bg-green-50',
  LOGIN: 'text-gray-700 bg-gray-100',
  LOGIN_FALLIDO: 'text-red-700 bg-red-50',
  LOGOUT: 'text-gray-700 bg-gray-100',
  ACTUALIZAR: 'text-amber-700 bg-amber-50',
  DESCARGAR: 'text-indigo-700 bg-indigo-50',
};

const accionBarColor: Record<string, string> = {
  DOWNLOAD: 'bg-indigo-500',
  UPDATE: 'bg-amber-500',
  ERROR: 'bg-red-500',
  ELIMINAR: 'bg-red-500',
  CREAR: 'bg-green-500',
  LOGIN: 'bg-gray-400',
  LOGIN_FALLIDO: 'bg-red-500',
  LOGOUT: 'bg-gray-400',
  ACTUALIZAR: 'bg-amber-500',
  DESCARGAR: 'bg-indigo-500',
};

const getRoleName = (rol?: number) => {
  switch (rol) {
    case 1: return 'Administrador';
    case 2: return 'Mayorista';
    case 3: return 'Distribuidor';
    case 4: return 'Facturación';
    case 5: return 'Técnico';
    default: return 'Usuario';
  }
};

export default function AuditoriaPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [currentUser, setCurrentUser] = useState<UsuarioActual | null>(null);

  const [logs, setLogs] = useState<AuditoriaLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<AuditoriaStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [rangoMetricas, setRangoMetricas] = useState<[Dayjs, Dayjs] | null>(null);

  const [accion, setAccion] = useState<string | undefined>();
  const [objetivoTipo, setObjetivoTipo] = useState<string | undefined>();
  const [actorId, setActorId] = useState<number | undefined>();
  const [rango, setRango] = useState<[Dayjs, Dayjs] | null>(null);

  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);

  useEffect(() => {
    authApi
      .me()
      .then((userData: any) => {
        if (userData.rol !== 1) {
          router.replace('/dashboard');
          return;
        }
        setCurrentUser({ nombre: userData.nombre, rol: userData.rol, cuit: userData.cuit });
        setCheckingAccess(false);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  const handleLogout = () => {
    authApi.logout();
  };

  useEffect(() => {
    if (checkingAccess) return;
    api.get('/users', { params: { limit: 1000 } })
      .then((res) => setUsuarios(res.data?.data ?? []))
      .catch((err) => console.error('Error cargando usuarios para el filtro:', err));
  }, [checkingAccess]);

  const filtros = {
    accion,
    objetivo_tipo: objetivoTipo,
    actor_id: actorId,
    fecha_desde: rango ? rango[0].format('YYYY-MM-DD') : undefined,
    fecha_hasta: rango ? rango[1].format('YYYY-MM-DD') : undefined,
  };

  const cargarLogs = async (pageToLoad = page) => {
    setLoading(true);
    try {
      const res = await auditoriaApi.getAll({ ...filtros, page: pageToLoad, limit });
      setLogs(res.data);
      setTotal(res.total);
      setPage(pageToLoad);
    } catch (err) {
      console.error('Error cargando auditoría:', err);
      message.error('Error al cargar el registro de auditoría');
    } finally {
      setLoading(false);
    }
  };

  const cargarStats = async (rangoActual: [Dayjs, Dayjs] | null) => {
    setStatsLoading(true);
    try {
      const fechaDesde = rangoActual ? rangoActual[0].format('YYYY-MM-DD') : undefined;
      const fechaHasta = rangoActual ? rangoActual[1].format('YYYY-MM-DD') : undefined;
      const res = await auditoriaApi.getStatistics(fechaDesde, fechaHasta);
      setStats(res);
    } catch (err) {
      console.error('Error cargando estadísticas de auditoría:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (checkingAccess) return;
    cargarLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAccess, accion, objetivoTipo, actorId, rango]);

  useEffect(() => {
    if (checkingAccess) return;
    cargarStats(rangoMetricas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAccess, rangoMetricas]);

  const handleExportCsv = async () => {
    try {
      const blob = await auditoriaApi.exportCsv({ ...filtros, limit: 10000 });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auditoria-${dayjs().format('YYYY-MM-DD')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando CSV:', err);
      message.error('Error al exportar el CSV');
    }
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const columns = [
    {
      title: 'Fecha',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm:ss'),
    },
    {
      title: 'Usuario',
      key: 'usuario',
      render: (_: unknown, record: AuditoriaLog) => record.actor?.nombre || `Usuario #${record.actor_id ?? '?'}`,
    },
    {
      title: 'Acción',
      dataIndex: 'accion',
      key: 'accion',
      width: 120,
      render: (v: string) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${accionColor[v] || 'text-gray-700 bg-gray-100'}`}>
          {v}
        </span>
      ),
    },
    { title: 'Entidad', dataIndex: 'objetivo_tipo', key: 'objetivo_tipo', width: 130 },
    {
      title: 'Entidad ID',
      key: 'objetivo_id',
      ellipsis: true,
      render: (_: unknown, record: AuditoriaLog) => record.objetivo_referencia || record.objetivo_id || '—',
    },
    {
      title: 'Descripción',
      dataIndex: 'descripcion',
      key: 'descripcion',
      ellipsis: true,
    },
  ];

  // ─── Datos derivados para Métricas ───────────────────────────────────────
  const accionesBarItems: BarListItem[] = (stats?.accionesPorTipo ?? []).map((a) => ({
    key: a.accion,
    label: a.accion,
    value: a.total,
    barClassName: accionBarColor[a.accion],
  }));

  const entidadesBarItems: BarListItem[] = (stats?.entidadesPorTipo ?? []).map((e) => ({
    key: e.objetivo_tipo,
    label: e.objetivo_tipo,
    value: e.total,
  }));

  const usuariosBarItems: BarListItem[] = (stats?.usuariosActivos ?? []).map((u) => ({
    key: String(u.actor_id),
    label: u.nombre,
    value: u.total,
  }));

  const actividadPoints = (stats?.actividadPorDia ?? []).map((d) => ({
    label: dayjs(d.fecha).format('DD/MM'),
    fullLabel: dayjs(d.fecha).format('dddd DD/MM/YYYY'),
    value: d.total,
  }));

  const erroresTotal = stats?.accionesPorTipo.find((a) => a.accion === 'ERROR')?.total ?? 0;

  const historialTabContent = (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs sm:text-sm text-gray-500">Resultados encontrados</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs sm:text-sm text-gray-500">Página</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{page} / {Math.max(1, Math.ceil(total / limit))}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2.5">
        <Select
          placeholder="Usuario"
          allowClear
          showSearch
          className="w-full sm:w-[220px]"
          value={actorId}
          onChange={setActorId}
          filterOption={(input: string, option: any) =>
            (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={usuarios.map((u) => ({
            value: u.id_usuario,
            label: `${u.nombre} (${u.cuit})`,
          }))}
        />
        <Select
          placeholder="Acción"
          allowClear
          className="w-full sm:w-[160px]"
          value={accion}
          onChange={setAccion}
          options={ACCIONES.map((a) => ({ value: a, label: a }))}
        />
        <Select
          placeholder="Entidad"
          allowClear
          className="w-full sm:w-[180px]"
          value={objetivoTipo}
          onChange={setObjetivoTipo}
          options={ENTIDADES.map((e) => ({ value: e, label: e }))}
        />
        <RangePicker
          value={rango}
          onChange={(v: any) => setRango(v as [Dayjs, Dayjs] | null)}
          className="w-full sm:w-auto"
        />
        <div className="flex gap-2 w-full sm:w-auto">
          <Button icon={<ReloadOutlined />} onClick={() => cargarLogs(page)} className="flex-1 sm:flex-none">
            Actualizar
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportCsv} className="flex-1 sm:flex-none">
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Tabla — desktop */}
      <div className="hidden sm:block">
        <Table
          rowKey="id_auditoria"
          columns={columns}
          dataSource={logs}
          loading={loading}
          scroll={{ x: true }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            onChange: (p: number) => cargarLogs(p),
            showSizeChanger: false,
          }}
        />
      </div>

      {/* Tarjetas — móvil */}
      <div className="sm:hidden">
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
          {loading && (
            <div className="p-6 text-center text-sm text-gray-400">Cargando…</div>
          )}
          {!loading && logs.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">Sin eventos para estos filtros</div>
          )}
          {!loading && logs.map((log) => (
            <div key={log.id_auditoria} className="p-3.5 bg-white">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${accionColor[log.accion] || 'text-gray-700 bg-gray-100'}`}>
                  {log.accion}
                </span>
                <span className="text-xs text-gray-400 tabular-nums">{dayjs(log.timestamp).format('DD/MM HH:mm')}</span>
              </div>
              <p className="text-sm font-medium text-gray-900 truncate">
                {log.actor?.nombre || `Usuario #${log.actor_id ?? '?'}`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {log.objetivo_tipo}
                {(log.objetivo_referencia || log.objetivo_id) && ` · ${log.objetivo_referencia || log.objetivo_id}`}
              </p>
              {log.descripcion && <p className="text-xs text-gray-400 mt-1">{log.descripcion}</p>}
            </div>
          ))}
        </div>
        {total > limit && (
          <div className="flex justify-center mt-4">
            <Pagination
              simple
              current={page}
              pageSize={limit}
              total={total}
              onChange={(p: number) => cargarLogs(p)}
            />
          </div>
        )}
      </div>
    </div>
  );

  const metricasTabContent = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {rangoMetricas ? 'Período seleccionado' : 'Todo el historial disponible'}
        </p>
        <RangePicker
          value={rangoMetricas}
          onChange={(v: any) => setRangoMetricas(v as [Dayjs, Dayjs] | null)}
          className="w-full sm:w-auto"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs sm:text-sm text-gray-500">Eventos totales</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats?.totalAcciones ?? '—'}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs sm:text-sm text-gray-500">Errores</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{erroresTotal}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs sm:text-sm text-gray-500">Usuarios activos</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats?.usuariosActivos.length ?? '—'}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs sm:text-sm text-gray-500">Días con actividad</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats?.actividadPorDia.length ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Actividad diaria</h3>
          {statsLoading ? (
            <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">Cargando…</div>
          ) : (
            <AreaTrend data={actividadPoints} />
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Eventos por acción</h3>
          {statsLoading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Cargando…</p>
          ) : (
            <BarList items={accionesBarItems} />
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Eventos por entidad</h3>
          {statsLoading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Cargando…</p>
          ) : (
            <BarList items={entidadesBarItems} />
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Usuarios más activos</h3>
          {statsLoading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Cargando…</p>
          ) : (
            <BarList items={usuariosBarItems} />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center py-4 gap-y-2">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="mr-4 p-2 rounded-md hover:bg-gray-100"
                aria-label="Volver al dashboard"
              >
                <ArrowLeftOutlined />
              </button>
              <Image
                src="/assets/images/logo.SERSA.jpg"
                alt="SERSA Logo"
                width={80}
                height={40}
                className="h-6 w-auto mr-3"
              />
              <div>
                <h1 className="text-base sm:text-xl font-bold text-gray-900">Auditoría</h1>
                <p className="text-sm text-gray-600 hidden sm:block">Registro de actividad del sistema</p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[120px] sm:max-w-none">
                  {currentUser?.nombre}
                </p>
                <p className="text-xs text-gray-500 hidden sm:block">
                  {getRoleName(currentUser?.rol)} • CUIT: {currentUser?.cuit}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-2 sm:px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <Tabs
            defaultActiveKey="historial"
            items={[
              { key: 'historial', label: 'Historial', children: historialTabContent },
              { key: 'metricas', label: 'Métricas', children: metricasTabContent },
            ]}
          />
        </div>
      </main>
    </div>
  );
}
