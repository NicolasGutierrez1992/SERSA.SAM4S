'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, DatePicker, Select, Button, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  authApi,
  auditoriaApi,
  type AuditoriaLog,
  type AuditoriaStatistics,
} from '@/lib/api';
import api from '@/lib/api';

interface UsuarioOption {
  id_usuario: number;
  nombre: string;
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
};

export default function AuditoriaPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [logs, setLogs] = useState<AuditoriaLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<AuditoriaStatistics | null>(null);

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
        setCheckingAccess(false);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

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

  const cargarStats = async () => {
    try {
      const res = await auditoriaApi.getStatistics(filtros.fecha_desde, filtros.fecha_hasta);
      setStats(res);
    } catch (err) {
      console.error('Error cargando estadísticas de auditoría:', err);
    }
  };

  useEffect(() => {
    if (checkingAccess) return;
    cargarLogs(1);
    cargarStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAccess, accion, objetivoTipo, actorId, rango]);

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
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 150 },
  ];

  return (
    <div className="container mx-auto max-w-7xl mt-10 mb-10 px-4">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-8 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Auditoría</h1>
            <p className="text-gray-600 mt-2">Registro de actividad de usuarios en el sistema</p>
          </div>
          <Button onClick={() => router.push('/dashboard')}>Volver al dashboard</Button>
        </div>

        <div className="p-8 space-y-6">
          {/* Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500">Eventos totales</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalAcciones ?? '—'}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500">Página actual</p>
              <p className="text-2xl font-bold text-gray-900">{page} de {Math.max(1, Math.ceil(total / limit))}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500">Resultados filtrados</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <Select
              placeholder="Usuario"
              allowClear
              showSearch
              style={{ width: 220 }}
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
              style={{ width: 180 }}
              value={accion}
              onChange={setAccion}
              options={ACCIONES.map((a) => ({ value: a, label: a }))}
            />
            <Select
              placeholder="Entidad"
              allowClear
              style={{ width: 180 }}
              value={objetivoTipo}
              onChange={setObjetivoTipo}
              options={ENTIDADES.map((e) => ({ value: e, label: e }))}
            />
            <RangePicker value={rango} onChange={(v: any) => setRango(v as [Dayjs, Dayjs] | null)} />
            <Button icon={<ReloadOutlined />} onClick={() => cargarLogs(page)}>
              Actualizar
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
              Exportar CSV
            </Button>
          </div>

          {/* Tabla */}
          <Table
            rowKey="id_auditoria"
            columns={columns}
            dataSource={logs}
            loading={loading}
            pagination={{
              current: page,
              pageSize: limit,
              total,
              onChange: (p: number) => cargarLogs(p),
              showSizeChanger: false,
            }}
          />
        </div>
      </div>
    </div>
  );
}
