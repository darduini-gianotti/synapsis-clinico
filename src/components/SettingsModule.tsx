import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Building2, Save, Upload, AlertCircle, Phone, Mail, MapPin, Hash, FileSpreadsheet, Download, CheckCircle2, Shield, Lock, User, Calendar, FileEdit, Plus, Trash2, Eye, Search, ChevronLeft, ChevronRight, Receipt, MessageSquare, Check, Sparkles, CreditCard, Percent, Radio, Tv, Sliders, Building, LayoutGrid, Users, Edit2, Zap, KeyRound, ShieldCheck, UploadCloud, Copy, RotateCw, Rocket, Info } from 'lucide-react';
import Papa from 'papaparse';
import type { ClinicSettings } from '../context/AuthContext.js';
import { RoomModal } from './reception/RoomModal.js';
import type { Room, UserFiscalSettings } from '../types.js';
import { UniversalMigratorModal } from './patients/UniversalMigratorModal.js';
import { DEFAULT_INVOICE_CANCEL_TEMPLATE } from './fiscal/InvoiceCancelNotifyModal.js';
import { SubscriptionTab } from './subscription/SubscriptionTab.js';
import { InsuranceSettingsTab } from './insurance/InsuranceSettingsTab.js';

interface AddressObj {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface AccountingSettings {
  officeName: string;
  contactName: string;
  phone: string;
  email: string;
  cnpj: string;
  municipalRegistration: string;
  serviceCode: string;
  serviceCodeSessions?: string;
  serviceCodeEvaluation?: string;
  messageTemplate: string;
  messageTemplateSessions?: string;
  messageTemplateEvaluation?: string;
  messageTemplateCancel?: string;
  operational_mode?: 'MANUAL' | 'AUTOMATED';
}

export const DEFAULT_SESSIONS_TEMPLATE = `Olá, *{contabilidade}*! Tudo bem?

Aqui é do consultório de psicologia de *{psicologo}*{crp}.
Gostaria de solicitar a emissão de Nota Fiscal referente aos atendimentos clínicos realizados:

👤 *Paciente:* {paciente}
📄 *CPF:* {cpf}
💼 *Código de Serviço:* {codigo_servico}

🗓️ *Atendimentos / Sessões:*
{datas_valores}

💰 *Valor Total:* R$ {total}
{observacoes}

Poderiam por gentileza emitir a NF com esses dados e me enviar o PDF quando estiver pronta? Obrigado!`;

export const DEFAULT_EVALUATION_TEMPLATE = `Olá, *{contabilidade}*! Tudo bem?

Aqui é do consultório de psicologia de *{psicologo}*{crp}.
Gostaria de solicitar a emissão de Nota Fiscal referente a *Avaliação Neuropsicológica*:

👤 *Paciente:* {paciente}
📄 *CPF:* {cpf}
📋 *Avaliação:* {titulo_avaliacao}
💼 *Código de Serviço:* {codigo_servico}

🗓️ *Parcelas a Faturar:*
{parcelas_detalhe}

💰 *Valor Total da NF:* R$ {total}
{observacoes}

Poderiam por gentileza emitir a NF com esses dados e me enviar o PDF quando estiver pronta? Obrigado!`;

const DEFAULT_NF_TEMPLATE = DEFAULT_SESSIONS_TEMPLATE;

export const SettingsModule: React.FC = () => {
  const { clinicSettings, refreshClinicSettings, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'geral' | 'modulos' | 'convenios' | 'gateway' | 'fiscal' | 'contabilidade' | 'auditoria' | 'migracao' | 'assinatura'>('geral');
  const [isMigratorModalOpen, setIsMigratorModalOpen] = useState<boolean>(false);
  
  // Fiscal States (Carnê-Leão & Perfil Tributário)
  const [fiscalData, setFiscalData] = useState<UserFiscalSettings>({
    user_id: user?.id || 1,
    cpf: '',
    crp: user?.crp_number || '',
    cbo_code: '2251-05',
    dependents_count: 0,
    inss_mode: 'STANDARD_20',
    inss_custom_amount: 0,
    use_simplified_deduction: 0,
  });
  const [operationalTaxMode, setOperationalTaxMode] = useState<'AUTONOMOUS' | 'CLINIC_PJ'>('AUTONOMOUS');
  const [isLoadingFiscal, setIsLoadingFiscal] = useState(false);
  const [isSavingFiscal, setIsSavingFiscal] = useState(false);
  const [fiscalFeedback, setFiscalFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  // Contabilidade States
  const [accountingData, setAccountingData] = useState<AccountingSettings>({
    officeName: '',
    contactName: '',
    phone: '',
    email: '',
    cnpj: '',
    municipalRegistration: '',
    serviceCode: '',
    serviceCodeSessions: '',
    serviceCodeEvaluation: '',
    messageTemplate: DEFAULT_SESSIONS_TEMPLATE,
    messageTemplateSessions: DEFAULT_SESSIONS_TEMPLATE,
    messageTemplateEvaluation: DEFAULT_EVALUATION_TEMPLATE,
    messageTemplateCancel: DEFAULT_INVOICE_CANCEL_TEMPLATE,
  });
  const [templateSubTab, setTemplateSubTab] = useState<'SESSIONS' | 'EVALUATION' | 'CANCEL'>('SESSIONS');
  const [isSavingAccounting, setIsSavingAccounting] = useState(false);
  const [accountingSuccess, setAccountingSuccess] = useState(false);
  const [accountingError, setAccountingError] = useState<string | null>(null);

  // Emissão Direta NFS-e (Nuvem Fiscal Premium) States
  const [fiscalMode, setFiscalMode] = useState<'MANUAL' | 'AUTOMATED'>('MANUAL');
  const [fiscalCreds, setFiscalCreds] = useState<any>({
    is_active: false,
    has_certificate: false,
    tax_regime: 'SIMPLES_NACIONAL',
    cnpj: '',
    municipal_registration: '',
    city_ibge_code: '3550308',
    service_item_code: '04.16',
    cnae_code: '8650-0/03',
    iss_rate: 2.0,
    certificate_valid_until: null,
    certificate_fingerprint: null,
    environment: 'SANDBOX',
  });
  const [certFileBase64, setCertFileBase64] = useState<string | null>(null);
  const [certFileName, setCertFileName] = useState<string>('');
  const [certPassword, setCertPassword] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [isSavingDirectFiscal, setIsSavingDirectFiscal] = useState(false);
  const [directFiscalSuccess, setDirectFiscalSuccess] = useState(false);
  const [directFiscalError, setDirectFiscalError] = useState<string | null>(null);

  // Asaas Gateway States
  const [gatewayConfig, setGatewayConfig] = useState<{
    is_active: boolean;
    provider: string;
    environment: 'SANDBOX' | 'PRODUCTION';
    api_key_masked: string | null;
    has_api_key: boolean;
    webhook_token: string;
    webhook_url: string;
    default_due_days: number;
    fine_percentage: number;
    interest_percentage: number;
  }>({
    is_active: false,
    provider: 'ASAAS',
    environment: 'SANDBOX',
    api_key_masked: null,
    has_api_key: false,
    webhook_token: '',
    webhook_url: '',
    default_due_days: 3,
    fine_percentage: 0.0,
    interest_percentage: 0.0,
  });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isTestingGateway, setIsTestingGateway] = useState(false);
  const [gatewayTestResult, setGatewayTestResult] = useState<{
    success: boolean;
    accountName?: string;
    email?: string;
    status?: string;
    error?: string;
  } | null>(null);
  const [isSavingGateway, setIsSavingGateway] = useState(false);
  const [gatewayFeedback, setGatewayFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [copiedWebhookToken, setCopiedWebhookToken] = useState(false);

  const fetchGatewaySettings = async () => {
    try {
      const res = await api.get('/settings/gateway');
      if (res.data?.settings) {
        setGatewayConfig(res.data.settings);
      }
    } catch (err) {
      console.error('Failed to load gateway settings:', err);
    }
  };

  const handleSaveGatewayConfig = async () => {
    setIsSavingGateway(true);
    setGatewayFeedback(null);
    try {
      const payload: any = {
        is_active: gatewayConfig.is_active,
        environment: gatewayConfig.environment,
        default_due_days: gatewayConfig.default_due_days,
        fine_percentage: gatewayConfig.fine_percentage,
        interest_percentage: gatewayConfig.interest_percentage,
      };
      if (apiKeyInput.trim()) {
        payload.api_key = apiKeyInput.trim();
      }

      const res = await api.post('/settings/gateway', payload);
      if (res.data?.success) {
        setGatewayFeedback({ message: 'Configurações da integração Asaas salvas com sucesso!', type: 'success' });
        setApiKeyInput('');
        fetchGatewaySettings();
      }
    } catch (err: any) {
      setGatewayFeedback({ message: err.response?.data?.error || 'Erro ao salvar configurações do Asaas.', type: 'error' });
    } finally {
      setIsSavingGateway(false);
    }
  };

  const handleTestGatewayConnection = async () => {
    setIsTestingGateway(true);
    setGatewayTestResult(null);
    try {
      const res = await api.post('/settings/gateway/test', {
        apiKey: apiKeyInput.trim() || undefined,
        environment: gatewayConfig.environment,
      });
      setGatewayTestResult(res.data);
    } catch (err: any) {
      setGatewayTestResult({
        success: false,
        error: err.response?.data?.error || 'Falha ao testar comunicação com o Asaas.',
      });
    } finally {
      setIsTestingGateway(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    if (gatewayConfig.webhook_url) {
      navigator.clipboard.writeText(gatewayConfig.webhook_url);
      setCopiedWebhookUrl(true);
      setTimeout(() => setCopiedWebhookUrl(false), 3000);
    }
  };

  const handleCopyWebhookToken = () => {
    if (gatewayConfig.webhook_token) {
      navigator.clipboard.writeText(gatewayConfig.webhook_token);
      setCopiedWebhookToken(true);
      setTimeout(() => setCopiedWebhookToken(false), 3000);
    }
  };
  
  // Geral States
  const [formData, setFormData] = useState<ClinicSettings | null>(null);
  const [addressObj, setAddressObj] = useState<AddressObj>({
    cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  // Auditoria States
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit] = useState(50);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditUserId, setAuditUserId] = useState('');
  const [auditActionType, setAuditActionType] = useState('');
  const [auditUsers, setAuditUsers] = useState<any[]>([]);
  const [isFetchingAudit, setIsFetchingAudit] = useState(false);
  const [auditTotalPages, setAuditTotalPages] = useState(1);

  // Rooms States
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [selectedRoomToEdit, setSelectedRoomToEdit] = useState<Room | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const fetchRoomsList = async () => {
    try {
      setIsLoadingRooms(true);
      setRoomsError(null);
      const res = await api.get('/reception/rooms');
      if (res.data?.rooms) {
        setRoomsList(res.data.rooms);
      }
    } catch (err: any) {
      console.error('Error fetching rooms in settings:', err);
      setRoomsError(err?.response?.data?.error || 'Erro ao carregar consultórios físicos.');
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const getRoomTypeLabel = (type: string) => {
    switch (type) {
      case 'CLINICAL': return 'Clínico Geral / TCC';
      case 'NEURO': return 'Neuropsicologia';
      case 'PLAY_THERAPY': return 'Infantil / Ludoterapia';
      case 'ONLINE': return 'Teleconsulta / Híbrido';
      default: return type;
    }
  };

  useEffect(() => {
    if (activeTab === 'modulos') {
      fetchRoomsList();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'fiscal' && user?.id) {
      const fetchFiscal = async () => {
        try {
          setIsLoadingFiscal(true);
          const res = await api.get(`/fiscal/settings/${user.id}`);
          if (res.data?.settings) {
            setFiscalData(res.data.settings);
          }
          if (clinicSettings?.operational_tax_mode) {
            setOperationalTaxMode(clinicSettings.operational_tax_mode as any);
          }
        } catch (err) {
          console.error('Error fetching fiscal settings:', err);
        } finally {
          setIsLoadingFiscal(false);
        }
      };
      fetchFiscal();
    }
  }, [activeTab, user?.id, clinicSettings]);

  const handleSaveFiscal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    try {
      setIsSavingFiscal(true);
      setFiscalFeedback(null);
      await api.put(`/fiscal/settings/${user.id}`, fiscalData);
      if (user.role === 'ADMIN' && formData) {
        await api.put('/settings', {
          ...formData,
          operational_tax_mode: operationalTaxMode,
        });
        await refreshClinicSettings();
      }
      setFiscalFeedback({ message: 'Perfil fiscal e dados do Carnê-Leão salvos com sucesso!', type: 'success' });
      setTimeout(() => setFiscalFeedback(null), 4000);
    } catch (err: any) {
      setFiscalFeedback({ message: err.response?.data?.error || 'Erro ao salvar configurações fiscais', type: 'error' });
    } finally {
      setIsSavingFiscal(false);
    }
  };

  useEffect(() => {
    if (clinicSettings) {
      setFormData(clinicSettings);
      if (clinicSettings.address) {
        try {
          const parsed = JSON.parse(clinicSettings.address);
          if (parsed.street !== undefined) {
            setAddressObj(parsed);
          } else {
            setAddressObj(prev => ({ ...prev, street: clinicSettings.address as string }));
          }
        } catch {
          setAddressObj(prev => ({ ...prev, street: clinicSettings.address as string }));
        }
      }
    } else {
      setFormData({
        id: 1,
        clinic_name: '',
        cnpj: '',
        phone: '',
        email: '',
        address: '',
        logo_base64: null,
      });
    }
  }, [clinicSettings]);

  useEffect(() => {
    if (activeTab === 'auditoria' && (user?.role === 'ADMIN' || user?.role === 'PSYCHOLOGIST')) {
      fetchAuditLogs();
      fetchUsersForFilter();
    }
  }, [activeTab, auditPage, auditStartDate, auditEndDate, auditUserId, auditActionType]);

  // Debounced search for audit
  useEffect(() => {
    if (activeTab === 'auditoria') {
      const handler = setTimeout(() => {
        setAuditPage(1);
        fetchAuditLogs();
      }, 500);
      return () => clearTimeout(handler);
    }
  }, [auditSearch]);

  const fetchUsersForFilter = async () => {
    try {
      const res = await api.get('/collaborators');
      setAuditUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to fetch users for audit filter', err);
    }
  };

  useEffect(() => {
    fetchAccountingSettings();
    fetchGatewaySettings();
    fetchRoomsList();
  }, []);

  const fetchAccountingSettings = async () => {
    try {
      const [res, fiscalRes] = await Promise.all([
        api.get('/settings/accounting'),
        api.get('/fiscal/credentials')
      ]);
      if (res.data.accounting) {
        const acc = res.data.accounting;
        setAccountingData(prev => ({
          ...prev,
          ...acc,
          serviceCode: acc.serviceCodeSessions || acc.serviceCode || '',
          serviceCodeSessions: acc.serviceCodeSessions || acc.serviceCode || '',
          serviceCodeEvaluation: acc.serviceCodeEvaluation || '',
          messageTemplate: acc.messageTemplateSessions || acc.messageTemplate || DEFAULT_SESSIONS_TEMPLATE,
          messageTemplateSessions: acc.messageTemplateSessions || acc.messageTemplate || DEFAULT_SESSIONS_TEMPLATE,
          messageTemplateEvaluation: acc.messageTemplateEvaluation || DEFAULT_EVALUATION_TEMPLATE,
          messageTemplateCancel: acc.messageTemplateCancel || DEFAULT_INVOICE_CANCEL_TEMPLATE,
        }));
      }
      if (fiscalRes.data?.credentials) {
        setFiscalCreds(fiscalRes.data.credentials);
        if (fiscalRes.data.credentials.is_active) {
          setFiscalMode('AUTOMATED');
        } else {
          setFiscalMode('MANUAL');
        }
      } else {
        setFiscalMode('MANUAL');
      }
    } catch (err) {
      console.error('Failed to load accounting & fiscal settings', err);
    }
  };

  const handleSwitchFiscalMode = async (newMode: 'MANUAL' | 'AUTOMATED') => {
    setFiscalMode(newMode);
    try {
      await api.put('/fiscal/mode', { mode: newMode });
      setFiscalCreds((prev: any) => ({ ...prev, is_active: newMode === 'AUTOMATED' }));
      if (newMode === 'MANUAL') {
        setAccountingSuccess(true);
        setTimeout(() => setAccountingSuccess(false), 3000);
      } else {
        setDirectFiscalSuccess(true);
        setTimeout(() => setDirectFiscalSuccess(false), 3000);
      }
    } catch (err: any) {
      console.error('Failed to switch fiscal mode', err);
    }
  };

  const handleSaveDirectFiscal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingDirectFiscal(true);
    setDirectFiscalError(null);
    setDirectFiscalSuccess(false);
    try {
      const payload: any = {
        is_active: fiscalCreds.is_active,
        tax_regime: fiscalCreds.tax_regime,
        cnpj: fiscalCreds.cnpj,
        municipal_registration: fiscalCreds.municipal_registration,
        city_ibge_code: fiscalCreds.city_ibge_code,
        service_item_code: fiscalCreds.service_item_code,
        cnae_code: fiscalCreds.cnae_code,
        iss_rate: Number(fiscalCreds.iss_rate || 2.0),
        environment: fiscalCreds.environment,
      };
      if (certFileBase64 && certPassword) {
        payload.certificate_pfx_base64 = certFileBase64;
        payload.certificate_password = certPassword;
      }
      const res = await api.post('/fiscal/credentials', payload);
      setFiscalCreds(res.data.credentials);
      setCertPassword('');
      setCertFileBase64(null);
      setCertFileName('');
      setDirectFiscalSuccess(true);
      setTimeout(() => setDirectFiscalSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving direct fiscal settings:', err);
      setDirectFiscalError(err.response?.data?.error || 'Erro ao salvar credenciais fiscais');
    } finally {
      setIsSavingDirectFiscal(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const res = await api.post('/fiscal/test-connection');
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || 'Erro ao testar comunicação com a prefeitura',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCertFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1] || (reader.result as string);
      setCertFileBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAccounting = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingAccounting(true);
    setAccountingError(null);
    setAccountingSuccess(false);
    try {
      await api.put('/settings/accounting', {
        ...accountingData,
        operational_mode: 'MANUAL',
      });
      setFiscalCreds((prev: any) => ({ ...prev, is_active: false }));
      setFiscalMode('MANUAL');
      setAccountingSuccess(true);
      setTimeout(() => setAccountingSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving accounting settings', err);
      setAccountingError(err.response?.data?.error || 'Erro ao salvar configurações contábeis');
    } finally {
      setIsSavingAccounting(false);
    }
  };

  const insertVariableIntoTemplate = (variable: string) => {
    if (templateSubTab === 'EVALUATION') {
      setAccountingData(prev => ({
        ...prev,
        messageTemplateEvaluation: (prev.messageTemplateEvaluation || '') + ' ' + variable
      }));
    } else if (templateSubTab === 'CANCEL') {
      setAccountingData(prev => ({
        ...prev,
        messageTemplateCancel: (prev.messageTemplateCancel || DEFAULT_INVOICE_CANCEL_TEMPLATE) + ' ' + variable
      }));
    } else {
      setAccountingData(prev => ({
        ...prev,
        messageTemplateSessions: (prev.messageTemplateSessions || prev.messageTemplate || '') + ' ' + variable,
        messageTemplate: (prev.messageTemplateSessions || prev.messageTemplate || '') + ' ' + variable,
      }));
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setIsFetchingAudit(true);
      const params = new URLSearchParams({
        page: auditPage.toString(),
        limit: auditLimit.toString(),
      });
      if (auditSearch) params.append('search', auditSearch);
      if (auditStartDate) params.append('startDate', auditStartDate);
      if (auditEndDate) params.append('endDate', auditEndDate);
      if (auditUserId) params.append('userId', auditUserId);
      if (auditActionType) params.append('actionType', auditActionType);

      const res = await api.get(`/audit-logs?${params.toString()}`);
      setAuditLogs(res.data.logs || []);
      if (res.data.pagination) {
        setAuditTotal(res.data.pagination.total);
        setAuditTotalPages(res.data.pagination.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setIsFetchingAudit(false);
    }
  };

  const handleExportAuditCSV = async () => {
    try {
      const params = new URLSearchParams({
        isExport: 'true'
      });
      if (auditSearch) params.append('search', auditSearch);
      if (auditStartDate) params.append('startDate', auditStartDate);
      if (auditEndDate) params.append('endDate', auditEndDate);
      if (auditUserId) params.append('userId', auditUserId);
      if (auditActionType) params.append('actionType', auditActionType);

      const res = await api.get(`/audit-logs?${params.toString()}`);
      const logs = res.data.logs || [];
      
      const csvContent = [
        ['ID', 'Data/Hora', 'Usuário', 'Perfil', 'IP', 'Ação', 'Recurso', 'Detalhes'].join(','),
        ...logs.map((l: any) => [
          l.id,
          new Date(l.timestamp).toLocaleString('pt-BR'),
          `"${l.user_name || 'Sistema'}"`,
          l.user_role || '-',
          l.ip_address || '-',
          l.action,
          `"${l.resource}"`,
          `"${(l.details || '').replace(/"/g, '""')}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `auditoria_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Erro ao exportar logs de auditoria.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/png');
        setFormData(prev => prev ? { ...prev, logo_base64: dataUrl } : null);
        setError(null);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (preset: 'SOLO' | 'SMALL_CLINIC' | 'ENTERPRISE_CLINIC') => {
    if (!formData) return;
    if (preset === 'SOLO') {
      setFormData({
        ...formData,
        operating_mode: 'SOLO',
        repasse_enabled: false,
        reception_tower_enabled: false,
        rooms_enabled: false,
        collaborators_enabled: false,
        waiting_tv_enabled: false,
      });
    } else if (preset === 'SMALL_CLINIC') {
      setFormData({
        ...formData,
        operating_mode: 'SMALL_CLINIC',
        repasse_enabled: true,
        reception_tower_enabled: false,
        rooms_enabled: false,
        collaborators_enabled: true,
        waiting_tv_enabled: false,
      });
    } else if (preset === 'ENTERPRISE_CLINIC') {
      setFormData({
        ...formData,
        operating_mode: 'ENTERPRISE_CLINIC',
        repasse_enabled: true,
        reception_tower_enabled: true,
        rooms_enabled: true,
        collaborators_enabled: true,
        waiting_tv_enabled: true,
      });
    }
  };

  const handleToggleModule = (key: keyof ClinicSettings) => {
    if (!formData) return;
    setFormData({
      ...formData,
      [key]: !formData[key],
    });
  };

  const handleSave = async () => {
    if (!formData?.clinic_name) {
      setError('Nome da clínica é obrigatório.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const payload = {
        ...formData,
        address: JSON.stringify(addressObj)
      };
      await api.put('/clinic-settings', payload);
      await refreshClinicSettings();
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.error || 'Erro ao salvar as configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.substring(0, 8);
    
    let formatted = val;
    if (val.length > 5) {
      formatted = val.replace(/^(\d{5})(\d{1,3})/, '$1-$2');
    }
    setAddressObj(prev => ({ ...prev, cep: formatted }));

    if (val.length === 8) {
      setIsFetchingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${val}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddressObj(prev => ({
            ...prev,
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || ''
          }));
        }
      } catch (err) {
        console.error('Error fetching CEP:', err);
      } finally {
        setIsFetchingCep(false);
      }
    }
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 14) val = val.substring(0, 14);
    
    // Format: 00.000.000/0001-00
    if (val.length > 12) {
      val = val.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
    } else if (val.length > 8) {
      val = val.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4}).*/, '$1.$2.$3/$4');
    } else if (val.length > 5) {
      val = val.replace(/^(\d{2})(\d{3})(\d{1,3}).*/, '$1.$2.$3');
    } else if (val.length > 2) {
      val = val.replace(/^(\d{2})(\d{1,3}).*/, '$1.$2');
    }
    
    setFormData({ ...formData!, cnpj: val });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.substring(0, 11);
    
    if (val.length > 6) {
      val = val.replace(/^(\d{2})(\d{4,5})(\d{4}).*/, '($1) $2-$3');
    } else if (val.length > 2) {
      val = val.replace(/^(\d{2})(\d{1,5}).*/, '($1) $2');
    } else if (val.length > 0) {
      val = val.replace(/^(\d{1,2}).*/, '($1');
    }
    
    setFormData({ ...formData!, phone: val });
  };

  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);

  const handleDownloadTemplate = () => {
    const csvContent = "Nome Completo,CPF,Telefone,Data de Nascimento,E-mail\nJoão da Silva,111.111.111-11,(11) 99999-9999,1990-01-01,joao@email.com\nMaria Oliveira,,(11) 88888-8888,,maria@email.com";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "psicogestao_pacientes_modelo.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<{
    full_name: string;
    cpf: string;
    phone: string;
    birth_date: string;
    email: string;
  }>({
    full_name: '',
    cpf: '',
    phone: '',
    birth_date: '',
    email: ''
  });
  const [showMapping, setShowMapping] = useState(false);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);
    setError(null);
    setShowMapping(false);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.meta.fields || results.meta.fields.length === 0) {
          setError('O arquivo não possui cabeçalhos. A primeira linha deve conter os nomes das colunas.');
          setIsImporting(false);
          return;
        }
        
        const headers = results.meta.fields;
        setCsvHeaders(headers);
        setCsvData(results.data);

        // Auto-detect columns
        const mapping = {
          full_name: headers.find(f => f.toLowerCase().includes('nome') || f.toLowerCase().includes('paciente')) || '',
          cpf: headers.find(f => f.toLowerCase().includes('cpf') || f.toLowerCase().includes('documento')) || '',
          phone: headers.find(f => f.toLowerCase().includes('telefone') || f.toLowerCase().includes('celular') || f.toLowerCase().includes('whatsapp')) || '',
          birth_date: headers.find(f => f.toLowerCase().includes('nascimento') || f.toLowerCase().includes('data')) || '',
          email: headers.find(f => f.toLowerCase().includes('email') || f.toLowerCase().includes('e-mail')) || ''
        };
        
        setColumnMapping(mapping);
        setShowMapping(true);
        setIsImporting(false);
      },
      error: (err) => {
        setError('Erro ao ler o arquivo CSV: ' + err.message);
        setIsImporting(false);
      }
    });
  };

  const executeImport = async () => {
    if (!columnMapping.full_name) {
      setError("A coluna de Nome do Paciente é obrigatória.");
      return;
    }

    setIsImporting(true);
    setError(null);

    const patients = csvData.map((row: any) => ({
      full_name: row[columnMapping.full_name] || '',
      cpf: columnMapping.cpf ? row[columnMapping.cpf] : '',
      phone: columnMapping.phone ? row[columnMapping.phone] : '',
      birth_date: columnMapping.birth_date ? row[columnMapping.birth_date] : '',
      email: columnMapping.email ? row[columnMapping.email] : ''
    })).filter((p: any) => p.full_name);

    if (patients.length === 0) {
      setError('Nenhum paciente válido encontrado para importar.');
      setIsImporting(false);
      return;
    }

    try {
      const res = await api.post('/patients/bulk', patients);
      setImportResult({
        imported: res.data.imported,
        failed: res.data.failed,
        errors: res.data.errors
      });
      setShowMapping(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao importar pacientes.');
    } finally {
      setIsImporting(false);
    }
  };

  if (!formData) return null;

  return (
    <div className="space-y-6 max-w-7xl animate-in fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Configurações da Clínica</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Personalize a identidade visual e os dados gerais da sua clínica.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-start gap-3 mb-6">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-start gap-3 mb-6">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm">Configurações salvas com sucesso!</p>
        </div>
      )}

      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6 gap-6">
        <button
          onClick={() => setActiveTab('geral')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'geral'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Geral
          </div>
        </button>
        <button
          onClick={() => setActiveTab('modulos')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'modulos'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4" />
            Perfil & Módulos
          </div>
        </button>
        <button
          onClick={() => setActiveTab('convenios')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'convenios'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Convênios & TUSS
          </div>
        </button>
        <button
          onClick={() => setActiveTab('contabilidade')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'contabilidade'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Contabilidade & NF
          </div>
        </button>
        <button
          onClick={() => setActiveTab('gateway')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'gateway'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Cobrança Asaas & PIX
            {gatewayConfig.is_active && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Gateway Asaas Ativo" />
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('fiscal')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'fiscal'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Carnê-Leão & Fiscal
          </div>
        </button>
        {(user?.role === 'ADMIN' || user?.role === 'PSYCHOLOGIST') && (
          <button
            onClick={() => setActiveTab('auditoria')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'auditoria'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Auditoria LGPD
            </div>
          </button>
        )}
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setActiveTab('migracao')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'migracao'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Migração de Dados
              <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">ADMIN</span>
            </div>
          </button>
        )}
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setActiveTab('assinatura')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'assinatura'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Assinatura & Planos
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">CLUBE</span>
            </div>
          </button>
        )}
      </div>

      {activeTab === 'geral' || activeTab === 'modulos' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
          {/* Banner de Apresentação */}
          <div className="rounded-2xl p-6 bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-transparent border border-teal-500/20 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-teal-600 text-white shadow-md shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Perfil Operacional & Módulos da Clínica</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-3xl leading-relaxed">
                  Escolha o modelo operacional que melhor se adapta à estrutura da sua clínica. O Synapsis Clínico reorganiza a navegação e a interface instantaneamente, mantendo o ambiente limpo, direto e sem poluição de termos desnecessários.
                </p>
              </div>
            </div>
          </div>

          {/* 3 Cards de Presets Operacionais */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Selecione o Perfil do seu Consultório</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Clique em um perfil para aplicar a configuração recomendada em 1 clique:</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                Perfil Atual: {formData.operating_mode === 'SOLO' ? 'Autônomo (Solo)' : formData.operating_mode === 'SMALL_CLINIC' ? 'Clínica Pequena' : 'Clínica Completa'}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* 1. SOLO */}
              <div
                onClick={() => handleSelectPreset('SOLO')}
                className={`relative rounded-2xl p-5.5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  formData.operating_mode === 'SOLO'
                    ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/30 shadow-md ring-2 ring-teal-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {formData.operating_mode === 'SOLO' && (
                  <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-600 text-white text-[11px] font-bold shadow-xs">
                    <Check className="h-3 w-3" />
                    Ativo
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-teal-600 dark:text-teal-400">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">Profissional Autônomo</h4>
                      <span className="text-[11px] font-medium text-slate-500">Consultório Individual / Solo</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    Interface minimalista para terapeutas que atendem sozinhos. Sem termos de equipe, salas ou repasses.
                  </p>
                  <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-200/70 dark:border-slate-700/70 pt-3">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Prontuário Criptografado & Agenda Pessoal</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Livro-Caixa, Carnê-Leão e Recibos</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                      <span className="text-xs shrink-0">—</span>
                      <span>Oculta: Torre de Recepção, Salas e Repasses</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. SMALL_CLINIC */}
              <div
                onClick={() => handleSelectPreset('SMALL_CLINIC')}
                className={`relative rounded-2xl p-5.5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  formData.operating_mode === 'SMALL_CLINIC'
                    ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/30 shadow-md ring-2 ring-teal-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {formData.operating_mode === 'SMALL_CLINIC' && (
                  <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-600 text-white text-[11px] font-bold shadow-xs">
                    <Check className="h-3 w-3" />
                    Ativo
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">Clínica Pequena</h4>
                      <span className="text-[11px] font-medium text-slate-500">2 a 5 Profissionais • Salas Fixas</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    Para consultórios compartilhados onde cada profissional possui sala dedicada ou horários fixos.
                  </p>
                  <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-200/70 dark:border-slate-700/70 pt-3">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Gestão de Equipe & Agenda Integrada</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Perfil de Secretária e Fechamento de Repasse</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                      <span className="text-xs shrink-0">—</span>
                      <span>Oculta: Torre de Espera Dinâmica e TV Pública</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. ENTERPRISE_CLINIC */}
              <div
                onClick={() => handleSelectPreset('ENTERPRISE_CLINIC')}
                className={`relative rounded-2xl p-5.5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  formData.operating_mode === 'ENTERPRISE_CLINIC'
                    ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/30 shadow-md ring-2 ring-teal-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {formData.operating_mode === 'ENTERPRISE_CLINIC' && (
                  <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-600 text-white text-[11px] font-bold shadow-xs">
                    <Check className="h-3 w-3" />
                    Ativo
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-purple-600 dark:text-purple-400">
                      <Building className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">Clínica Completa</h4>
                      <span className="text-[11px] font-medium text-slate-500">Salas Compartilhadas & Recepção</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    Poder máximo operacional: Torre de recepção em tempo real, painel de TV da espera e mapa de consultórios.
                  </p>
                  <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-200/70 dark:border-slate-700/70 pt-3">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Torre de Recepção ao Vivo & Cronômetro de Espera</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Grid de Consultórios Físicos & Painel TV de Espera</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Lotes de Repasse, Equipe & Auditoria CFP Completa</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ajuste Fino dos Módulos (Switches Granulares) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Personalização Avançada dos Módulos</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ligue ou desligue recursos específicos independentemente do perfil selecionado:</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {/* Switch 1: Torre de Recepção ao Vivo */}
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 mt-0.5">
                    <Radio className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Torre de Recepção ao Vivo</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Cockpit Kanban para a recepção com controle de presença, cronômetro ao vivo de tempo de espera e chamada para o consultório.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleModule('reception_tower_enabled')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    formData.reception_tower_enabled !== false ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      formData.reception_tower_enabled !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Switch 2: Consultórios Físicos */}
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mt-0.5">
                    <Building className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Gestão de Consultórios Físicos</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Mapa espacial das salas da clínica com indicação em tempo real de Livre, Ocupado ou Higienização.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleModule('rooms_enabled')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    formData.rooms_enabled !== false ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      formData.rooms_enabled !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Switch 3: Gestão de Equipe & Colaboradores */}
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mt-0.5">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Equipe Clínica & Colaboradores</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Habilita o cadastro de múltiplos psicólogos e secretárias, com controle de permissões e perfis de acesso.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleModule('collaborators_enabled')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    formData.collaborators_enabled !== false ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      formData.collaborators_enabled !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Switch 4: Fechamento de Repasses de Honorários */}
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <Percent className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Fechamento de Repasse de Honorários</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Cálculo de divisão de honorários da clínica com psicólogos (porcentagem ou fixo por sessão), lotes mensais e recibos PIX.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleModule('repasse_enabled')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    formData.repasse_enabled !== false ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      formData.repasse_enabled !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Switch 5: Painel TV da Sala de Espera */}
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mt-0.5">
                    <Tv className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Painel de TV da Sala de Espera</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Rota dedicada em tela cheia com relógio, branding da clínica e chamada com gongo sonoro suave e anonimização ética CFP/LGPD.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleModule('waiting_tv_enabled')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    formData.waiting_tv_enabled !== false ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      formData.waiting_tv_enabled !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Salvar */}
            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isSaving ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                Salvar Configurações de Módulos
              </button>
            </div>
          </div>

          {/* Gestão de Consultórios Físicos (Exibido quando rooms_enabled estiver ativo) */}
          {formData.rooms_enabled !== false && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">Consultórios Físicos Cadastrados</h3>
                      {roomsList.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                          {roomsList.length}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Configure as salas para controle de disponibilidade e marcação de consultas na Agenda e Torre de Recepção.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchRoomsList}
                    disabled={isLoadingRooms}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer disabled:opacity-50"
                    title="Atualizar consultórios"
                  >
                    <RotateCw className={`h-4 w-4 ${isLoadingRooms ? 'animate-spin text-teal-600' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoomToEdit(null);
                      setIsRoomModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Novo Consultório</span>
                  </button>
                </div>
              </div>

              {isLoadingRooms ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-xs">
                  <div className="h-4 w-4 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
                  <span>Carregando consultórios físicos...</span>
                </div>
              ) : roomsError ? (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{roomsError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchRoomsList}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition cursor-pointer"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : roomsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhum consultório ativo cadastrado. Clique em "Novo Consultório" para adicionar.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {roomsList.map((room) => (
                    <div
                      key={room.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 dark:bg-slate-900/40 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-3.5 h-10 rounded-full shrink-0"
                          style={{ backgroundColor: room.color_code || '#0d9488' }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {room.initials && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                                {room.initials}
                              </span>
                            )}
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {room.name}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="truncate">{getRoomTypeLabel(room.room_type)}</span>
                            <span>•</span>
                            <span className={
                              room.status === 'AVAILABLE'
                                ? 'text-emerald-500 font-semibold'
                                : room.status === 'OCCUPIED'
                                ? 'text-rose-500 font-semibold'
                                : room.status === 'CLEANING'
                                ? 'text-amber-500 font-semibold'
                                : 'text-slate-400'
                            }>
                              {room.status === 'AVAILABLE' ? 'Livre' : room.status === 'OCCUPIED' ? 'Ocupado' : room.status === 'CLEANING' ? 'Higienização' : room.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRoomToEdit(room);
                          setIsRoomModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Editar consultório"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isRoomModalOpen && (
            <RoomModal
              isOpen={isRoomModalOpen}
              roomToEdit={selectedRoomToEdit}
              onClose={() => setIsRoomModalOpen(false)}
              onSuccess={() => fetchRoomsList()}
            />
          )}
        </div>
      ) : activeTab === 'geral' ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-8 animate-in fade-in slide-in-from-bottom-2">
        
        {/* Logo Section */}
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Logomarca</h2>
          <div className="flex items-center gap-6">
            <div className="h-24 w-auto min-w-24 max-w-xs rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden shrink-0 px-2">
              {formData.logo_base64 ? (
                <img src={formData.logo_base64} alt="Preview" className="h-full w-full object-contain" />
              ) : (
                <Upload className="h-8 w-8 text-slate-400" />
              )}
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Faça o upload da logo da sua clínica. Ela será exibida no cabeçalho superior e em futuros documentos gerados.
              </p>
              <div className="flex gap-2">
                <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition">
                  Escolher arquivo
                  <input type="file" className="hidden" accept="image/jpeg,image/png" onChange={handleImageUpload} />
                </label>
                {formData.logo_base64 && (
                  <button
                    onClick={() => setFormData({ ...formData, logo_base64: null })}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition"
                  >
                    Remover
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">Formato aceito: PNG ou JPG. Máximo: 1MB.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700"></div>

        {/* Informações Gerais */}
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Informações Gerais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" /> Nome da Clínica / Consultório *
              </label>
              <input
                type="text"
                value={formData.clinic_name}
                onChange={e => setFormData({ ...formData, clinic_name: e.target.value })}
                className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white"
                placeholder="Ex: Clínica PsicoGestão"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Hash className="h-4 w-4 text-slate-400" /> CNPJ (Opcional)
              </label>
              <input
                type="text"
                value={formData.cnpj || ''}
                onChange={handleCnpjChange}
                className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white"
                placeholder="00.000.000/0001-00"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-400" /> Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={handlePhoneChange}
                className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" /> E-mail de Contato
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white"
                placeholder="contato@clinica.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" /> CEP
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={addressObj.cep}
                  onChange={handleCepChange}
                  className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white"
                  placeholder="00000-000"
                />
                {isFetchingCep && (
                  <div className="absolute right-3 top-2.5 h-4 w-4 border-2 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" /> Endereço / Rua
              </label>
              <input
                type="text"
                value={addressObj.street}
                onChange={e => setAddressObj({ ...addressObj, street: e.target.value })}
                className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white"
                placeholder="Ex: Av. Paulista"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                Número
              </label>
              <input
                type="text"
                value={addressObj.number}
                onChange={e => setAddressObj({ ...addressObj, number: e.target.value })}
                className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white"
                placeholder="Ex: 1000"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                Complemento
              </label>
              <input
                type="text"
                value={addressObj.complement}
                onChange={e => setAddressObj({ ...addressObj, complement: e.target.value })}
                className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white"
                placeholder="Ex: Sala 101"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                Bairro
              </label>
              <input
                type="text"
                value={addressObj.neighborhood}
                onChange={e => setAddressObj({ ...addressObj, neighborhood: e.target.value })}
                className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white"
                placeholder="Ex: Bela Vista"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                Cidade - UF
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addressObj.city}
                  onChange={e => setAddressObj({ ...addressObj, city: e.target.value })}
                  className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white"
                  placeholder="Cidade"
                />
                <input
                  type="text"
                  value={addressObj.state}
                  onChange={e => setAddressObj({ ...addressObj, state: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-20 rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white text-center"
                  placeholder="UF"
                />
              </div>
            </div>

            {/* Tabela de Tarifas Padrão da Clínica */}
            <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-200 dark:border-slate-700/80">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Tabela de Tarifas Padrão da Clínica
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Estes valores são aplicados automaticamente quando profissionais sem permissão de visualização financeira cadastram novos pacientes ou abrem avaliações neuropsicológicas.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Valor Padrão da Sessão de Psicoterapia (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.default_session_price !== undefined && formData.default_session_price !== null ? formData.default_session_price : 180}
                      onChange={e => setFormData({ ...formData, default_session_price: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-9 rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 pr-3 text-slate-900 dark:text-white font-medium"
                      placeholder="180.00"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Valor Padrão da Avaliação Neuropsicológica (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.default_evaluation_price !== undefined && formData.default_evaluation_price !== null ? formData.default_evaluation_price : 2400}
                      onChange={e => setFormData({ ...formData, default_evaluation_price: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-9 rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 pr-3 text-slate-900 dark:text-white font-medium"
                      placeholder="2400.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dados de Recebimento & Chave PIX Oficial da Clínica */}
            <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-200 dark:border-slate-700/80">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Dados de Recebimento & Chave PIX Oficial da Clínica
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Esta chave e dados bancários são inseridos automaticamente nos modelos de cobrança via WhatsApp, mensagens preventivas e demonstrativos de honorários de sessões e avaliações.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tipo de Chave PIX
                  </label>
                  <select
                    value={formData.pix_key_type || 'CPF'}
                    onChange={e => setFormData({ ...formData, pix_key_type: e.target.value })}
                    className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="TELEFONE">Telefone / Celular</option>
                    <option value="ALEATORIA">Chave Aleatória (EVP)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Chave PIX Oficial
                  </label>
                  <input
                    type="text"
                    value={formData.pix_key || ''}
                    onChange={e => setFormData({ ...formData, pix_key: e.target.value })}
                    className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white font-medium"
                    placeholder="Ex: financeiro@psicogestao.com.br ou 00.000.000/0001-00"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Favorecido / Titular da Conta
                  </label>
                  <input
                    type="text"
                    value={formData.pix_beneficiary || ''}
                    onChange={e => setFormData({ ...formData, pix_beneficiary: e.target.value })}
                    className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white font-medium"
                    placeholder="Ex: Clínica PsicoGestão Ltda"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Banco / Dados Adicionais (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.bank_info || ''}
                    onChange={e => setFormData({ ...formData, bank_info: e.target.value })}
                    className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm py-2 px-3 text-slate-900 dark:text-white font-medium"
                    placeholder="Ex: Banco Cora (403) • Agência 0001 • C/C 12345-6"
                  />
                </div>
              </div>
            </div>

            {/* Modelo de Gestão de Repasses a Profissionais */}
            <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-200 dark:border-slate-700/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Percent className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      Gestão de Repasse de Honorários a Profissionais
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      formData.repasse_enabled !== false
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {formData.repasse_enabled !== false ? 'Módulo Ativo' : 'Simplificado (Sem Repasse)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                    Ative se a clínica centraliza os pagamentos dos pacientes e realiza fechamento de lotes de repasse (percentual ou fixo) aos psicólogos parceiros. Desative para consultórios individuais ou quando os pacientes pagam diretamente aos profissionais.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    id="btn-toggle-repasse-module"
                    type="button"
                    role="switch"
                    aria-checked={formData.repasse_enabled !== false}
                    onClick={() => setFormData({ ...formData, repasse_enabled: formData.repasse_enabled === false ? true : false })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 ${
                      formData.repasse_enabled !== false ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        formData.repasse_enabled !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-16">
                    {formData.repasse_enabled !== false ? 'Habilitado' : 'Desabilitado'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700"></div>

        {/* Importação de Dados */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-white">Importação de Pacientes (Migração)</h2>
          </div>
          
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-5">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
              Para importar pacientes de outros sistemas, faça o upload da sua planilha CSV atual (ou baixe nosso modelo).
            </p>
            
            {!showMapping && !importResult && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
                >
                  <Download className="h-4 w-4" />
                  Baixar Modelo CSV
                </button>

                <div className="flex-1 w-full">
                  <label className={`cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed transition-colors ${isImporting ? 'border-slate-300 bg-slate-100 text-slate-400' : 'border-indigo-300 bg-indigo-100/50 text-indigo-700 hover:bg-indigo-200/50 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'}`}>
                    {isImporting ? (
                      <div className="h-4 w-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {isImporting ? 'Importando...' : 'Fazer Upload de Arquivo (.csv)'}
                    </span>
                    <input type="file" className="hidden" accept=".csv" disabled={isImporting} onChange={handleCSVUpload} />
                  </label>
                </div>
              </div>
            )}

            {showMapping && (
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-4 text-sm">
                  Mapeie as colunas da sua planilha com os campos do PsicoGestão:
                </h3>
                
                <div className="space-y-3">
                  {[
                    { key: 'full_name', label: 'Nome do Paciente', required: true },
                    { key: 'cpf', label: 'CPF', required: false },
                    { key: 'phone', label: 'Telefone / Celular', required: false },
                    { key: 'birth_date', label: 'Data de Nascimento', required: false },
                    { key: 'email', label: 'E-mail', required: false }
                  ].map(field => (
                    <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div className="w-48 text-sm font-medium text-slate-700 dark:text-slate-300 flex justify-between">
                        <span>{field.label} {field.required && <span className="text-red-500">*</span>}</span>
                        <span className="hidden sm:inline text-slate-400">→</span>
                      </div>
                      <select
                        value={columnMapping[field.key as keyof typeof columnMapping]}
                        onChange={e => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                        className="flex-1 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm py-2 px-3 text-slate-900 dark:text-white"
                      >
                        <option value="">-- Ignorar este campo --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowMapping(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={executeImport}
                    disabled={isImporting || !columnMapping.full_name}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {isImporting && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Confirmar e Importar {csvData.length} pacientes
                  </button>
                </div>
              </div>
            )}

            {importResult && (
              <div className="mt-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Importação Concluída
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <p><strong>{importResult.imported}</strong> pacientes importados com sucesso.</p>
                  {importResult.failed > 0 && (
                    <p className="text-red-600 dark:text-red-400 mt-1"><strong>{importResult.failed}</strong> pacientes falharam.</p>
                  )}
                </div>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition disabled:opacity-50"
          >
            {isSaving ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Salvar Configurações
          </button>
        </div>

        </div>
      ) : activeTab === 'auditoria' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Trilha de Auditoria LGPD</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {auditTotal} {auditTotal === 1 ? 'evento registrado' : 'eventos registrados'} no período
                </p>
              </div>
            </div>
            
            <button
              onClick={handleExportAuditCSV}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition border border-indigo-200 dark:border-indigo-800"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Buscar</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar ação, recurso ou detalhes..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Data Inicial</label>
                <input
                  type="date"
                  value={auditStartDate}
                  onChange={(e) => setAuditStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Data Final</label>
                <input
                  type="date"
                  value={auditEndDate}
                  onChange={(e) => setAuditEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Usuário</label>
                <select
                  value={auditUserId}
                  onChange={(e) => setAuditUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                >
                  <option value="">Todos os usuários</option>
                  <option value="SYSTEM">Sistema (Ações automáticas)</option>
                  {auditUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">Tipo de Ação</label>
                <select
                  value={auditActionType}
                  onChange={(e) => setAuditActionType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                >
                  <option value="">Todas as ações</option>
                  <option value="LOGIN">Autenticação (Login)</option>
                  <option value="CREATE_">Criações (Paciente, Sessão, etc)</option>
                  <option value="UPDATE_">Atualizações (Paciente, Sessão, etc)</option>
                  <option value="DELETE_">Exclusões</option>
                  <option value="READ_">Visualizações (Listas, Prontuários)</option>
                  <option value="EXPORT_">Exportações</option>
                </select>
              </div>
            </div>

            <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px] rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm table-auto border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 select-none">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">Data/Hora</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">Usuário</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">Ação</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">Recurso</th>
                    <th className="px-4 py-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                  {isFetchingAudit ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Carregando logs...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Nenhum registro encontrado para estes filtros.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const isCreate = log.action.includes('CREATE');
                      const isDelete = log.action.includes('DELETE') || log.action.includes('DETACH');
                      const isUpdate = log.action.includes('UPDATE');
                      const isAuth = log.action.includes('LOGIN') || log.action.includes('AUTH');
                      
                      let Icon = Shield;
                      let iconColor = 'text-slate-400';
                      let badgeColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

                      if (isAuth) { Icon = Lock; iconColor = 'text-emerald-500'; badgeColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'; }
                      else if (isCreate) { Icon = Plus; iconColor = 'text-blue-500'; badgeColor = 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800'; }
                      else if (isDelete) { Icon = Trash2; iconColor = 'text-red-500'; badgeColor = 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800'; }
                      else if (isUpdate) { Icon = FileEdit; iconColor = 'text-amber-500'; badgeColor = 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800'; }
                      else { Icon = Eye; }

                      return (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                <User className="h-3 w-3 text-slate-500" />
                              </div>
                              <div>
                                <p className="text-slate-800 dark:text-slate-200 font-medium text-xs">
                                  {log.user_name || 'Sistema'}
                                </p>
                                <p className="text-[10px] text-slate-500">{log.ip_address}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-bold ${badgeColor}`}>
                              <Icon className={`h-3 w-3 ${iconColor}`} />
                              {log.action}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {log.resource}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 min-w-[250px] max-w-[450px] whitespace-normal break-words">
                            {log.details}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {auditTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Mostrando {(auditPage - 1) * auditLimit + 1} a {Math.min(auditPage * auditLimit, auditTotal)} de {auditTotal}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                    disabled={auditPage === 1 || isFetchingAudit}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 px-2">
                    {auditPage} / {auditTotalPages}
                  </span>
                  <button
                    onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))}
                    disabled={auditPage === auditTotalPages || isFetchingAudit}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'contabilidade' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Seletor do Modo Operacional de NF: Tradicional (WhatsApp) vs Emissão Direta NFS-e (Nuvem Fiscal) */}
          <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-cyan-500/10 rounded-2xl p-6 border border-teal-500/20 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                    Recurso Premium
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Modo Operacional de Faturamento & Notas Fiscais
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Escolha se as notas fiscais serão solicitadas manualmente para seu contador parceiro via WhatsApp ou se serão emitidas automaticamente com 1 clique diretamente pelo sistema.
                </p>
              </div>

              <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSwitchFiscalMode('MANUAL')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    fiscalMode === 'MANUAL'
                      ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                  Contabilidade (WhatsApp)
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchFiscalMode('AUTOMATED')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    fiscalMode === 'AUTOMATED'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5 text-amber-300" />
                  Emissão Direta NFS-e (1 Clique)
                </button>
              </div>
            </div>

            {/* Banner com o modo ativo no sistema */}
            {fiscalMode === 'MANUAL' ? (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <span className="font-bold">Modo Ativo no Sistema: Contabilidade (WhatsApp).</span>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                    Ao faturar atendimentos, o sistema gerará a solicitação formatada para envio imediato ao WhatsApp do contador parceiro. A Emissão Direta fica desativada.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-800 dark:text-teal-300 text-xs">
                <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <span className="font-bold">Modo Ativo no Sistema: Emissão Direta NFS-e (1 Clique).</span>
                  <p className="text-[11px] text-teal-700/80 dark:text-teal-300/80 mt-0.5">
                    As notas fiscais serão autorizadas e assinadas diretamente junto à Prefeitura Municipal através do Certificado Digital A1.
                  </p>
                </div>
              </div>
            )}
          </div>

          {fiscalMode === 'AUTOMATED' ? (
            <form onSubmit={handleSaveDirectFiscal} className="space-y-6">
              {directFiscalSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold">Credenciais fiscais e Certificado Digital A1 salvos com sucesso!</p>
                </div>
              )}

              {directFiscalError && (
                <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold">{directFiscalError}</p>
                </div>
              )}

              {/* 1. Ativação & Ambiente */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-700 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800 dark:text-white">Status da Emissão Automática</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Habilite a autorização direta de NFS-e junto à prefeitura via Nuvem Fiscal.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(fiscalCreds.is_active)}
                      onChange={(e) => setFiscalCreds({ ...fiscalCreds, is_active: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Ambiente de Operação *
                    </label>
                    <select
                      value={fiscalCreds.environment}
                      onChange={(e) => setFiscalCreds({ ...fiscalCreds, environment: e.target.value as any })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="SANDBOX">Sandbox / Homologação (Testes sem valor fiscal)</option>
                      <option value="PRODUCTION">Produção Oficial (Prefeitura Municipal)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Regime Tributário da Clínica *
                    </label>
                    <select
                      value={fiscalCreds.tax_regime}
                      onChange={(e) => setFiscalCreds({ ...fiscalCreds, tax_regime: e.target.value as any })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="SIMPLES_NACIONAL">Simples Nacional (ME/EPP)</option>
                      <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                      <option value="MEI">Microempreendedor Individual (MEI)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Certificado Digital A1 (.pfx) */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-700 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 dark:text-white">Certificado Digital A1 (.pfx / .p12)</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Exigido pela legislação brasileira para assinatura digital ICP-Brasil e autorização junto à SEFAZ/Prefeitura.
                    </p>
                  </div>
                </div>

                {fiscalCreds.has_certificate && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold">Certificado A1 Criptografado Ativo</span>
                        {fiscalCreds.certificate_valid_until && (
                          <span className="ml-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                            (Válido até: {fiscalCreds.certificate_valid_until})
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-200/50 dark:bg-emerald-900 text-[10px] font-mono">
                      {fiscalCreds.certificate_fingerprint ? `SHA: ${fiscalCreds.certificate_fingerprint}` : 'AES-256'}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {fiscalCreds.has_certificate ? 'Substituir Certificado A1 (.pfx)' : 'Arquivo do Certificado A1 (.pfx) *'}
                    </label>
                    <input
                      type="file"
                      accept=".pfx,.p12"
                      onChange={handleCertFileChange}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-slate-700 dark:file:text-slate-200 cursor-pointer"
                    />
                    {certFileName && (
                      <p className="text-[11px] text-emerald-600 font-medium">Arquivo carregado: {certFileName}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Senha do Certificado Digital A1
                    </label>
                    <input
                      type="password"
                      placeholder={fiscalCreds.has_certificate ? '•••••••• (Mantida criptografada)' : 'Digite a senha do arquivo .pfx'}
                      value={certPassword}
                      onChange={(e) => setCertPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400">
                      Criptografia militar AES-256-GCM em repouso no cofre de dados do PsicoGestão.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Dados Fiscais Municipais */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-700 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 dark:text-white">Dados Fiscais Municipais da Clínica</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Parâmetros tributários e enquadramento nos serviços de psicologia.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      CNPJ do Emissor *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="00.000.000/0001-00"
                      value={fiscalCreds.cnpj}
                      onChange={(e) => setFiscalCreds({ ...fiscalCreds, cnpj: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Inscrição Municipal (IM / CCM) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 12345678"
                      value={fiscalCreds.municipal_registration}
                      onChange={(e) => setFiscalCreds({ ...fiscalCreds, municipal_registration: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Código IBGE do Município *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 3550308 (São Paulo)"
                      value={fiscalCreds.city_ibge_code}
                      onChange={(e) => setFiscalCreds({ ...fiscalCreds, city_ibge_code: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Item LC 116 / Código de Serviço *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="04.16"
                      value={fiscalCreds.service_item_code}
                      onChange={(e) => setFiscalCreds({ ...fiscalCreds, service_item_code: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400">04.16 - Psicologia e Psicanálise</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Código CNAE Fiscal *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="8650-0/03"
                      value={fiscalCreds.cnae_code}
                      onChange={(e) => setFiscalCreds({ ...fiscalCreds, cnae_code: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400">8650-0/03 - Atividades de psicologia</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Alíquota ISS (%) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      required
                      placeholder="2.0"
                      value={fiscalCreds.iss_rate}
                      onChange={(e) => setFiscalCreds({ ...fiscalCreds, iss_rate: parseFloat(e.target.value) || 2.0 })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Teste de Conexão com a Prefeitura */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-white">Teste de Comunicação com a Prefeitura</h3>
                    <p className="text-[11px] text-slate-500">Valide se a prefeitura reconhece seu certificado e dados municipais antes de emitir a primeira nota.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    {isTestingConnection ? (
                      <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5 text-amber-300" />
                    )}
                    Testar Conexão Municipal
                  </button>
                </div>

                {testResult && (
                  <div className={`p-4 rounded-xl border text-xs ${
                    testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-start gap-2 font-semibold">
                      {testResult.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                    {testResult.details && (
                      <pre className="mt-2 p-2 rounded bg-black/5 dark:bg-black/40 text-[10px] font-mono overflow-x-auto">
                        {JSON.stringify(testResult.details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* Ação Salvar */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingDirectFiscal}
                  className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-bold text-xs hover:bg-teal-700 transition disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {isSavingDirectFiscal ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Credenciais Fiscais Diretas
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSaveAccounting} className="space-y-6">
              {accountingSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold">Configurações contábeis salvas com sucesso!</p>
                </div>
              )}

              {accountingError && (
                <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold">{accountingError}</p>
                </div>
              )}

              {/* 1. Dados do Escritório de Contabilidade */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-700 space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 dark:text-white">Escritório de Contabilidade</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Dados de contato do escritório responsável pela emissão das suas Notas Fiscais.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nome da Contabilidade / Escritório *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Alfa Assessoria Contábil"
                  value={accountingData.officeName}
                  onChange={(e) => setAccountingData({ ...accountingData, officeName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nome do Contador / Responsável Fiscal
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Roberto (Setor Fiscal)"
                  value={accountingData.contactName}
                  onChange={(e) => setAccountingData({ ...accountingData, contactName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-500" />
                  WhatsApp para Solicitação de NF *
                </label>
                <input
                  type="text"
                  required
                  placeholder="(11) 98888-7777"
                  value={accountingData.phone}
                  onChange={(e) => setAccountingData({ ...accountingData, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
                <p className="text-[11px] text-slate-400">Número para onde as mensagens formatadas de solicitação de NF serão enviadas.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  E-mail da Contabilidade
                </label>
                <input
                  type="email"
                  placeholder="fiscal@contabilidade.com.br"
                  value={accountingData.email}
                  onChange={(e) => setAccountingData({ ...accountingData, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* 2. Dados Fiscais da Clínica / Emissor */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Hash className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Dados Fiscais do Prestador</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Informações fiscais da sua clínica ou registro de autônomo (CFP/CNPJ) para referência da contabilidade.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  CNPJ ou CPF do Emissor
                </label>
                <input
                  type="text"
                  placeholder="00.000.000/0001-00"
                  value={accountingData.cnpj}
                  onChange={(e) => setAccountingData({ ...accountingData, cnpj: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Inscrição Municipal (CCM)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 1.234.567-8"
                  value={accountingData.municipalRegistration}
                  onChange={(e) => setAccountingData({ ...accountingData, municipalRegistration: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Código de Serviço (Sessões de Psicoterapia)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 04111 / 8650-0/03"
                  value={accountingData.serviceCodeSessions || accountingData.serviceCode || ''}
                  onChange={(e) => setAccountingData({
                    ...accountingData,
                    serviceCodeSessions: e.target.value,
                    serviceCode: e.target.value,
                  })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Código de Serviço (Avaliação Neuropsicológica)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 04112 / 8650-0/03 (Avaliações / Perícias)"
                  value={accountingData.serviceCodeEvaluation || ''}
                  onChange={(e) => setAccountingData({
                    ...accountingData,
                    serviceCodeEvaluation: e.target.value,
                  })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* 3. Editor de Template de Mensagem WhatsApp */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-white">Modelos de Mensagem para a Contabilidade</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Personalize o formato do texto enviado pelo WhatsApp ao solicitar a nota de Sessões ou de Avaliações.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (templateSubTab === 'EVALUATION') {
                    setAccountingData({ ...accountingData, messageTemplateEvaluation: DEFAULT_EVALUATION_TEMPLATE });
                  } else if (templateSubTab === 'CANCEL') {
                    setAccountingData({ ...accountingData, messageTemplateCancel: DEFAULT_INVOICE_CANCEL_TEMPLATE });
                  } else {
                    setAccountingData({
                      ...accountingData,
                      messageTemplateSessions: DEFAULT_SESSIONS_TEMPLATE,
                      messageTemplate: DEFAULT_SESSIONS_TEMPLATE,
                    });
                  }
                }}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                Restaurar Padrão {templateSubTab === 'EVALUATION' ? '(Avaliação)' : templateSubTab === 'CANCEL' ? '(Cancelamento)' : '(Psicoterapia)'}
              </button>
            </div>

            {/* Seletor de Sub-Abas de Modelos */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
              <button
                type="button"
                onClick={() => setTemplateSubTab('SESSIONS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  templateSubTab === 'SESSIONS'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Sessões de Psicoterapia</span>
              </button>
              <button
                type="button"
                onClick={() => setTemplateSubTab('EVALUATION')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  templateSubTab === 'EVALUATION'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <span>Avaliações Neuropsicológicas</span>
              </button>
              <button
                type="button"
                onClick={() => setTemplateSubTab('CANCEL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  templateSubTab === 'CANCEL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Cancelamento / Aborto de NF</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Variáveis Dinâmicas {templateSubTab === 'EVALUATION' ? 'para Avaliações' : templateSubTab === 'CANCEL' ? 'para Cancelamento de NF' : 'para Psicoterapia'} (Clique para inserir no texto):
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(templateSubTab === 'EVALUATION'
                  ? [
                      { tag: '{paciente}', desc: 'Nome do Paciente' },
                      { tag: '{cpf}', desc: 'CPF do Paciente' },
                      { tag: '{titulo_avaliacao}', desc: 'Título da Avaliação' },
                      { tag: '{parcelas_detalhe}', desc: 'Detalhe das Parcelas' },
                      { tag: '{valor_total_contrato}', desc: 'Contrato Integral (R$)' },
                      { tag: '{total}', desc: 'Valor Solicitado na NF (R$)' },
                      { tag: '{codigo_servico}', desc: 'Código de Serviço Fiscal' },
                      { tag: '{psicologo}', desc: 'Nome do Psicólogo' },
                      { tag: '{crp}', desc: 'CRP do Profissional' },
                      { tag: '{contabilidade}', desc: 'Nome da Contabilidade' },
                      { tag: '{cnpj_cpf}', desc: 'CNPJ/CPF do Emissor' },
                      { tag: '{observacoes}', desc: 'Observações' },
                    ]
                  : templateSubTab === 'CANCEL'
                  ? [
                      { tag: '{contabilidade}', desc: 'Nome da Contabilidade' },
                      { tag: '{paciente}', desc: 'Nome do Paciente' },
                      { tag: '{valor}', desc: 'Valor Total (R$)' },
                      { tag: '{data_solicitacao}', desc: 'Data da Solicitação' },
                      { tag: '{motivo}', desc: 'Motivo do Estorno' },
                    ]
                  : [
                      { tag: '{paciente}', desc: 'Nome do Paciente' },
                      { tag: '{cpf}', desc: 'CPF do Paciente' },
                      { tag: '{datas_valores}', desc: 'Lista de Sessões' },
                      { tag: '{total}', desc: 'Valor Total (R$)' },
                      { tag: '{codigo_servico}', desc: 'Código de Serviço Fiscal' },
                      { tag: '{psicologo}', desc: 'Nome do Psicólogo' },
                      { tag: '{crp}', desc: 'CRP do Profissional' },
                      { tag: '{contabilidade}', desc: 'Nome da Contabilidade' },
                      { tag: '{cnpj_cpf}', desc: 'CNPJ/CPF do Emissor' },
                      { tag: '{observacoes}', desc: 'Observações' },
                    ]
                ).map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => insertVariableIntoTemplate(v.tag)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700/70 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-700 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 border border-slate-200 dark:border-slate-600 transition cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3 text-teal-500" />
                    <span>{v.tag}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({v.desc})</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <textarea
                rows={10}
                value={
                  templateSubTab === 'EVALUATION'
                    ? (accountingData.messageTemplateEvaluation || '')
                    : templateSubTab === 'CANCEL'
                    ? (accountingData.messageTemplateCancel || '')
                    : (accountingData.messageTemplateSessions || accountingData.messageTemplate || '')
                }
                onChange={(e) => {
                  if (templateSubTab === 'EVALUATION') {
                    setAccountingData({ ...accountingData, messageTemplateEvaluation: e.target.value });
                  } else if (templateSubTab === 'CANCEL') {
                    setAccountingData({ ...accountingData, messageTemplateCancel: e.target.value });
                  } else {
                    setAccountingData({
                      ...accountingData,
                      messageTemplateSessions: e.target.value,
                      messageTemplate: e.target.value,
                    });
                  }
                }}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-3 text-xs font-mono text-slate-900 dark:text-white leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingAccounting}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-bold text-xs hover:bg-teal-700 transition disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isSavingAccounting ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar Dados da Contabilidade
            </button>
          </div>
        </form>
          )}
        </div>
      ) : activeTab === 'fiscal' ? (
        <form onSubmit={handleSaveFiscal} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {fiscalFeedback && (
            <div className={`p-4 rounded-xl flex items-start gap-3 ${
              fiscalFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
              {fiscalFeedback.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              )}
              <p className="text-sm font-semibold">{fiscalFeedback.message}</p>
            </div>
          )}

          {/* Banner de Apresentação Carnê-Leão */}
          <div className="rounded-2xl p-6 bg-gradient-to-br from-indigo-500/10 via-teal-500/5 to-transparent border border-indigo-500/20 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-indigo-600 text-white shadow-md shrink-0">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Perfil Tributário & Carnê-Leão Web</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-3xl leading-relaxed">
                  Configure as alíquotas, deduções legais (INSS, dependentes) e regime tributário para o cálculo automático do IRPF mensal (DARF 0190), escrituração do Livro-Caixa e exportação para o sistema Carnê-Leão da Receita Federal.
                </p>
              </div>
            </div>
          </div>

          {/* Regime da Clínica (Visível para ADMIN) */}
          {user?.role === 'ADMIN' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Regime Tributário Geral do Estabelecimento</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define como a clínica organiza a escrituração contábil dos atendimentos e repasses.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => setOperationalTaxMode('AUTONOMOUS')}
                  className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                    operationalTaxMode === 'AUTONOMOUS'
                      ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-2 ring-teal-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">Profissionais Autônomos (Pessoa Física)</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Cada psicólogo emite seus próprios recibos de honorários no seu CPF e escritura as despesas e retenções da clínica no seu Livro-Caixa digital individual.
                      </p>
                    </div>
                    {operationalTaxMode === 'AUTONOMOUS' && <Check className="h-5 w-5 text-teal-600 shrink-0" />}
                  </div>
                </div>

                <div
                  onClick={() => setOperationalTaxMode('CLINIC_PJ')}
                  className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                    operationalTaxMode === 'CLINIC_PJ'
                      ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-2 ring-teal-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">Clínica Centralizada (Pessoa Jurídica)</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        A clínica emite todas as Notas Fiscais pelo seu CNPJ e realiza repasse aos profissionais via nota de serviços PJ ou pró-labore.
                      </p>
                    </div>
                    {operationalTaxMode === 'CLINIC_PJ' && <Check className="h-5 w-5 text-teal-600 shrink-0" />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dados Fiscais do Profissional */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Dados Fiscais & Registro Profissional</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Identificação exigida pela Receita Federal na escrituração do Carnê-Leão e emissão do recibo legal ao paciente.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  CPF do Profissional *
                </label>
                <input
                  type="text"
                  value={fiscalData.cpf || ''}
                  onChange={(e) => setFiscalData({ ...fiscalData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-400">Utilizado como identificador do titular no Carnê-Leão e-CAC</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Número do CRP *
                </label>
                <input
                  type="text"
                  value={fiscalData.crp || ''}
                  onChange={(e) => setFiscalData({ ...fiscalData, crp: e.target.value })}
                  placeholder="Ex: 06/123456"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-400">Registro no Conselho Regional de Psicologia</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Código CBO (Ocupação RFB)
                </label>
                <input
                  type="text"
                  value={fiscalData.cbo_code || '2251-05'}
                  onChange={(e) => setFiscalData({ ...fiscalData, cbo_code: e.target.value })}
                  placeholder="2251-05"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-400">2251-05: Psicólogo Clínico (padrão Receita Federal)</span>
              </div>
            </div>
          </div>

          {/* Deduções Pessoais: INSS e Dependentes */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Percent className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Deduções Pessoais Legais (IRPF)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Deduções que abatem o imposto devido mensalmente no cálculo da DARF 0190.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dependentes */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-white">
                    Dependentes Legais no IRPF
                  </label>
                  <span className="text-xs font-mono font-semibold text-teal-600 dark:text-teal-400">
                    R$ {(fiscalData.dependents_count * 189.59).toFixed(2).replace('.', ',')}/mês
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Dedução oficial da Receita Federal de <strong>R$ 189,59 por dependente ao mês</strong> (filhos até 21 anos, até 24 se universitários, cônjuges sem renda declarada).
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="15"
                    value={fiscalData.dependents_count}
                    onChange={(e) => setFiscalData({ ...fiscalData, dependents_count: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-24 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-center font-bold text-sm text-slate-900 dark:text-white"
                  />
                  <span className="text-xs text-slate-500">dependente(s)</span>
                </div>
              </div>

              {/* INSS Autônomo */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                <label className="text-xs font-bold text-slate-800 dark:text-white block">
                  Regime Previdenciário (INSS Autônomo)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  O INSS pago como autônomo é 100% dedutível da base de cálculo do Carnê-Leão no mês do efetivo recolhimento.
                </p>
                
                <select
                  value={fiscalData.inss_mode}
                  onChange={(e) => setFiscalData({ ...fiscalData, inss_mode: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500"
                >
                  <option value="STANDARD_20">Contribuinte Individual 20% (Padrão Autônomo)</option>
                  <option value="SIMPLIFIED_11">Plano Simplificado 11% (R$ 166,98/mês)</option>
                  <option value="CUSTOM_FIXED">Valor Fixo Mensal Declarado (GPS avulsa)</option>
                  <option value="NONE">Não deduzir INSS (já recolhe em CLT ou isento)</option>
                </select>

                {fiscalData.inss_mode === 'CUSTOM_FIXED' && (
                  <div className="space-y-1 pt-2 animate-in fade-in">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Valor da Guia GPS (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fiscalData.inss_custom_amount || 0}
                      onChange={(e) => setFiscalData({ ...fiscalData, inss_custom_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white"
                      placeholder="0,00"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingFiscal}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-bold text-xs hover:bg-teal-700 transition disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isSavingFiscal ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar Perfil Fiscal
            </button>
          </div>
        </form>
      ) : activeTab === 'gateway' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Banner de Apresentação */}
          <div className="bg-gradient-to-r from-teal-600/10 via-cyan-600/10 to-blue-600/10 rounded-2xl p-6 border border-teal-500/20 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 uppercase tracking-wider">
                    Automação Bancária & PIX Dinâmico
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Integração com Gateway Asaas
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Conecte sua conta PJ do Asaas para gerar links de cobrança com <strong>QR Code PIX Dinâmico</strong> e <strong>Cartão de Crédito parcelado</strong>. O sistema dá baixa e concilia os pagamentos automaticamente via Webhook em tempo real, sem necessidade de conferência manual de extratos.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs shrink-0">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status:</span>
                <button
                  type="button"
                  onClick={() => setGatewayConfig(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    gatewayConfig.is_active ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      gatewayConfig.is_active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className={`text-xs font-bold ${gatewayConfig.is_active ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'}`}>
                  {gatewayConfig.is_active ? 'ATIVO' : 'DESATIVADO'}
                </span>
              </div>
            </div>
          </div>

          {gatewayFeedback && (
            <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${
              gatewayFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
            }`}>
              {gatewayFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              )}
              <span>{gatewayFeedback.message}</span>
            </div>
          )}

          {/* Formulário de Configuração */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-6 shadow-xs">
            {/* Ambiente e Chave de API */}
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Autenticação & Credenciais da API Asaas
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ambiente Operacional:
                  </label>
                  <select
                    value={gatewayConfig.environment}
                    onChange={(e: any) => setGatewayConfig(prev => ({ ...prev, environment: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="SANDBOX">Homologação / Sandbox (Testes sem dinheiro real)</option>
                    <option value="PRODUCTION">Produção (Oficial - Dinheiro real)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Chave de API do Asaas (API Key):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder={gatewayConfig.api_key_masked ? `Chave atual: ${gatewayConfig.api_key_masked}` : '$aact_... (Cole aqui sua chave do Asaas)'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleTestGatewayConnection}
                      disabled={isTestingGateway || (!apiKeyInput && !gatewayConfig.has_api_key)}
                      className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isTestingGateway ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                          Testando...
                        </>
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5 text-amber-500" />
                          Testar Conexão
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    No painel do Asaas, acesse: <em>Configurações da Conta → Integrações → Chave de API</em>.
                  </p>
                </div>
              </div>

              {/* Resultado do Teste */}
              {gatewayTestResult && (
                <div className={`mt-3 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  gatewayTestResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300'
                }`}>
                  {gatewayTestResult.success ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Conexão Homologada!</strong> Conta conectada: {gatewayTestResult.accountName} ({gatewayTestResult.email || 'Autenticada'}).
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                      <span><strong>Falha no teste:</strong> {gatewayTestResult.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <hr className="border-slate-200 dark:border-slate-700" />

            {/* Configuração do Webhook */}
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                <Radio className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                Configuração do Webhook para Baixa Automática em Tempo Real
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                Cole a URL abaixo no painel do Asaas (<em>Configurações da Conta → Integrações → Webhooks → Cobranças</em>) para que as baixas ocorram automaticamente.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    URL do Webhook:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={gatewayConfig.webhook_url}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyWebhookUrl}
                      className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedWebhookUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedWebhookUrl ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Token Secreto do Webhook (Header asaas-access-token):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={gatewayConfig.webhook_token}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyWebhookToken}
                      className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedWebhookToken ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedWebhookToken ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-700" />

            {/* Prazos Padrão */}
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Regras de Vencimento
              </h4>
              <div className="w-full max-w-xs">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dias padrão para vencimento da cobrança:
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={gatewayConfig.default_due_days}
                  onChange={(e) => setGatewayConfig(prev => ({ ...prev, default_due_days: parseInt(e.target.value) || 3 }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Botão de Salvar */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveGatewayConfig}
                disabled={isSavingGateway}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-bold text-xs hover:bg-teal-700 transition disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isSavingGateway ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar Configurações do Asaas
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'migracao' && user?.role === 'ADMIN' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">

          {/* Aviso de Segurança ADMIN */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-400/40 text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
            <div className="text-xs leading-relaxed">
              <strong className="block font-bold mb-0.5">Operação Administrativa Restrita</strong>
              Esta ferramenta está disponível apenas para o perfil <strong>Administrador</strong>. A migração pode criar ou enriquecer centenas de cadastros de pacientes simultaneamente. Uma simulação prévia obrigatória (Dry-Run) será exibida antes de qualquer gravação, exigindo confirmação explícita via digitação de <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded font-mono">MIGRAR</code>.
            </div>
          </div>

          {/* Card Hero */}
          <div className="rounded-3xl p-8 bg-gradient-to-br from-teal-900/40 via-slate-900 to-indigo-950/40 border border-teal-500/30 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  <Rocket className="h-8 w-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-extrabold text-white">Migrador de Dados v2.4</h2>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                      Art. 18 LGPD
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Somente ADMIN
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Importação de pacientes em 1 clique a partir de exportações de sistemas concorrentes ou planilhas personalizadas do Excel. O sistema interpreta automaticamente as colunas, sanea CPFs, calcula faixas etárias e vincula responsáveis de menores — sem redigitação e sem perda de histórico.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMigratorModalOpen(true)}
                className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-lg shadow-teal-500/25 flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Iniciar Migrador de Dados</span>
              </button>
            </div>

            {/* 5 Sistemas Compatíveis */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              {[
                { name: 'PsicoManager', type: 'Preset Homologado', fmt: 'CSV / XLSX', color: 'border-blue-500/30 text-blue-400' },
                { name: 'iClinic / Doctoralia', type: 'Preset Homologado', fmt: 'CSV / XLSX', color: 'border-emerald-500/30 text-emerald-400' },
                { name: 'Feegow Clinic', type: 'Preset Homologado', fmt: 'CSV / XLSX', color: 'border-indigo-500/30 text-indigo-400' },
                { name: 'Zenklub / Vittude', type: 'Preset Homologado', fmt: 'CSV', color: 'border-purple-500/30 text-purple-400' },
                { name: 'Excel / Planilha Própria', type: 'De-Para Visual', fmt: 'XLSX / CSV', color: 'border-slate-500/30 text-slate-300' },
              ].map((s) => (
                <div key={s.name} className={`p-3.5 rounded-2xl bg-slate-900/80 border ${s.color} text-center`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${s.color.split(' ')[1]}`}>{s.name}</span>
                  <strong className="text-[11px] text-white block mt-1">{s.type}</strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{s.fmt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instruções de Exportação */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Info className="h-4 w-4 text-teal-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Como exportar do seu sistema atual</h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
              <div className="space-y-1">
                <strong className="text-slate-800 dark:text-slate-200 block">🔵 PsicoManager</strong>
                <p className="text-[11px] leading-relaxed">Acesse <em>Pacientes → Exportar → CSV</em>. O arquivo gerado é compatível diretamente — nenhuma edição necessária.</p>
              </div>
              <div className="space-y-1">
                <strong className="text-slate-800 dark:text-slate-200 block">🟢 Doctoralia / iClinic</strong>
                <p className="text-[11px] leading-relaxed">Acesse <em>Relatórios → Pacientes → Exportar planilha</em>. Selecione o formato <strong>Excel (.xlsx)</strong>.</p>
              </div>
              <div className="space-y-1">
                <strong className="text-slate-800 dark:text-slate-200 block">🟣 Feegow Clinic</strong>
                <p className="text-[11px] leading-relaxed">Acesse <em>Cadastros → Pacientes → Exportar → CSV ou XLSX</em>. Inclua os campos de responsável legal se houver menores.</p>
              </div>
              <div className="space-y-1">
                <strong className="text-slate-800 dark:text-slate-200 block">🟡 Zenklub / Vittude</strong>
                <p className="text-[11px] leading-relaxed">Acesse o <em>Painel de Gestão → Relatório de Clientes → Exportar CSV</em>. O sistema reconhece automaticamente as colunas.</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <strong className="text-slate-800 dark:text-slate-200 block">⚪ Qualquer planilha Excel personalizada</strong>
                <p className="text-[11px] leading-relaxed">Se você usa uma planilha própria do Excel ou qualquer outro sistema não listado, basta exportar em formato <strong>.xlsx</strong> ou <strong>.csv</strong> com os dados dos pacientes em colunas (o Migrador apresentará um assistente de De-Para para mapear cada coluna).</p>
              </div>
            </div>
          </div>

          {/* Fundamento Legal */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <ShieldCheck className="h-5 w-5 shrink-0 text-teal-500 mt-0.5" />
            <div>
              <strong className="block text-slate-800 dark:text-slate-200 font-bold mb-0.5">Fundamento Legal — Art. 18 da LGPD (Lei 13.709/2018)</strong>
              <p className="leading-relaxed text-[11px]">O titular dos dados tem direito à portabilidade dos seus dados pessoais a outro fornecedor de serviços. Seu sistema atual é legalmente obrigado a fornecer a exportação dos cadastros dos pacientes da sua clínica. O arquivo é processado em memória no navegador, sem que arquivos brutos sejam gravados em disco nos servidores do Synapsis.</p>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'convenios' && (
        <InsuranceSettingsTab />
      )}

      {activeTab === 'assinatura' && (
        <SubscriptionTab />
      )}

      <UniversalMigratorModal
        isOpen={isMigratorModalOpen}
        onClose={() => setIsMigratorModalOpen(false)}
      />
    </div>
  );
};
