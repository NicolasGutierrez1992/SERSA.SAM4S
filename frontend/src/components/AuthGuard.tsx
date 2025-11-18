// src/components/AuthGuard.tsx
'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiService } from '@/services/api';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Solo redirigir si NO estamos en /login y el usuario NO está autenticado
    if (!apiService.isAuthenticated() && pathname !== '/login') {
      router.push('/login');
    }
    // Si hay token, no hacer nada. El 403 se maneja en el componente que hace la request.
  }, [pathname]);

  return <>{children}</>;
}
