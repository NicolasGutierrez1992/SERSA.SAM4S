'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { certificadosApi, appSettingsApi } from '@/lib/api';

// Tabs: 0 = Upload, 1 = Settings
type Tab = 'upload' | 'settings';

// Tipos para settings
interface AppSetting {
  id: string;
  value: string;
  description?: string;
  data_type?: string;
}

export default function CertArchivosPage() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [pfxPassword, setPfxPassword] = useState('');
  const [pfxLoading, setPfxLoading] = useState(false);
  const [pfxMessage, setPfxMessage] = useState('');
  const [rootRti, setRootRti] = useState<File | null>(null);
  const [rootRtiLoading, setRootRtiLoading] = useState(false);
  const [rootRtiMessage, setRootRtiMessage] = useState('');
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (activeTab === 'settings') {
      loadSettings();
    }
  }, [activeTab]);

  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const data = await appSettingsApi.getAll();
      setSettings(data);
    } catch (err: any) {
      console.error('Error loading settings:', err);
      setSettingsMessage('Error al cargar configuraciones');
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleUpdateSetting = async (key: string) => {
    setSavingSettings(true);
    try {
      await appSettingsApi.update(key, editingValue);
      setSettingsMessage('Configuracion actualizada correctamente');
      setEditingKey(null);
      loadSettings();
    } catch (err: any) {
      console.error('Error updating setting:', err);
      setSettingsMessage('Error al actualizar configuracion');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSubmitPfx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pfxFile) { setPfxMessage('Debe seleccionar un archivo .pfx'); return; }
    if (!pfxPassword.trim()) { setPfxMessage('Debe ingresar la contrasena del certificado'); return; }
    setPfxLoading(true);
    setPfxMessage('Enviando...');
    try {
      const res = await certificadosApi.uploadPfx(pfxFile, pfxPassword);
      setPfxMessage((res as any).message || 'Certificado PFX cargado correctamente');
      setPfxFile(null);
      setPfxPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al cargar el certificado PFX';
      setPfxMessage(`Error: ${msg}`);
    } finally {
      setPfxLoading(false);
    }
  };

  const handleSubmitRootRti = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootRti) { setRootRtiMessage('Debe seleccionar el archivo Root_RTI.txt'); return; }
    setRootRtiLoading(true);
    setRootRtiMessage('Enviando...');
    try {
      const res = await certificadosApi.uploadRootRti(rootRti);
      setRootRtiMessage(res.message || 'Root_RTI cargado correctamente');
      setRootRti(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al cargar Root_RTI';
      setRootRtiMessage(`Error: ${msg}`);
    } finally {
      setRootRtiLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl mt-10 mb-10">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-800">Gestion de Certificados</h1>
          <p className="text-gray-600 mt-2">Administra los archivos de certificados y configuraciones del sistema</p>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Cargar Archivos
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Configuraciones
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* TAB 1: UPLOAD ARCHIVOS */}
          {activeTab === 'upload' && (
            <div className="space-y-8">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Los archivos se almacenan encriptados en la base de datos. Cada seccion se sube de forma independiente.
                </p>
              </div>

              {/* Seccion PFX */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Certificado PFX</h2>
                <form onSubmit={handleSubmitPfx} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Archivo certificado.pfx
                    </label>
                    <input
                      type="file"
                      accept=".pfx"
                      onChange={e => setPfxFile(e.target.files?.[0] || null)}
                      className="block w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {pfxFile && <p className="text-xs text-gray-500 mt-1">{pfxFile.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contrasena del certificado
                    </label>
                    <input
                      type="password"
                      value={pfxPassword}
                      onChange={e => setPfxPassword(e.target.value)}
                      placeholder="Ingrese la contrasena del archivo .pfx"
                      className="block w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-2">
                    <button
                      type="submit"
                      disabled={pfxLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold px-6 py-2 rounded shadow transition-colors"
                    >
                      {pfxLoading ? 'Cargando...' : 'Cargar PFX'}
                    </button>
                  </div>
                  {pfxMessage && (
                    <div className={`p-3 rounded text-sm ${
                      pfxMessage.toLowerCase().startsWith('error') ? 'bg-red-50 border border-red-200 text-red-800' :
                      pfxMessage === 'Enviando...' ? 'bg-blue-50 border border-blue-200 text-blue-800' :
                      'bg-green-50 border border-green-200 text-green-800'
                    }`}>
                      {pfxMessage}
                    </div>
                  )}
                </form>
              </div>

              {/* Seccion Root_RTI */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Root_RTI.txt</h2>
                <form onSubmit={handleSubmitRootRti} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Archivo Root_RTI.txt <span className="text-gray-500">(Certificado raiz AFIP)</span>
                    </label>
                    <input
                      type="file"
                      accept=".txt"
                      onChange={e => setRootRti(e.target.files?.[0] || null)}
                      className="block w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {rootRti && <p className="text-xs text-gray-500 mt-1">{rootRti.name}</p>}
                  </div>
                  <div className="flex items-center gap-4 pt-2">
                    <button
                      type="submit"
                      disabled={rootRtiLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold px-6 py-2 rounded shadow transition-colors"
                    >
                      {rootRtiLoading ? 'Cargando...' : 'Cargar Root_RTI'}
                    </button>
                  </div>
                  {rootRtiMessage && (
                    <div className={`p-3 rounded text-sm ${
                      rootRtiMessage.toLowerCase().startsWith('error') ? 'bg-red-50 border border-red-200 text-red-800' :
                      rootRtiMessage === 'Enviando...' ? 'bg-blue-50 border border-blue-200 text-blue-800' :
                      'bg-green-50 border border-green-200 text-green-800'
                    }`}>
                      {rootRtiMessage}
                    </div>
                  )}
                </form>
              </div>

              <div>
                <button
                  type="button"
                  className="text-indigo-600 hover:text-indigo-700 underline font-medium"
                  onClick={() => router.back()}
                >
                  Volver
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGURACIONES */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-800">
                  <strong>Configuraciones en tiempo real:</strong> Los cambios se aplican inmediatamente sin necesidad de reiniciar el servidor.
                </p>
              </div>

              {loadingSettings ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">Cargando configuraciones...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {settings.filter(s => s.id !== 'NOTIFICATION_LIMIT').map((setting) => (
                    <div
                      key={setting.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{setting.id}</h3>
                          {setting.description && (
                            <p className="text-sm text-gray-600 mt-1">{setting.description}</p>
                          )}
                          <div className="mt-3">
                            {editingKey === setting.id ? (
                              <div className="flex gap-2">
                                <input
                                  type={setting.data_type === 'number' ? 'number' : 'text'}
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                  onClick={() => handleUpdateSetting(setting.id)}
                                  disabled={savingSettings}
                                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium transition-colors"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={() => setEditingKey(null)}
                                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded font-medium transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                                  {setting.value}
                                </code>
                                <button
                                  onClick={() => {
                                    setEditingKey(setting.id);
                                    setEditingValue(setting.value);
                                  }}
                                  className="ml-4 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                                >
                                  Editar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {settingsMessage && (
                <div className={`mt-6 p-4 rounded ${
                  settingsMessage.toLowerCase().startsWith('error') ? 'bg-red-50 border border-red-200 text-red-800' :
                  'bg-green-50 border border-green-200 text-green-800'
                }`}>
                  {settingsMessage}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => router.back()}
                  className="text-indigo-600 hover:text-indigo-700 underline font-medium"
                >
                  Volver
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
