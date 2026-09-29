import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { HelpItem, INSPECTOR_ITEMS } from '../components/help/helpData.js';
import { api } from '../services/api.js';

interface ElementMeta {
  tagName: string;
  innerText?: string;
  ariaLabel?: string;
  title?: string;
  module?: string;
  subTab?: string;
}

interface HelpContextType {
  // Modal Central de Ajuda & Copiloto IA
  isHelpCenterOpen: boolean;
  openHelpCenter: () => void;
  closeHelpCenter: () => void;
  toggleHelpCenter: () => void;

  // Modo Lente / Inspetor Visual de Elementos
  isInspectorActive: boolean;
  activeHelpId: string | null;
  activeHelpItem: HelpItem | null;
  targetRect: DOMRect | null;
  isLoadingAiExplanation: boolean;
  toggleInspector: () => void;
  openInspector: () => void;
  closeInspector: () => void;
  inspectElement: (helpId: string, rect: DOMRect, elementMeta?: ElementMeta) => Promise<void>;
  clearActiveItem: () => void;

  // Ações de Navegação acionadas pelo Copiloto
  registerNavigationHandler: (handler: (action: string) => void) => void;
  triggerNavigation: (action: string) => void;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export const HelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHelpCenterOpen, setIsHelpCenterOpen] = useState<boolean>(false);
  const [isInspectorActive, setIsInspectorActive] = useState<boolean>(false);
  const [activeHelpId, setActiveHelpId] = useState<string | null>(null);
  const [customHelpItem, setCustomHelpItem] = useState<HelpItem | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isLoadingAiExplanation, setIsLoadingAiExplanation] = useState<boolean>(false);
  const [navigationHandler, setNavigationHandler] = useState<((action: string) => void) | null>(null);

  const openHelpCenter = useCallback(() => {
    // Se a lente estiver aberta, fecha ela para focar no Copiloto
    setIsInspectorActive(false);
    setActiveHelpId(null);
    setTargetRect(null);
    setIsHelpCenterOpen(true);
  }, []);

  const closeHelpCenter = useCallback(() => {
    setIsHelpCenterOpen(false);
  }, []);

  const toggleHelpCenter = useCallback(() => {
    setIsHelpCenterOpen((prev) => !prev);
  }, []);

  const toggleInspector = useCallback(() => {
    setIsInspectorActive((prev) => {
      if (prev) {
        setActiveHelpId(null);
        setCustomHelpItem(null);
        setTargetRect(null);
      } else {
        // Se abriu a lente, fecha o modal central para dar visibilidade à tela
        setIsHelpCenterOpen(false);
      }
      return !prev;
    });
  }, []);

  const openInspector = useCallback(() => {
    setIsHelpCenterOpen(false);
    setIsInspectorActive(true);
  }, []);

  const closeInspector = useCallback(() => {
    setIsInspectorActive(false);
    setActiveHelpId(null);
    setCustomHelpItem(null);
    setTargetRect(null);
  }, []);

  const clearActiveItem = useCallback(() => {
    setActiveHelpId(null);
    setCustomHelpItem(null);
    setTargetRect(null);
  }, []);

  const inspectElement = useCallback(async (helpId: string, rect: DOMRect, elementMeta?: ElementMeta) => {
    setActiveHelpId(helpId);
    setTargetRect(rect);

    // Se já está no catálogo estático, usa direto
    if (INSPECTOR_ITEMS[helpId]) {
      setCustomHelpItem(null);
      return;
    }

    // Se for um elemento dinâmico clicado com o Modo Lente
    if (elementMeta) {
      setIsLoadingAiExplanation(true);
      try {
        const res = await api.post('/ai/explain-element', {
          tagName: elementMeta.tagName,
          innerText: elementMeta.innerText,
          ariaLabel: elementMeta.ariaLabel,
          title: elementMeta.title,
          module: elementMeta.module || 'Geral',
          subTab: elementMeta.subTab,
        });

        const data = res.data;
        setCustomHelpItem({
          id: helpId,
          title: data.title || 'Componente da Interface',
          category: data.category || 'geral',
          description: data.description,
          howToUse: data.howToUse,
          clinicalAndLegalTip: data.clinicalAndLegalImpact || 'Ação em conformidade com as diretrizes do CFP.',
          bestPractice: data.proTip,
          iconName: 'Sparkles',
          isAiGenerated: true,
        });
      } catch (err) {
        console.warn('Erro ao obter explicação de IA do elemento:', err);
        setCustomHelpItem({
          id: helpId,
          title: elementMeta.innerText || 'Componente Interativo',
          category: 'geral',
          description: 'Elemento de controle do sistema para realização de rotinas clínicas ou administrativas.',
          clinicalAndLegalTip: 'O uso adequado previne retrabalho e preserva a organização do consultório.',
          iconName: 'Sparkles',
          isAiGenerated: false,
        });
      } finally {
        setIsLoadingAiExplanation(false);
      }
    } else {
      setCustomHelpItem(null);
    }
  }, []);

  const registerNavigationHandler = useCallback((handler: (action: string) => void) => {
    setNavigationHandler(() => handler);
  }, []);

  const triggerNavigation = useCallback((action: string) => {
    if (navigationHandler) {
      navigationHandler(action);
      // Fecha a central de ajuda para mostrar a tela solicitada
      setIsHelpCenterOpen(false);
    }
  }, [navigationHandler]);

  // Sincroniza classe CSS no body para cursor estilizado
  useEffect(() => {
    if (isInspectorActive) {
      document.body.classList.add('inspector-mode-active');
    } else {
      document.body.classList.remove('inspector-mode-active');
    }

    return () => {
      document.body.classList.remove('inspector-mode-active');
    };
  }, [isInspectorActive]);

  // Tecla de atalho global F1 ou Ctrl+Shift+H para abrir o Copiloto
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1' || (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h'))) {
        e.preventDefault();
        setIsHelpCenterOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeHelpItem = customHelpItem || (activeHelpId ? INSPECTOR_ITEMS[activeHelpId] : null);

  return (
    <HelpContext.Provider
      value={{
        isHelpCenterOpen,
        openHelpCenter,
        closeHelpCenter,
        toggleHelpCenter,
        isInspectorActive,
        activeHelpId,
        activeHelpItem,
        targetRect,
        isLoadingAiExplanation,
        toggleInspector,
        openInspector,
        closeInspector,
        inspectElement,
        clearActiveItem,
        registerNavigationHandler,
        triggerNavigation,
      }}
    >
      {children}
    </HelpContext.Provider>
  );
};

export const useHelp = (): HelpContextType => {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return context;
};
