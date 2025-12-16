'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Table, Input, Spin,  Modal, Button, Form, Select, message } from 'antd';
import Image from 'next/image';
import { EditOutlined, ReloadOutlined } from '@ant-design/icons';

// Obtener usuario autenticado del localStorage
const getCurrentUser = () => {
  if (typeof window !== 'undefined') {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }
  return {};
};

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
        // Log completo del error para depuración
        console.error('[UsuariosPage] Error al cargar usuarios (estructura completa):', err);
        // Manejo robusto para distintos tipos de error
          message.error('error', err);
        if (err?.status === 403 || err?.error === 'No tienes permisos para acceder a esta sección.') {
          message.error('No tienes permisos para acceder a esta sección.');
        } else if (err?.error) {
          message.error(err.error);
        } else {
          message.error('Error al cargar usuarios');
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
    // Si es mayorista, setear id_mayorista automáticamente
    if (isMayorista) {
      form.setFieldsValue({ rol: 3, id_mayorista: idMayorista });
    }
    setModalVisible(true);
  };  // Mapea los campos del usuario a los nombres esperados por el formulario
  const mapUserToForm = (user: any) => ({
    nombre: user.nombre,
    email: user.mail,
    cuit: user.cuit,
    rol: user.rol,
    status: user.status,    limiteDescargas: user.limite_descargas,
    id_mayorista: user.id_mayorista,
    celular: user.celular,
    tipo_descarga: user.tipo_descarga || 'CUENTA_CORRIENTE',
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
      if (err?.response?.data?.message) {
        message.error(err.response.data.message);
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

      // ⭐ Si es mayorista editando, y cambia el tipo_descarga, mostrar confirmación
      if (editingUser && isMayorista && values.tipo_descarga !== editingUser.tipo_descarga) {
        const tipoAnterior = editingUser.tipo_descarga || 'CUENTA_CORRIENTE';
        const tipoNuevo = values.tipo_descarga;
        const labelAnterior = tipoAnterior === 'PREPAGO' ? 'Prepago' : 'Cuenta Corriente';
        const labelNuevo = tipoNuevo === 'PREPAGO' ? 'Prepago' : 'Cuenta Corriente';
        
        const confirmacion = window.confirm(
          `⚠️ CAMBIO DE TIPO DE DESCARGA\n\n` +
          `Usuario: ${editingUser.nombre}\n` +
          `Cambiar de: ${labelAnterior} → ${labelNuevo}\n\n` +
          (tipoNuevo === 'PREPAGO' 
            ? `Se le descontará el límite en cada descarga.\n` 
            : `Se validará por descargas pendientes de pago.\n`) +
          `\n¿Confirmar este cambio?`
        );

        if (!confirmacion) {
          return;
        }
      }      console.log('Valores validados para enviar al backend:', values);
      console.log('Usuario en edición:', editingUser);      if (editingUser) {
        // ⭐ Filtrar campos según el rol
        let dataToSend: any = {};
        
        if (isMayorista) {
          // Los mayoristas solo pueden editar estos campos
          dataToSend = {
            limiteDescargas: values.limiteDescargas,
            tipo_descarga: values.tipo_descarga
          };
          console.log('[Mayorista Edit] Campos filtrados:', dataToSend);
        } else if (!isMayorista && editingUser.rol === 2) {
          // Admin editando Mayorista: puede editar notification_limit, limiteDescargas y tipo_descarga
          dataToSend = {
            limiteDescargas: values.limiteDescargas,
            tipo_descarga: values.tipo_descarga,
            notification_limit: values.notification_limit
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
        await api.post('/users', values);
        message.success('Usuario creado');
        // Abrir WhatsApp Web con mensaje de alta
        const celular = values.celular?.replace(/[^\d]/g, '');
        const password = values.password;
        const cuit = values.cuit;
        if (celular && password) {
          // Ajusta el código de país según corresponda (ejemplo: 54 para Argentina)
          const numeroCompleto = celular.startsWith('54') ? celular : `54${celular}`;
          //Mejorar el mensaje a enviar por whatsapp
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
      if (err?.response?.data?.message) {
        message.error(err.response.data.message);
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
    { title: 'ID', dataIndex: 'id_usuario', key: 'id_usuario', sorter: (a: any, b: any) => a.id_usuario - b.id_usuario },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre', sorter: (a: any, b: any) => a.nombre.localeCompare(b.nombre) },
    { title: 'Email', dataIndex: 'mail', key: 'mail', sorter: (a: any, b: any) => a.mail.localeCompare(b.mail) },
    { title: 'CUIT', dataIndex: 'cuit', key: 'cuit', sorter: (a: any, b: any) => a.cuit.localeCompare(b.cuit) },
    { title: 'Rol', dataIndex: 'rol', key: 'rol', render: (rol: number) => rol === 1 ? 'Admin' : rol === 2 ? 'Mayorista' : rol === 3 ? 'Distribuidor' : rol === 4 ? 'Facturación' : 'Usuario' },
    { title: 'Estado', dataIndex: 'status', key: 'status', render: (s: number) => s === 1 ? 'Activo' : s === 2 ? 'Suspendido' : 'Inactivo', sorter: (a: any, b: any) => a.status - b.status },
    {
      title: 'Mayorista',
      dataIndex: 'id_mayorista',
      key: 'id_mayorista',
      render: (id: number) => MAYORISTAS_MAP[id] || '-',
    },    { title: 'Límite Descargas', dataIndex: 'limite_descargas', key: 'limite_descargas', sorter: (a: any, b: any) => a.limite_descargas - b.limite_descargas },
    { 
      title: 'Tipo Descarga', 
      dataIndex: 'tipo_descarga', 
      key: 'tipo_descarga', 
      render: (tipo: string) => {
        const color = tipo === 'PREPAGO' ? '#ef4444' : '#3b82f6';
        const label = tipo === 'PREPAGO' ? 'Prepago' : 'Cuenta Corriente';
        return <span style={{ color, fontWeight: 500 }}>{label}</span>;
      }
    },    ...(currentUser.rol === 1 ? [{
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
    }
  ];

  // Función para resetear contraseña
  const handleResetPassword = async (user: any) => {
    try {
      await api.patch(`/users/${user.id_usuario}/reset-password`);
      message.success('Contraseña reseteada. El usuario debe revisar su email.');
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
  // Obtener nombre del rol
  const getRoleName = (rol: number) => {
    switch (rol) {
      case 1: return 'Administrador';
      case 2: return 'Mayorista';
      case 3: return 'Distribuidor';
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                disabled={currentUser.rol === 3}
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
                      {getRoleName(currentUser?.rol)} • CUIT: {currentUser?.cuit}
                    </p>
                  </>
                )}
                
              </div>
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
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
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
                >
                  {/* ⭐ Mostrar info si es mayorista editando */}
                  {isMayorista && editingUser && (
                    <div style={{ 
                      backgroundColor: '#f0f9ff', 
                      border: '1px solid #0ea5e9', 
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '16px'
                    }}>
                      <p style={{ margin: 0, fontSize: '14px', color: '#0369a1', fontWeight: 500 }}>
                        ℹ️ Como mayorista, solo puedes editar: Límite de Descargas y Tipo de Descarga
                      </p>
                    </div>
                  )}                  <Form
                    form={form}
                    layout="vertical"
                    initialValues={editingUser || { status: 1, id_rol: 3, tipo_descarga: 'CUENTA_CORRIENTE', notification_limit: 100 }}
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
                    <Form.Item name="celular" label="Celular" rules={[{ required: true, message: 'Ingrese el número de celular' }]}>
                      <Input type="tel" disabled={isMayorista} />
                    </Form.Item>
                    <Form.Item name="rol" label="Rol" rules={[{ required: true }]}>
                      <Select 
                        disabled={isMayorista}
                        options={isMayorista 
                          ? [{ value: 3, label: 'Distribuidor' }]
                          : [
                              { value: 1, label: 'Admin' },
                              { value: 2, label: 'Mayorista' },
                              { value: 3, label: 'Distribuidor' },
                              { value: 4, label: 'Facturación' }
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
                    </Form.Item>                    <Form.Item name="limiteDescargas" label="Límite de Descargas" rules={[{ required: true }]}> 
                      <Input type="number" min={1} />
                    </Form.Item>
                      <Form.Item name="tipo_descarga" label="Tipo de Descarga" rules={[{ required: true, message: 'Seleccione el tipo de descarga' }]}>
                      <Select 
                        disabled={isMayorista && !editingUser}
                        options={[
                          { value: 'CUENTA_CORRIENTE', label: 'Cuenta Corriente' },
                          { value: 'PREPAGO', label: 'Prepago' }
                        ]}
                      />
                    </Form.Item>
                      <Form.Item name="id_mayorista" label="Mayorista">
                      <Select 
                        disabled={isMayorista} 
                        allowClear 
                        placeholder="Seleccionar mayorista"
                        options={isMayorista 
                          ? [{ value: currentUser.id_mayorista, label: currentUser.nombre_mayorista }]
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
          </div>
        </div>
      </main>
    </div>
  );
}