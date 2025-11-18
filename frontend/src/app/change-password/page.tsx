'use client';
// src/app/change-password/page.tsx
import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { useRouter } from 'next/navigation';
import {authApi} from '@/lib/api';

export default function ChangePasswordPage() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const router = useRouter();

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // No enviar confirmPassword al backend
      const { confirmPassword, ...dataToSend } = values;
      await authApi.changePassword(dataToSend);
      message.success('Contraseña cambiada correctamente');
      router.push('/login');
    } catch (err: any) {
      message.error('Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Cambiar Contraseña</h2>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="newPassword" label="Nueva contraseña" rules={[{ required: true, message: 'Ingrese la nueva contraseña' }, { min: 6, message: 'Mínimo 6 caracteres' }]}> 
              <Input.Password />
            </Form.Item>
            <Form.Item name="confirmPassword" label="Confirmar nueva contraseña" dependencies={["newPassword"]} rules={[{ required: true, message: 'Confirme la nueva contraseña' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('newPassword') === value) { return Promise.resolve(); } return Promise.reject('Las contraseñas no coinciden'); } })]}> 
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} className="w-full mt-4" style={{ background: '#6366f1', borderColor: '#6366f1' }}>Cambiar contraseña</Button>
          </Form>
        </div>
      </div>
    </div>
  );
}