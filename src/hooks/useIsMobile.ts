import { useState, useEffect, useCallback } from 'react';

export function useIsMobile(breakpoint = 768) {
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  const [preferredMode, setPreferredMode] = useState<'auto' | 'mobile' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'auto';
    return (localStorage.getItem('synapsis_view_mode') as any) || 'auto';
  });

  const isForceMobileRoute = typeof window !== 'undefined' && (
    window.location.pathname === '/m' ||
    window.location.pathname.startsWith('/m/') ||
    window.location.pathname === '/mobile'
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  const toggleViewMode = useCallback(() => {
    setPreferredMode((current) => {
      const next = current === 'desktop' ? 'mobile' : 'desktop';
      localStorage.setItem('synapsis_view_mode', next);
      return next;
    });
  }, []);

  const resetToAuto = useCallback(() => {
    setPreferredMode('auto');
    localStorage.removeItem('synapsis_view_mode');
  }, []);

  // Determinação final: se for rota /m, é sempre mobile.
  // Se houver preferência explícita, respeita a preferência.
  // Senão, segue a largura da tela.
  const isMobile = isForceMobileRoute || (
    preferredMode === 'mobile' ? true :
    preferredMode === 'desktop' ? false :
    isMobileScreen
  );

  return {
    isMobile,
    isMobileScreen,
    preferredMode,
    toggleViewMode,
    resetToAuto,
  };
}
