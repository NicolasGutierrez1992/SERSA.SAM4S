'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, LoginDto, ApiResponse, LoginResponse } from '@/types';
import { apiService } from '@/services/api';
import { authApi, getUser } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginDto) => Promise<ApiResponse<LoginResponse>>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Intentar recuperar usuario desde la cookie user_info (no httpOnly)
    const storedUser = getUser();
    if (storedUser) {
      setUserState(storedUser as unknown as User);
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginDto): Promise<ApiResponse<LoginResponse>> => {
    setIsLoading(true);
    try {
      const result = await apiService.login(credentials);

      if (result.success && result.data) {
        // authApi.login ya guardó user_info en cookie; sincronizar estado React
        setUserState(result.data.user as unknown as User);
      }

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authApi.logout(); // Llama POST /auth/logout para limpiar cookie httpOnly
    setUserState(null);
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
