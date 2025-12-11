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
      // Intentar recuperar el usuario desde localStorage
      if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
          } catch (error) {
            console.error('Error parsing stored user:', error);
          }
        }
      }
    }
    setIsLoading(false);
  }, []);
  const login = async (credentials: LoginDto): Promise<ApiResponse<LoginResponse>> => {
    setIsLoading(true);
    try {
      const result = await apiService.login(credentials);
      
      if (result.success && result.data) {
        setUser(result.data.user);
        // Guardar usuario en localStorage para persistencia
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(result.data.user));
        }
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  };
  const logout = () => {
    apiService.logout();
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
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