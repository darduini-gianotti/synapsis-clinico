import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types.js';
import { api } from '../services/api.js';

export interface ClinicSettings {
  id: number;
  clinic_name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_base64: string | null;
  default_session_price?: number | null;
  default_evaluation_price?: number | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  pix_beneficiary?: string | null;
  bank_info?: string | null;
  repasse_enabled?: boolean;
  operating_mode?: 'SOLO' | 'SMALL_CLINIC' | 'ENTERPRISE_CLINIC';
  reception_tower_enabled?: boolean;
  rooms_enabled?: boolean;
  collaborators_enabled?: boolean;
  waiting_tv_enabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  clinicSettings: ClinicSettings | null;
  refreshClinicSettings: () => Promise<void>;
  isModuleEnabled: (moduleKey: 'repasse' | 'reception_tower' | 'rooms' | 'collaborators' | 'waiting_tv') => boolean;
  login: (email: string, password: string) => Promise<void>;
  switchUserQuick: (email: string) => Promise<void>;
  logout: () => void;
  isSecretary: boolean;
  isPsychologist: boolean;
  isAdmin: boolean;
  canAccessClinical: boolean;
  hasPermission: (perm: string) => boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('psico_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('psico_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('synapsis_theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return 'dark'; // Tema Escuro como padrão oficial
  });

  const refreshClinicSettings = async () => {
    try {
      const res = await api.get('/clinic-settings');
      if (res.data.settings) {
        setClinicSettings(res.data.settings);
      }
    } catch (err) {
      console.error('Failed to load clinic settings', err);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('synapsis_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      let currentToken = localStorage.getItem('psico_token');
      if (currentToken) {
        try {
          const res = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${currentToken}` },
          });
          if (isMounted && res.data?.user) {
            setUser(res.data.user);
            setToken(currentToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${currentToken}`;
            localStorage.setItem('psico_user', JSON.stringify(res.data.user));
            setIsLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem('psico_token');
          localStorage.removeItem('psico_user');
          delete api.defaults.headers.common['Authorization'];
          currentToken = null;
        }
      }

      // Auto-login as default psychologist (Dr. Marcos) for instant preview ease
      try {
        const res = await api.post('/auth/login', {
          email: 'marcos@psicogestao.com.br',
          password: 'senha123',
        });
        if (isMounted && res.data?.token) {
          const { token: newToken, user: newUser } = res.data;
          setToken(newToken);
          setUser(newUser);
          localStorage.setItem('psico_token', newToken);
          localStorage.setItem('psico_user', JSON.stringify(newUser));
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        }
      } catch (err) {
        console.error('Auto-login failed:', err);
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (token) {
      refreshClinicSettings();
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('psico_token', newToken);
    localStorage.setItem('psico_user', JSON.stringify(newUser));
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(newUser);
  };

  const switchUserQuick = async (email: string) => {
    await login(email, 'senha123');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('psico_token');
    localStorage.removeItem('psico_user');
    delete api.defaults.headers.common['Authorization'];
  };

  const isSecretary = user?.role === 'SECRETARY';
  const isPsychologist = user?.role === 'PSYCHOLOGIST';
  const isAdmin = user?.role === 'ADMIN' || user?.role_id === 1;

  const hasPermission = (perm: string) => {
    if (isAdmin) return true;
    if (user?.permissions && user.permissions.includes(perm)) return true;
    return false;
  };

  const canAccessClinical = hasPermission('view_clinical_records');

  const isModuleEnabled = (moduleKey: 'repasse' | 'reception_tower' | 'rooms' | 'collaborators' | 'waiting_tv'): boolean => {
    if (!clinicSettings) return true;
    switch (moduleKey) {
      case 'repasse':
        return clinicSettings.repasse_enabled !== false;
      case 'reception_tower':
        return clinicSettings.reception_tower_enabled !== false;
      case 'rooms':
        return clinicSettings.rooms_enabled !== false;
      case 'collaborators':
        return clinicSettings.collaborators_enabled !== false;
      case 'waiting_tv':
        return clinicSettings.waiting_tv_enabled !== false;
      default:
        return true;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        clinicSettings,
        refreshClinicSettings,
        isModuleEnabled,
        login,
        switchUserQuick,
        logout,
        isSecretary,
        isPsychologist,
        isAdmin,
        canAccessClinical,
        hasPermission,
        theme,
        toggleTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
