import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase'; // Importamos o banco

export type UserRole = 'admin' | 'developer' | 'gerente' | 'operador';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>; // Mudou para Promise (assíncrono)
  logout: () => void;
  isAdmin: boolean;
  isDeveloper: boolean;
  hasPermission: (permission: string) => boolean;
}

// Usuário Mestre (Sempre funciona, mesmo sem internet/banco)
const MASTER_USER = {
  id: 'master-001',
  username: 'planex',
  password: 'planex2026',
  name: 'Administrador Planex',
  role: 'admin' as UserRole,
  permissions: ['all'],
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('pdv_user_v2');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('pdv_user_v2');
      }
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // 1. Primeiro checa o usuário mestre (fixo)
    if (username === MASTER_USER.username && password === MASTER_USER.password) {
      const { password: _, ...userData } = MASTER_USER;
      setUser(userData);
      localStorage.setItem('pdv_user_v2', JSON.stringify(userData));
      return true;
    }

    // 2. Se não for o mestre, busca na sua tabela do Supabase
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('nome_usuario', username)
        .eq('senha', password)
        .single();

      if (data && !error) {
        const userData: User = {
          id: data.id,
          username: data.nome_usuario,
          name: data.nome_completo,
          role: data.cargo as UserRole,
          permissions: data.permissoes || [],
        };
        setUser(userData);
        localStorage.setItem('pdv_user_v2', JSON.stringify(userData));
        return true;
      }
    } catch (err) {
      console.error("Erro no login:", err);
    }

    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('pdv_user_v2');
  }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'gerente';
  const isDeveloper = user?.role === 'developer' || user?.username === 'Leonardo';

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.role === 'admin' || user.permissions.includes('all')) return true;
      return user.permissions.includes(permission);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isDeveloper, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}