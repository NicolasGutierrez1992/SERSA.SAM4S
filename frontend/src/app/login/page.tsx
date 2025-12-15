'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { authApi, setAuthToken, setUser, type LoginRequest } from '@/lib/api';

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginRequest>({
    cuit: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Solo permitir números en el CUIT
    if (name === 'cuit') {
      const numericValue = value.replace(/\D/g, '');
      if (numericValue.length <= 11) {
        setFormData(prev => ({ ...prev, [name]: numericValue }));
        if (error && error.toLowerCase().includes('cuit')) setError('');
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (error && error.toLowerCase().includes('contraseña')) setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();
    setLoading(true);
    setError('');
    // Validaciones básicas
    if (formData.cuit.length !== 11) {
      setError('El CUIT debe tener exactamente 11 dígitos');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      const response = await authApi.login(formData);

      // Guardar token y usuario
      setAuthToken(response.access_token);
      setUser(response.user);

      // Redirigir según el estado del usuario
      if ('must_change_password' in response.user && response.user.must_change_password) {
        router.push('/change-password');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Error de login:', err);
      
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message === 'Network Error') {
        setError('Error de conexión. Verifique que el servidor esté funcionando.');
      } else {
        setError('Error al iniciar sesión. Verifique sus credenciales.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Logo y título */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image
                src="/assets/images/logo.SERSA.jpg"
                alt="SERSA Logo"
                width={120}
                height={60}
                className="h-12 w-auto"
                priority
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Gestión de Certificados Sam4s
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Ingrese sus credenciales para acceder
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="cuit" className="block text-sm font-medium text-gray-700">
                CUIT
              </label>
              <input
                id="cuit"
                name="cuit"
                type="text"
                required
                value={formData.cuit}
                onChange={handleChange}
                placeholder="Ingrese su CUIT (11 dígitos)"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Solo números, sin guiones (ej: 20123456789)
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="Ingrese su contraseña"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Iniciando sesión...
                  </span>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>
            </div>
          </form>

          {/* Información adicional */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              ¿Problemas para acceder? Contacte al administrador del sistema
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// NOTA: Si tienes lógica global de autenticación, asegúrate de que no redirija a /login si ya estás en /login para no perder el mensaje de error.