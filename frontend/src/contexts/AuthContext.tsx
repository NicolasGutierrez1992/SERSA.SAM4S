'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, LoginDto, ApiResponse, LoginResponse } from '@/types';
import { apiService } from '@/services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginDto) => Promise<ApiResponse<LoginResponse>>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay token almacenado al cargar la página
    const token = apiService.getToken();
    if (token) {
      // Aquí podrías verificar el token con el backend
      // Por ahora solo marcamos como no loading
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (credentials: LoginDto): Promise<ApiResponse<LoginResponse>> => {
    setIsLoading(true);
    try {
      const result = await apiService.login(credentials);
      
      if (result.success && result.data) {
        setUser(result.data.user);
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    apiService.logout();
    setUser(null);
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