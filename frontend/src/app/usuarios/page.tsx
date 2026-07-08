'use client';
import { useEffect, useState } from 'react';
import api, { getUser, type CompraPrepago } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Table, Input, Spin,  Modal, Button, Form, Select, message } from 'antd';
import Image from 'next/image';
import { EditOutlined, ReloadOutlined, DownloadOutlined, DollarOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';

const getCurrentUser = () => getUser();

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [jerarquia, setJerarquia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [form] = Form.useForm();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Estado para compras prepago (Mayorista/Distribuidor/Facturación)
  const [comprasPrepago, setComprasPrepago] = useState<CompraPrepago[]>([]);
  const [comprasLoading, setComprasLoading] = useState(false);
  const [nuevaCompra, setNuevaCompra] = useState({ cantidad: '', numero_factura: '' });
  const [editingFacturaId, setEditingFacturaId] = useState<number | null>(null);
  const [editingFacturaValue, setEditingFacturaValue] = useState('');

  // Estado del modal unificado "Gestionar Créditos" (límite de cuenta corriente + compras prepago)
  const [creditosUser, setCreditosUser] = useState<any | null>(null);
  const [creditosLimiteValue, setCreditosLimiteValue] = useState('');
  const [creditosLoading, setCreditosLoading] = useState(false);
  // El límite de cuenta corriente no aplica a Admin (1) ni Mayorista (2)
  const mostrarLimiteCuentaCorriente = creditosUser && ![1, 2].includes(creditosUser.rol);
  // Mayorista (2), Distribuidor (3) y Facturación (4) pueden recibir compras prepago
  const mostrarComprasPrepago = creditosUser && [2, 3, 4].includes(creditosUser.rol);

  const fetchComprasPrepago = async (userId: number) => {
    setComprasLoading(true);
    try {
      const res = await api.get(`/users/${userId}/compras-prepago`);
      setComprasPrepago(res.data || []);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al cargar compras prepago');
    } finally {
      setComprasLoading(false);
    }
  };

  const openGestionarCreditos = (record: any) => {
    setCreditosUser(record);
    setCreditosLimiteValue(String(record.limite_descargas ?? 0));
    setComprasPrepago([]);
    setNuevaCompra({ cantidad: '', numero_factura: '' });
    if ([2, 3, 4].includes(record.rol)) {
      fetchComprasPrepago(record.id_usuario);
    }
  };

  const handleGuardarCreditos = async () => {
    if (!creditosUser) return;
    if (![1, 2].includes(creditosUser.rol)) {
      const limiteDescargas = Number(creditosLimiteValue);
      if (isNaN(limiteDescargas) || limiteDescargas < 0) {
        message.error('Ingrese un límite válido');
        return;
      }
      setCreditosLoading(true);
      try {
        await api.patch(`/users/${creditosUser.id_usuario}`, { limiteDescargas });
        message.success('Límite de cuenta corriente actualizado');
        const res = await api.get('/users');
        setUsuarios(res.data.data || []);
      } catch (err: any) {
        message.error(err?.response?.data?.message || 'Error al actualizar el límite');
        return;
      } finally {
        setCreditosLoading(false);
      }
    }
    setCreditosUser(null);
  };

  const handleAgregarCompra = async () => {
    if (!creditosUser) return;
    const cantidad = Number(nuevaCompra.cantidad);
    if (!cantidad || cantidad <= 0) {
      message.error('Ingrese una cantidad válida');
      return;
    }
    try {
      await api.post(`/users/${creditosUser.id_usuario}/compras-prepago`, {
        cantidad,
        numero_factura: nuevaCompra.numero_factura || undefined,
      });
      message.success('Compra cargada');
      setNuevaCompra({ cantidad: '', numero_factura: '' });
      await fetchComprasPrepago(creditosUser.id_usuario);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al cargar la compra');
    }
  };

  const handleGuardarFactura = async (compraId: number) => {
    if (!creditosUser) return;
    try {
      await api.patch(`/users/${creditosUser.id_usuario}/compras-prepago/${compraId}`, {
        numero_factura: editingFacturaValue || null,
      });
      message.success('Factura actualizada');
      setEditingFacturaId(null);
      await fetchComprasPrepago(creditosUser.id_usuario);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al actualizar la factura');
    }
  };

  const { Search } = Input;

  const currentUser = getCurrentUser();  const isMayorista = currentUser?.rol === 2;
  const idMayorista = currentUser?.id_mayorista || null;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await api.get('/users');
        setUsuarios(res.data.data || []);
        //setJerarquia(res.data.jerarquia || []);
      } catch (err: any) {
        console.error('[UsuariosPage] Error al cargar usuarios:', err);
        if (err?.response?.status === 403) {
          message.error('No tienes permisos para acceder a esta sección.');
        } else {
          message.error(err?.response?.data?.message || 'Error al cargar usuarios');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);
  // funcion para agregar un nuevo usuario
  const openAddUser = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ password: 'certificados' });
    // Si es mayorista, setear id_mayorista automáticamente
    if (isMayorista) {
      form.setFieldsValue({ rol: 3, id_mayorista: idMayorista });
    }
    // Si es técnico, setear id_mayorista = 1 automáticamente
    if (currentUser?.rol === 5) {
      form.setFieldsValue({ id_mayorista: 1 });
    }
    setModalVisible(true);
  };// Mapea los campos del usuario a los nombres esperados por el formulario
  const mapUserToForm = (user: any) => ({
    nombre: user.nombre,
    email: user.mail,
    cuit: user.cuit,
    rol: user.rol,
    status: user.status,
    id_mayorista: user.id_mayorista,
    celular: user.celular,
    notification_limit: user.notification_limit !== null && user.notification_limit !== undefined ? user.notification_limit : 100,
  });
  const openEditUser = async (user: any) => {
    try {
      // ⭐ Llamar al GET endpoint para validar permisos
      const response = await api.get(`/users/${user.id_usuario}`);
      const userData = response.data;

      // Validar que pueda editar
      if (!userData.canEdit) {
        message.error('No tienes permisos para editar este usuario');
        return;
      }

      setEditingUser(userData);
      form.setFieldsValue(mapUserToForm(userData));
      setModalVisible(true);
    } catch (err: any) {
      console.error('Error al validar permisos:', err);
      const serverMsg = err?.response?.data?.message;
      if (serverMsg) {
        message.error(Array.isArray(serverMsg) ? serverMsg.join(' | ') : serverMsg);
      } else {
        message.error('No tienes permisos para editar este usuario');
      }
    }
  };

  // Validaciones frontend para crear usuario
  const validateUserForm = (values: any) => {
    if (!/^\d{11}$/.test(values.cuit)) {
      return 'El CUIT debe tener 11 dígitos numéricos';
    }
    if (!editingUser && (!values.password || values.password.length < 6)) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }
    if (values.rol === 3 && !values.id_mayorista) {
      return 'Los distribuidores deben tener un mayorista asociado';
    }
    if (values.celular && !/^\d{10,15}$/.test(values.celular)) {
      return 'El número de celular debe tener entre 10 y 15 dígitos';
    }
    return null;
  };
  //guarda los cambios del modal o crea un nuevo usuario
  const handleModalOk = async () => {
    try {
      console.log('Valores del formulario antes de la validación:', form.getFieldsValue());
      const values = await form.validateFields();
      console.log('Valores del formulario después de la validación:', values);
      // Validación extra frontend
      const error = validateUserForm(values);
      console.log('Error de validación:', error);

      if (error) {
        message.error(error);
        return;
      }

      console.log('Valores validados para enviar al backend:', values);
      console.log('Usuario en edición:', editingUser);
      if (editingUser) {
        // ⭐ Filtrar campos según el rol
        let dataToSend: any = {};

        if (isMayorista) {
          // El Mayorista ya no edita nada desde este formulario (el límite/compras
          // se gestionan desde el modal "Gestionar Créditos"); no hay campos propios.
          dataToSend = {};
          console.log('[Mayorista Edit] Sin campos editables desde este formulario');
        } else if (currentUser?.rol === 5) {
          // Técnico editando: puede editar todo EXCEPTO rol y notification_limit
          const { rol, notification_limit, ...dataSinRol } = values;
          dataToSend = dataSinRol;
          console.log('[Técnico Edit] Campos filtrados (sin rol/notification_limit):', dataToSend);
        } else if (!isMayorista && editingUser.rol === 2) {
          // Admin editando Mayorista
          dataToSend = {
            nombre: values.nombre,
            email: values.email,
            celular: values.celular,
            notification_limit: values.notification_limit,
            status: values.status,
          };
          console.log('[Admin Edit Mayorista] Campos permitidos:', dataToSend);
        } else {
          // Admin editando otros usuarios: todos los campos
          dataToSend = values;
          console.log('[Admin Edit User] Todos los campos:', dataToSend);
        }

        // Lógica para editar usuario
        await api.patch(`/users/${editingUser.id_usuario}`, dataToSend);
        message.success('Usuario actualizado');
      } else {
        // Lógica para crear usuario
        
        if (isMayorista) {
          values.rol = 3;
          values.id_mayorista = idMayorista;
        }
        // Si es técnico, asegurar id_mayorista = 1
        if (currentUser?.rol === 5) {
          values.id_mayorista = 1;
        }
        await api.post('/users', values);
        message.success('Usuario creado');
        // Abrir WhatsApp Web con mensaje de alta
        const celular = values.celular?.replace(/[^\d]/g, '');
        const password = values.password;
        const cuit = values.cuit;
        if (celular && password) {
          // Ajusta el código de país según corresponda (ejemplo: 54 para Argentina)
          const numeroCompleto = celular.startsWith('54') ? celular : `54${celular}`;
          const mensaje = encodeURIComponent(
              `Bienvenido/a al sistema de gestión de Certificados de SERSA
              
              Tu usuario fue dado de alta correctamente.
              Usuario: ${cuit}
              Contraseña: ${password}
              
              link de acceso: https://sersa-certs-frontend.vercel.app/

              Si necesitas ayuda, estamos aquí para ayudarte`
            );

            const url = `https://wa.me/${numeroCompleto}?text=${mensaje}`;
            window.open(url, '_blank');

        }
      }      setModalVisible(false);
      form.resetFields();
      // Refrescar lista de usuarios
      try {
        const res = await api.get('/users');
        const nuevosUsuarios = res.data.data || res.data || [];
        console.log('[Refrescando tabla] Nuevos usuarios:', nuevosUsuarios);
        setUsuarios(nuevosUsuarios);
        setJerarquia(res.data.jerarquia || []);
      } catch (err) {
        console.error('[Error refrescando usuarios]:', err);
      }
    } catch (err: any) {
      // form.validateFields() rechaza con { errorFields } — Ant Design ya muestra los errores en el form
      if (err?.errorFields) return;

      const serverMsg = err?.response?.data?.message;
      if (serverMsg) {
        // NestJS puede devolver message como array (errores de validación DTO)
        message.error(Array.isArray(serverMsg) ? serverMsg.join(' | ') : serverMsg);
      } else {
        message.error('Error al guardar usuario');
      }
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    form.resetFields();
  };

  // Mapeo fijo de mayoristas
  const MAYORISTAS_MAP: Record<number, string> = {
    1: 'SERSA',
    2: 'OLICART',
    3: 'MARINUCCI',
    4: 'COLOMA',
    5: 'SANTICH',
  };
  const columns = [
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_: any, record: any) => (
        <>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditUser(record)}
            title="Editar usuario"
          />
          {[2, 3, 4].includes(record.rol) && (
            <Button
              type="link"
              icon={<DollarOutlined />}
              onClick={() => openGestionarCreditos(record)}
              title="Gestionar créditos"
            />
          )}
          <Button
            type="link"
            icon={<ReloadOutlined />}
            style={{ color: '#eab308' }}
            onClick={() => handleResetPassword(record)}
            title={isMayorista ? "Solicitar a administrador" : "Resetear contraseña"}
            disabled={isMayorista}
          />
        </>
      )
    },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre', sorter: (a: any, b: any) => a.nombre.localeCompare(b.nombre) },
    { title: 'Email', dataIndex: 'mail', key: 'mail', sorter: (a: any, b: any) => a.mail.localeCompare(b.mail) },
    { title: 'CUIT', dataIndex: 'cuit', key: 'cuit', sorter: (a: any, b: any) => a.cuit.localeCompare(b.cuit) },
    { title: 'Rol', dataIndex: 'rol', key: 'rol', render: (rol: number) => rol === 1 ? 'Admin' : rol === 2 ? 'Mayorista' : rol === 3 ? 'Distribuidor' : rol === 4 ? 'Facturación' : rol === 5 ? 'Técnico' : 'Usuario' },
    { title: 'Estado', dataIndex: 'status', key: 'status', render: (s: number) => s === 1 ? 'Activo' : s === 2 ? 'Suspendido' : 'Inactivo', sorter: (a: any, b: any) => a.status - b.status },
    {
      title: 'Mayorista',
      dataIndex: 'id_mayorista',
      key: 'id_mayorista',
      render: (id: number) => MAYORISTAS_MAP[id] || '-',
    },
    { title: 'Límite Cuenta Corriente', dataIndex: 'limite_descargas', key: 'limite_descargas', sorter: (a: any, b: any) => a.limite_descargas - b.limite_descargas },
    { title: 'Saldo Prepago', dataIndex: 'saldoPrepago', key: 'saldoPrepago', sorter: (a: any, b: any) => (a.saldoPrepago ?? 0) - (b.saldoPrepago ?? 0), render: (saldo: number) => saldo ?? 0 },
    ...(currentUser?.rol === 1 ? [{
      title: 'Límite Notificación',
      dataIndex: 'notification_limit',
      key: 'notification_limit',
      render: (limit: number, record: any) => {
        // Solo mostrar para mayoristas (rol=2)
        if (record.rol !== 2) return '-';
        // Si no hay valor, mostrar 100 (default)
        const displayValue = limit !== null && limit !== undefined ? limit : 100;
        return <span style={{ fontWeight: 500, color: '#0ea5e9' }}>{displayValue}</span>;
      }
    }] : []),
  //  { title: 'Último Login', dataIndex: 'ultimo_login', key: 'ultimo_login', sorter: (a: any, b: any) => (a.ultimo_login || '').localeCompare(b.ultimo_login || '') },
  ];

  // Función para resetear contraseña
  const handleResetPassword = async (user: any) => {
    try {
      await api.patch(`/users/${user.id_usuario}/reset-password`);
      message.success('Contraseña reseteada.');
      //enviar whatsapp al usuario informando el reseteo de contraseña directamente desde el front
       if (user.celular) {
          // Ajusta el código de país según corresponda (ejemplo: 54 para Argentina)
          const numeroCompleto = user.celular.startsWith('54') ? user.celular : `54${user.celular}`;
          const mensaje = encodeURIComponent(
              `Bienvenido/a al sistema de gestión de Certificados de SERSA

              Tu contraseña fue reseteada correctamente
              Usuario: ${user.cuit}
              Contraseña: certificados

              link de acceso: https://sersa-certs-frontend.vercel.app/

              Si necesitas ayuda, estamos aquí para ayudarte`
            );

            const url = `https://wa.me/${numeroCompleto}?text=${mensaje}`;
            window.open(url, '_blank');

        }
    } catch (err) {
      message.error('No se pudo resetear la contraseña');
    }
  };

  // Filtro simple por nombre/email/cuit
  const filtered = usuarios.filter(u =>
    u.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    u.mail?.toLowerCase().includes(search.toLowerCase()) ||
    u.cuit?.toLowerCase().includes(search.toLowerCase())
  );

  const exportarExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Usuarios');
    sheet.columns = [
      { header: 'CUIT', key: 'cuit', width: 20 },
      { header: 'Razón Social', key: 'nombre', width: 30 },
      { header: 'Mail', key: 'mail', width: 30 },
      { header: 'Teléfono', key: 'celular', width: 20 },
    ];
    filtered.forEach(u => {
      sheet.addRow({ cuit: u.cuit, nombre: u.nombre, mail: u.mail, celular: u.celular || '' });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usuarios.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Obtener nombre del rol
  const getRoleName = (rol: number) => {
    switch (rol) {
      case 1: return 'Administrador';
      case 2: return 'Mayorista';
      case 3: return 'Distribuidor';
      case 4: return 'Facturación';
      case 5: return 'Técnico';
      default: return 'Usuario';
    }
  };
  // Armar datos para el árbol
  const treeData = jerarquia.map((mayorista: any) => ({
    title: mayorista.nombre,
    key: mayorista.id_usuario,
    children: (mayorista.distribuidores || []).map((d: any) => ({
      title: d.nombre + ' (Distribuidor)',
      key: d.id_usuario
    }))
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                disabled={currentUser?.rol === 3}
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
                {mounted && (
                  <>
                    <p className="text-sm font-medium text-gray-900">
                      {currentUser?.nombre}
                    </p>
                    <p className="text-xs text-gray-500">
                      {currentUser?.rol != null ? getRoleName(currentUser.rol) : ''} • CUIT: {currentUser?.cuit}
                    </p>
                  </>
                )}
                
              </div>
              <Button
                icon={<DownloadOutlined />}
                onClick={exportarExcel}
                disabled={filtered.length === 0}
              >
                Exportar Excel
              </Button>
              {!isMayorista && (
                <Button
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={openAddUser}
                >
                  Agregar Usuario
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="w-full mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6 p-6">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <Search
                placeholder="Buscar por nombre, email o CUIT"
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                style={{ maxWidth: 300 }}
              />
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-40"><Spin /></div>
            ) : (
              <>
                <Table
                  columns={columns}
                  dataSource={filtered}
                  rowKey="id_usuario"
                  pagination={{ pageSize: 50 }}
                  className="mb-8"
                  scroll={{ x: 'max-content' }}
                />
                {/* Modal para agregar/editar usuario */}                <Modal
                  title={editingUser ? 'Editar usuario' : 'Agregar usuario'}
                  open={modalVisible}
                  onOk={handleModalOk}
                  onCancel={handleModalCancel}
                  okText={<span style={{ color: '#fff' }}>Guardar</span>}
                  cancelText={<span style={{ color: '#fff' }}>Cancelar</span>}
                  okButtonProps={{ style: { background: '#6366f1', borderColor: '#6366f1', color: '#fff' }, className: 'hover:bg-indigo-700 hover:border-indigo-700' }}
                  cancelButtonProps={{ style: { background: '#6366f1', borderColor: '#6366f1', color: '#fff' }, className: 'hover:bg-indigo-700 hover:border-indigo-700' }}
                  destroyOnClose
                >                  {/* ⭐ Mostrar info si es mayorista editando */}
                  {isMayorista && editingUser && (
                    <div style={{
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #0ea5e9',
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '16px'
                    }}>
                      <p style={{ margin: 0, fontSize: '14px', color: '#0369a1', fontWeight: 500 }}>
                        ℹ️ El límite de cuenta corriente y las compras prepago se gestionan desde el ícono &quot;Gestionar Créditos&quot; de la tabla.
                      </p>
                    </div>
                  )}
                  {/* ⭐ Mostrar info si es técnico editando */}
                  {currentUser?.rol === 5 && editingUser && (
                    <div style={{ 
                      backgroundColor: '#fef3c7', 
                      border: '1px solid #f59e0b', 
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '16px'
                    }}>
                      <p style={{ margin: 0, fontSize: '14px', color: '#b45309', fontWeight: 500 }}>
                        ℹ️ Como técnico, no puedes cambiar el rol de los usuarios
                      </p>
                    </div>
                  )}<Form
                    form={form}
                    layout="vertical"
                    initialValues={editingUser || { status: 1, id_rol: 3, notification_limit: 100 }}
                  >
                    <Form.Item name="cuit" label="CUIT" rules={[{ required: true, message: 'Ingrese el CUIT' }]}>
                      <Input disabled={isMayorista} />
                    </Form.Item>
                    <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Ingrese el nombre' }]}>
                      <Input disabled={isMayorista} />
                    </Form.Item>
                    <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Ingrese el email' }]}>
                      <Input type="email" disabled={isMayorista} />
                    </Form.Item>
                    <Form.Item name="celular" label="Celular" rules={[{ required: !editingUser, message: 'Ingrese el número de celular' }]}>
                      <Input type="tel" disabled={isMayorista} />
                    </Form.Item>                    <Form.Item name="rol" label="Rol" rules={[{ required: true }]}>
                      <Select 
                        disabled={isMayorista || (currentUser?.rol === 5 && editingUser)}
                        options={isMayorista 
                          ? [{ value: 3, label: 'Distribuidor' }]
                          : !editingUser && (currentUser?.rol === 1 || currentUser?.rol === 5)
                          ? currentUser?.rol === 1
                          ? [
                              // Admin puede crear cualquier rol incluyendo otro Admin y Facturación
                              { value: 1, label: 'Administrador' },
                              { value: 2, label: 'Mayorista' },
                              { value: 3, label: 'Distribuidor' },
                              { value: 4, label: 'Facturación' },
                              { value: 5, label: 'Técnico' }
                            ]
                          : [
                              // Técnico solo puede crear Mayorista, Distribuidor, Técnico
                              { value: 2, label: 'Mayorista' },
                              { value: 3, label: 'Distribuidor' },
                              { value: 5, label: 'Técnico' }
                            ]
                          : [
                              // Al editar usuario o si eres otro rol: mostrar todos (excepto si eres mayorista)
                              { value: 1, label: 'Admin' },
                              { value: 2, label: 'Mayorista' },
                              { value: 3, label: 'Distribuidor' },
                              { value: 4, label: 'Facturación' },
                              { value: 5, label: 'Técnico' }
                            ]
                        }
                      />
                    </Form.Item>
                    <Form.Item name="status" label="Estado" rules={[{ required: true }]}>
                      <Select 
                        disabled={isMayorista}
                        options={[
                          { value: 1, label: 'Activo' },
                          { value: 2, label: 'Suspendido' },
                          { value: 3, label: 'Inactivo' }
                        ]}
                      />
                    </Form.Item>
                      <Form.Item name="id_mayorista" label="Mayorista">
                      <Select 
                        disabled={isMayorista} 
                        allowClear 
                        placeholder="Seleccionar mayorista"
                        options={isMayorista 
                          ? [{ value: currentUser?.id_mayorista, label: currentUser?.nombre }]
                          : [
                              { value: 1, label: 'SERSA' },
                              { value: 2, label: 'OLICART' },
                              { value: 3, label: 'MARINUCCI' },
                              { value: 4, label: 'COLOMA' },
                              { value: 5, label: 'SANTICH' }
                            ]
                        }
                      />
                    </Form.Item>

                    {/* ⭐ Campo notification_limit: Solo Admin puede verlo y editarlo, solo para Mayoristas */}
                    {!isMayorista && (editingUser?.rol === 2 || form.getFieldValue('rol') === 2) && (
                      <Form.Item 
                        name="notification_limit" 
                        label="Límite para notificación de descargas pendientes"
                        tooltip="Cuando las descargas pendientes del mayorista superan este valor, se envía un email a facturación"
                        rules={[
                          { required: true, message: 'Ingrese el límite de notificación' },
                          { 
                            pattern: /^\d+$/, 
                            message: 'Debe ser un número entero' 
                          }
                        ]}
                      >
                        <Input 
                          type="number" 
                          min={1} 
                          max={10000} 
                          placeholder="Ej: 100, 150, 200"
                        />
                      </Form.Item>
                    )}
                    
                    {/* Solo mostrar password al crear */}
                    {!editingUser && (
                      <Form.Item name="password" label="Contraseña" rules={[{ required: true, message: 'Ingrese la contraseña' }]}>
                        <Input.Password disabled={isMayorista} />
                      </Form.Item>
                    )}
                  </Form>
                </Modal>
              </>
            )}
            <Modal
              title="Gestionar Créditos"
              open={!!creditosUser}
              onCancel={() => setCreditosUser(null)}
              onOk={handleGuardarCreditos}
              confirmLoading={creditosLoading}
              okText="Guardar"
            >
              {creditosUser && (
                <div>
                  <p style={{ marginBottom: 12 }}>
                    Usuario: <strong>{creditosUser.nombre}</strong>
                  </p>

                  {mostrarLimiteCuentaCorriente && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontWeight: 600, marginBottom: 4 }}>Límite de Cuenta Corriente</p>
                      <Input
                        type="number"
                        min={0}
                        value={creditosLimiteValue}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreditosLimiteValue(e.target.value)}
                      />
                    </div>
                  )}

                  {mostrarComprasPrepago && (
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: 8 }}>Compras Prepago</p>
                      {comprasLoading ? (
                        <Spin size="small" />
                      ) : (
                        <table style={{ width: '100%', fontSize: 12, marginBottom: 8, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left' }}>Fecha</th>
                              <th style={{ textAlign: 'left' }}>Factura</th>
                              <th style={{ textAlign: 'right' }}>Cant.</th>
                              <th style={{ textAlign: 'right' }}>Usadas</th>
                              <th style={{ textAlign: 'right' }}>Disp.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comprasPrepago.map(c => (
                              <tr key={c.id}>
                                <td>{new Date(c.fecha_compra).toLocaleDateString()}</td>
                                <td>
                                  {editingFacturaId === c.id ? (
                                    <Input
                                      size="small"
                                      value={editingFacturaValue}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingFacturaValue(e.target.value)}
                                      onPressEnter={() => handleGuardarFactura(c.id)}
                                      onBlur={() => handleGuardarFactura(c.id)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      onClick={() => { setEditingFacturaId(c.id); setEditingFacturaValue(c.numero_factura || ''); }}
                                      style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                                    >
                                      {c.numero_factura || '(sin factura)'}
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>{c.cantidad}</td>
                                <td style={{ textAlign: 'right' }}>{c.cantidad_usada}</td>
                                <td style={{ textAlign: 'right' }}>{c.disponible}</td>
                              </tr>
                            ))}
                            {comprasPrepago.length === 0 && (
                              <tr><td colSpan={5} style={{ color: '#999' }}>Sin compras cargadas</td></tr>
                            )}
                          </tbody>
                        </table>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Input
                          size="small"
                          type="number"
                          min={1}
                          placeholder="Cantidad"
                          value={nuevaCompra.cantidad}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevaCompra({ ...nuevaCompra, cantidad: e.target.value })}
                          style={{ width: 90 }}
                        />
                        <Input
                          size="small"
                          placeholder="Nro factura (opcional)"
                          value={nuevaCompra.numero_factura}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevaCompra({ ...nuevaCompra, numero_factura: e.target.value })}
                        />
                        <Button size="small" onClick={handleAgregarCompra}>Agregar</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Modal>
          </div>
        </div>
      </main>
    </div>
  );
}