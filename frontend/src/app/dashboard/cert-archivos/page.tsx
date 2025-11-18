'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { certificadosApi } from '@/lib/api';
export default function CertArchivosPage() {
  const [certificado, setCertificado] = useState<File | null>(null);
  const [pwrCst, setPwrCst] = useState<File | null>(null);
  const [rootRti, setRootRti] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const router = useRouter();
    
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certificado && !pwrCst && !rootRti) {
      setMessage('Debe seleccionar al menos un archivo.');
      return;
    }
    setMessage('Enviando...');
    try {
      // Usar la función del api
      const res = await certificadosApi.postUploadCertificado({
        certificado,
        pwrCst,
        rootRti,
      });
      setMessage(res.message || 'Archivos actualizados correctamente');
    } catch (err: any) {
      setMessage('Error al actualizar archivos');
    }
  };

  return (
    <div className="container mx-auto max-w-2xl mt-10">
      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Actualizar Archivos de Certificados</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">certificado.pfx</label>
            <input type="file" accept=".pfx" onChange={e => setCertificado(e.target.files?.[0] || null)} className="block w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">pwrCst.txt</label>
            <input type="file" accept=".txt" onChange={e => setPwrCst(e.target.files?.[0] || null)} className="block w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Root_RTI.txt</label>
            <input type="file" accept=".txt" onChange={e => setRootRti(e.target.files?.[0] || null)} className="block w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex items-center gap-4">
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2 rounded shadow">Enviar</button>
            <button type="button" className="text-indigo-600 underline" onClick={() => router.back()}>Volver</button>
          </div>
        </form>
        {message && <div className="mt-6 text-center text-base text-gray-700">{message}</div>}
      </div>
    </div>
  );
}