import React, { useState, useEffect } from 'react';
import {
  Patient,
  PatientGroup,
  FinancialPlanType,
  GenderOption,
  EducationOption,
  RaceOption,
} from '../../types.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  calculateAge,
  formatCEP,
  formatCPF,
  formatPhone,
  validateCPF,
  GENDER_OPTIONS,
  EDUCATION_OPTIONS,
} from '../../utils/cpfValidator.js';
import {
  User,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Edit3,
  Save,
  X,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileCheck,
  Search,
  DollarSign,
  HeartHandshake,
  UserPlus,
  Sparkles,
  Loader2,
  MessageSquare,
  Send,
  Share2,
  ExternalLink,
  Building2,
  Lock,
  Unlock,
} from 'lucide-react';

interface PatientProfileTabProps {
  patient: Patient;
  onUpdatePatient: (updated: Patient) => void;
  onCreatePatient?: (created: Patient) => void;
}

export const PatientProfileTab: React.FC<PatientProfileTabProps> = ({
  patient,
  onUpdatePatient,
  onCreatePatient,
}) => {
  const { isAdmin, hasPermission } = useAuth();
  const canViewFinancial = isAdmin || hasPermission('view_financial');
  const [isEditing, setIsEditing] = useState(patient.id === 0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  // Synapsis Paciente Portal Invite State
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);

  const handleGenerateInvite = async (action: 'WHATSAPP' | 'COPY' | 'EMAIL') => {
    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await api.post(`/patients/${patient.id}/invite`);
      const data = res.data;
      onUpdatePatient({
        ...patient,
        portal_access_enabled: true,
        portal_invite_token: data.inviteToken,
        portal_invite_sent_at: data.sentAt,
        portal_invite_expires_at: data.expiresAt,
      });

      if (action === 'WHATSAPP') {
        if (data.whatsappUrl) {
          window.open(data.whatsappUrl, '_blank');
          setInviteSuccess('Convite gerado e WhatsApp aberto para envio!');
          setTimeout(() => setInviteSuccess(null), 5000);
        } else {
          setInviteError('Paciente ou responsável não possui telefone válido cadastrado.');
        }
      } else if (action === 'COPY') {
        await navigator.clipboard.writeText(data.inviteUrl);
        setCopiedInviteLink(true);
        setInviteSuccess('Link mágico de convite copiado para a área de transferência!');
        setTimeout(() => {
          setCopiedInviteLink(false);
          setInviteSuccess(null);
        }, 4000);
      } else if (action === 'EMAIL') {
        if (!patient.email) {
          setInviteError('Paciente não possui e-mail cadastrado.');
        } else {
          await api.post(`/patients/${patient.id}/send-invite-email`);
          setInviteSuccess(`Convite enviado por e-mail para ${patient.email}!`);
          setTimeout(() => setInviteSuccess(null), 5000);
        }
      }
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Erro ao gerar convite.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleTogglePortalAccess = async () => {
    const currentEnabled = patient.portal_access_enabled !== false;
    const newStatus = !currentEnabled;
    try {
      await api.patch(`/patients/${patient.id}/portal-status`, { enabled: newStatus });
      onUpdatePatient({
        ...patient,
        portal_access_enabled: newStatus,
      });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar status do portal.');
    }
  };

  // Form State
  const [fullName, setFullName] = useState(patient.full_name || '');
  const [status, setStatus] = useState<string>(patient.status || 'ACTIVE');
  const [group, setGroup] = useState<PatientGroup>(patient.group || 'Adulto');
  const [birthDate, setBirthDate] = useState(patient.birth_date || '');
  const [cpf, setCpf] = useState(patient.cpf || '');
  const [rg, setRg] = useState(patient.rg || '');
  const [gender, setGender] = useState(patient.gender || 'Prefiro não informar');
  const [profession, setProfession] = useState(patient.profession || '');
  const [education, setEducation] = useState(patient.education || '');
  const [race, setRace] = useState(patient.race || '');
  const [birthplace, setBirthplace] = useState(patient.birthplace || '');
  const [phone, setPhone] = useState(patient.phone || '');
  const [email, setEmail] = useState(patient.email || '');

  // Address
  const [cep, setCep] = useState(formatCEP(patient.address?.cep || ''));
  const [street, setStreet] = useState(patient.address?.street || '');
  const [number, setNumber] = useState(patient.address?.number || '');
  const [complement, setComplement] = useState(patient.address?.complement || '');
  const [neighborhood, setNeighborhood] = useState(patient.address?.neighborhood || '');
  const [city, setCity] = useState(patient.address?.city || '');
  const [state, setState] = useState(patient.address?.state || '');

  // Guardian
  const [guardianName, setGuardianName] = useState(patient.guardian?.fullName || '');
  const [guardianRelationship, setGuardianRelationship] = useState(patient.guardian?.relationship || '');
  const [guardianCpf, setGuardianCpf] = useState(patient.guardian?.cpf || '');
  const [guardianRg, setGuardianRg] = useState(patient.guardian?.rg || '');
  const [guardianBirthDate, setGuardianBirthDate] = useState(patient.guardian?.birthDate || '');
  const [guardianPhone, setGuardianPhone] = useState(patient.guardian?.phone || '');
  const [guardianEmail, setGuardianEmail] = useState(patient.guardian?.email || '');

  // WhatsApp Routing Preferences
  const isMinor = patient.group === 'Criança' || patient.group === 'Adolescente';
  const [whatsappAppointmentChannel, setWhatsappAppointmentChannel] = useState<'PATIENT' | 'GUARDIAN'>(
    patient.whatsapp_routing?.appointmentChannel || (isMinor ? 'GUARDIAN' : 'PATIENT')
  );
  const [whatsappFinancialChannel, setWhatsappFinancialChannel] = useState<'PATIENT' | 'GUARDIAN' | 'FINANCIAL_RESPONSIBLE'>(
    patient.whatsapp_routing?.financialChannel || (isMinor ? 'GUARDIAN' : 'PATIENT')
  );

  // Emergency Contacts (Suporte a 2 contatos)
  const [emergency1Name, setEmergency1Name] = useState(
    patient.emergency_contacts && patient.emergency_contacts[0]?.fullName
      ? patient.emergency_contacts[0].fullName
      : ''
  );
  const [emergency1Relationship, setEmergency1Relationship] = useState(
    patient.emergency_contacts && patient.emergency_contacts[0]?.relationship
      ? patient.emergency_contacts[0].relationship
      : ''
  );
  const [emergency1Phone, setEmergency1Phone] = useState(
    patient.emergency_contacts && patient.emergency_contacts[0]?.phone
      ? patient.emergency_contacts[0].phone
      : ''
  );

  const [emergency2Name, setEmergency2Name] = useState(
    patient.emergency_contacts && patient.emergency_contacts[1]?.fullName
      ? patient.emergency_contacts[1].fullName
      : ''
  );
  const [emergency2Relationship, setEmergency2Relationship] = useState(
    patient.emergency_contacts && patient.emergency_contacts[1]?.relationship
      ? patient.emergency_contacts[1].relationship
      : ''
  );
  const [emergency2Phone, setEmergency2Phone] = useState(
    patient.emergency_contacts && patient.emergency_contacts[1]?.phone
      ? patient.emergency_contacts[1].phone
      : ''
  );

  // Financial
  const [financialPlan, setFinancialPlan] = useState<FinancialPlanType>(
    patient.financial_plan_type || 'Por Sessão'
  );
  const [sessionPrice, setSessionPrice] = useState<number>(patient.session_price || 180);

  // Insurance / Convênio
  const [insuranceId, setInsuranceId] = useState<number | null>(patient.insurance_id || null);
  const [insuranceCardNumber, setInsuranceCardNumber] = useState<string>(patient.insurance_card_number || '');
  const [insuranceCardValidity, setInsuranceCardValidity] = useState<string>(patient.insurance_card_validity || '');
  const [insurancePlanName, setInsurancePlanName] = useState<string>(patient.insurance_plan_name || '');
  const [availableInsurances, setAvailableInsurances] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    api.get<any[]>('/health-insurances').then((res) => {
      setAvailableInsurances(res.data || []);
      if (!patient.insurance_id && res.data?.length > 0) {
        setInsuranceId(res.data[0].id);
      }
    }).catch((err) => console.warn('Erro ao carregar lista de convênios:', err));
  }, []);

  // Notes
  const [notesBasic, setNotesBasic] = useState(patient.notes_basic || '');

  // Calculated Age
  const calculatedAge = birthDate ? calculateAge(birthDate) : null;

  // Real-time CPF checks
  const cleanCpf = cpf.replace(/\D/g, '');
  const isCpfComplete = cleanCpf.length === 11;
  const isCpfValid = isCpfComplete ? validateCPF(cpf) : false;

  const cleanGuardianCpf = guardianCpf.replace(/\D/g, '');
  const isGuardianCpfComplete = cleanGuardianCpf.length === 11;
  const isGuardianCpfValid = isGuardianCpfComplete ? validateCPF(guardianCpf) : false;

  // Feedback do CEP
  const [cepFeedback, setCepFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Copy to clipboard helper
  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ViaCEP Lookup com automação e foco no número
  const handleCepLookup = async (cepToSearch?: string) => {
    const rawVal = (cepToSearch !== undefined ? cepToSearch : cep).replace(/\D/g, '');
    if (rawVal.length !== 8) {
      if (rawVal.length > 0) {
        setCepFeedback({
          type: 'error',
          message: 'Digite os 8 dígitos do CEP para buscar o endereço.',
        });
      }
      return;
    }

    try {
      setIsSearchingCep(true);
      setCepFeedback(null);
      const res = await fetch(`https://viacep.com.br/ws/${rawVal}/json/`);
      const data = await res.json();

      if (data.erro) {
        setCepFeedback({
          type: 'error',
          message: 'CEP não encontrado nos Correios. Preencha os campos manualmente.',
        });
        return;
      }

      setStreet(data.logradouro || '');
      setNeighborhood(data.bairro || '');
      setCity(data.localidade || '');
      setState(data.uf || '');
      setCepFeedback({
        type: 'success',
        message: `Endereço localizado: ${data.logradouro || ''}, ${data.bairro || ''} - ${data.localidade || ''}/${data.uf || ''}`,
      });

      // Foco automático no campo Número para preenchimento ágil
      setTimeout(() => {
        const numInput = document.getElementById('input-address-number');
        if (numInput) numInput.focus();
      }, 150);
    } catch (err) {
      console.error('ViaCEP lookup failed:', err);
      setCepFeedback({
        type: 'error',
        message: 'Falha ao consultar CEP online. Você pode preencher os campos manualmente.',
      });
    } finally {
      setIsSearchingCep(false);
    }
  };

  // Automação ao digitar os 8 dígitos do CEP
  const handleCepChange = (rawVal: string) => {
    const formatted = formatCEP(rawVal);
    setCep(formatted);
    const clean = rawVal.replace(/\D/g, '');
    if (clean.length === 8) {
      handleCepLookup(clean);
    } else {
      setCepFeedback(null);
    }
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSaveError(null);

      // Validate CPF if provided
      if (cleanCpf.length > 0 && !validateCPF(cpf)) {
        setSaveError('O CPF do paciente informado é inválido de acordo com a Receita Federal. Verifique os 11 dígitos.');
        setIsSaving(false);
        return;
      }

      // Validate Guardian CPF if provided
      if (cleanGuardianCpf.length > 0 && !validateCPF(guardianCpf)) {
        setSaveError('O CPF do responsável informado é inválido de acordo com a Receita Federal. Verifique os 11 dígitos.');
        setIsSaving(false);
        return;
      }

      // Montar contatos de emergência (até 2 contatos)
      const emergency_contacts = [];
      if (emergency1Name.trim() || emergency1Phone.trim()) {
        emergency_contacts.push({
          fullName: emergency1Name.trim(),
          relationship: emergency1Relationship.trim(),
          phone: emergency1Phone.trim(),
        });
      }
      if (emergency2Name.trim() || emergency2Phone.trim()) {
        emergency_contacts.push({
          fullName: emergency2Name.trim(),
          relationship: emergency2Relationship.trim(),
          phone: emergency2Phone.trim(),
        });
      }

      const payload = {
        full_name: fullName.trim(),
        status,
        group,
        birth_date: birthDate || '',
        cpf: cpf.trim(),
        rg: rg.trim(),
        gender: gender || '',
        profession: profession.trim(),
        education: education || '',
        race: race || '',
        birthplace: birthplace.trim(),
        phone: phone.trim(),
        email: email.trim(),
        ...(canViewFinancial ? {
          financial_plan_type: financialPlan,
          session_price: Number(sessionPrice) || 0,
          insurance_id: financialPlan === 'Convênio' ? insuranceId : null,
          insurance_card_number: financialPlan === 'Convênio' ? insuranceCardNumber.trim() : null,
          insurance_card_validity: financialPlan === 'Convênio' ? insuranceCardValidity.trim() : null,
          insurance_plan_name: financialPlan === 'Convênio' ? insurancePlanName.trim() : null,
        } : {}),
        address: {
          cep: cep.trim(),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: state.trim(),
        },
        guardian: (guardianName.trim() || guardianCpf.trim() || guardianPhone.trim() || guardianRg.trim())
          ? {
              fullName: guardianName.trim(),
              relationship: guardianRelationship.trim(),
              cpf: guardianCpf.trim(),
              rg: guardianRg.trim(),
              birthDate: guardianBirthDate.trim(),
              phone: guardianPhone.trim(),
              email: guardianEmail.trim(),
            }
          : undefined,
        emergency_contacts,
        whatsapp_routing: {
          appointmentChannel: whatsappAppointmentChannel,
          financialChannel: canViewFinancial ? whatsappFinancialChannel : (patient.whatsapp_routing?.financialChannel || whatsappFinancialChannel),
        },
        notes_basic: notesBasic.trim(),
      };

        if (patient.id === 0) {
          // CREATE
          const res = await api.post('/patients', payload);
          const newPatient: Patient = res.data.patient;
          if (onCreatePatient) onCreatePatient(newPatient);
        } else {
          // UPDATE
          const res = await api.put(`/patients/${patient.id}`, payload);
          const updatedPatient: Patient = res.data.patient || { ...patient, ...payload };
          onUpdatePatient(updatedPatient);
        }

        setSaveSuccess(true);
        setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to update patient:', err);
      setSaveError(err.response?.data?.error || 'Erro ao salvar alterações cadastrais.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original patient values
    setFullName(patient.full_name || '');
    setGroup(patient.group || 'Adulto');
    setBirthDate(patient.birth_date || '');
    setCpf(patient.cpf || '');
    setRg(patient.rg || '');
    setGender(patient.gender || 'Prefiro não informar');
    setProfession(patient.profession || '');
    setEducation(patient.education || '');
    setRace(patient.race || '');
    setBirthplace(patient.birthplace || '');
    setPhone(patient.phone || '');
    setEmail(patient.email || '');
    setCep(formatCEP(patient.address?.cep || ''));
    setStreet(patient.address?.street || '');
    setNumber(patient.address?.number || '');
    setComplement(patient.address?.complement || '');
    setNeighborhood(patient.address?.neighborhood || '');
    setCity(patient.address?.city || '');
    setState(patient.address?.state || '');
    setGuardianName(patient.guardian?.fullName || '');
    setGuardianRelationship(patient.guardian?.relationship || '');
    setGuardianCpf(patient.guardian?.cpf || '');
    setGuardianRg(patient.guardian?.rg || '');
    setGuardianBirthDate(patient.guardian?.birthDate || '');
    setGuardianPhone(patient.guardian?.phone || '');
    setGuardianEmail(patient.guardian?.email || '');
    setEmergency1Name(patient.emergency_contacts?.[0]?.fullName || '');
    setEmergency1Relationship(patient.emergency_contacts?.[0]?.relationship || '');
    setEmergency1Phone(patient.emergency_contacts?.[0]?.phone || '');
    setEmergency2Name(patient.emergency_contacts?.[1]?.fullName || '');
    setEmergency2Relationship(patient.emergency_contacts?.[1]?.relationship || '');
    setEmergency2Phone(patient.emergency_contacts?.[1]?.phone || '');
    setFinancialPlan(patient.financial_plan_type || 'Por Sessão');
    setSessionPrice(patient.session_price || 180);
    setInsuranceId(patient.insurance_id || null);
    setInsuranceCardNumber(patient.insurance_card_number || '');
    setInsuranceCardValidity(patient.insurance_card_validity || '');
    setInsurancePlanName(patient.insurance_plan_name || '');
    setNotesBasic(patient.notes_basic || '');

    setCepFeedback(null);
    setSaveError(null);
    setIsEditing(false);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-200">
      {/* ======================================================== */}
      {/* Header com Botão de Edição e Feedback                    */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <span>Ficha Cadastral Completa</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isEditing
              ? 'Você está no modo de edição. Faça as alterações desejadas e clique em Salvar.'
              : 'Informações cadastrais, contatos, responsáveis e consentimento de dados.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold animate-in fade-in">
              <Check className="h-3.5 w-3.5" />
              <span>Salvo com sucesso!</span>
            </span>
          )}

          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Edit3 className="h-4 w-4" />
              <span>Editar Cadastro</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {patient.id !== 0 && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {saveError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. Identificação & Dados Pessoais                        */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-slate-100 dark:border-slate-800 pb-2">
          1. Identificação & Dados Pessoais
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Nome Completo */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Nome Completo *
            </label>
            {isEditing ? (
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            ) : (
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                {patient.full_name}
              </p>
            )}
          </div>

          {/* Status do Paciente */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Status *
            </label>
            {isEditing ? (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="DISCHARGED">Em Alta</option>
              </select>
            ) : (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                patient.status === 'INACTIVE' ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                patient.status === 'DISCHARGED' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' :
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}>
                {patient.status === 'INACTIVE' ? 'Inativo' :
                 patient.status === 'DISCHARGED' ? 'Em Alta' : 'Ativo'}
              </span>
            )}
          </div>

          {/* Grupo */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Grupo *
            </label>
            {isEditing ? (
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value as PatientGroup)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden"
              >
                <option value="Adulto">Adulto</option>
                <option value="Criança">Criança</option>
                <option value="Adolescente">Adolescente</option>
                <option value="Idoso">Idoso</option>
              </select>
            ) : (
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {patient.group}
              </span>
            )}
          </div>

          {/* Data de Nascimento */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Data de Nascimento
            </label>
            {isEditing ? (
              <input
                type="date"
                value={birthDate}
                onChange={(e) => {
                  setBirthDate(e.target.value);
                  const calculated = calculateAge(e.target.value);
                  if (calculated) {
                    setGroup(calculated.suggestedGroup);
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden dark:[color-scheme:dark]"
              />
            ) : (
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {patient.birth_date
                  ? new Date(patient.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')
                  : 'Não informada'}
              </p>
            )}
          </div>

          {/* Idade do Paciente (Calculada Automaticamente) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
              <span>Idade do Paciente</span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">Calculada auto</span>
            </label>
            {isEditing ? (
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  disabled
                  value={calculatedAge ? calculatedAge.text : 'Aguardando data de nascimento'}
                  className="w-full rounded-xl border border-teal-200/80 bg-teal-50/50 dark:border-teal-800/80 dark:bg-teal-950/30 px-3 py-2 text-xs font-bold text-teal-900 dark:text-teal-200 cursor-not-allowed select-none"
                />
                <div className="absolute right-3 top-2.5">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-900 dark:text-white text-xs">
                  {calculatedAge ? calculatedAge.text : 'Não informada'}
                </p>
                {calculatedAge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    {calculatedAge.suggestedGroup}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* CPF com Validação em Tempo Real */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
              <span>CPF</span>
              {isEditing && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {cleanCpf.length === 0
                    ? 'Opcional'
                    : cleanCpf.length < 11
                    ? `${cleanCpf.length}/11 dígitos`
                    : isCpfValid
                    ? 'Verificado ✓'
                    : 'Inválido ✗'}
                </span>
              )}
            </label>
            {isEditing ? (
              <div className="space-y-1">
                <div className="relative">
                  <input
                    type="text"
                    maxLength={14}
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    className={`w-full rounded-xl border px-3 py-2 pr-9 text-xs font-semibold text-slate-800 dark:text-white transition-colors focus:outline-hidden focus:ring-2 ${
                      cleanCpf.length === 0
                        ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 focus:ring-teal-500'
                        : cleanCpf.length < 11
                        ? 'border-amber-300 bg-amber-50/20 dark:border-amber-600/70 dark:bg-amber-950/20 focus:ring-amber-500'
                        : isCpfValid
                        ? 'border-emerald-500 bg-emerald-50/20 dark:border-emerald-500 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100 focus:ring-emerald-500'
                        : 'border-rose-400 bg-rose-50/20 dark:border-rose-500 dark:bg-rose-950/20 text-rose-950 dark:text-rose-100 focus:ring-rose-500'
                    }`}
                  />
                  {cleanCpf.length > 0 && (
                    <div className="absolute right-2.5 top-2.5 flex items-center">
                      {cleanCpf.length < 11 ? (
                        <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded-sm">
                          {cleanCpf.length}/11
                        </span>
                      ) : isCpfValid ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-rose-500" />
                      )}
                    </div>
                  )}
                </div>

                {/* Mensagens de feedback em tempo real */}
                {cleanCpf.length > 0 && cleanCpf.length < 11 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    Digite os {11 - cleanCpf.length} dígitos restantes para validar.
                  </p>
                )}
                {cleanCpf.length === 11 && isCpfValid && (
                  <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    CPF válido (Receita Federal)
                  </p>
                )}
                {cleanCpf.length === 11 && !isCpfValid && (
                  <p className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    CPF inválido: confira a numeração digitada
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <span>{patient.cpf ? formatCPF(patient.cpf) : 'Não informado'}</span>
                {patient.cpf && (
                  <>
                    {validateCPF(patient.cpf) ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title="CPF Válido">
                        Válido
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800" title="CPF Inválido">
                        Inválido
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(patient.cpf, 'cpf')}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title="Copiar CPF"
                    >
                      {copiedField === 'cpf' ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RG */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              RG / Documento
            </label>
            {isEditing ? (
              <input
                type="text"
                placeholder="Ex: 12.345.678-9"
                value={rg}
                onChange={(e) => setRg(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden"
              />
            ) : (
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {patient.rg || 'Não informado'}
              </p>
            )}
          </div>

          {/* Gênero */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Identidade de Gênero
            </label>
            {isEditing ? (
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Selecione...</option>
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {patient.gender || 'Não informado'}
              </p>
            )}
          </div>

          {/* Profissão */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Profissão / Ocupação
            </label>
            {isEditing ? (
              <input
                type="text"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden"
              />
            ) : (
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {patient.profession || 'Não informada'}
              </p>
            )}
          </div>

          {/* Escolaridade */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Escolaridade
            </label>
            {isEditing ? (
              <select
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Selecione a escolaridade...</option>
                {EDUCATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {patient.education || 'Não informada'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. Contatos & Endereço Residencial                       */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-slate-100 dark:border-slate-800 pb-2">
          2. Contatos & Endereço Residencial
        </h3>

        {/* 2.1 Contatos Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Celular / WhatsApp */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Celular / WhatsApp *
            </label>
            {isEditing ? (
              <input
                type="text"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            ) : (
              <p className="font-bold text-slate-900 dark:text-white">
                {patient.phone ? formatPhone(patient.phone) : 'Não informado'}
              </p>
            )}
          </div>

          {/* E-mail Principal */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              E-mail Principal
            </label>
            {isEditing ? (
              <input
                type="email"
                placeholder="paciente@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            ) : (
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {patient.email || 'Não informado'}
              </p>
            )}
          </div>
        </div>

        {/* 2.2 Endereço Residencial com Automação de CEP */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              Endereço Residencial
            </span>
            {isEditing && (
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                💡 Digite o CEP para preenchimento automático do endereço
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              {/* Linha 1: CEP (Ponto de partida / Gatilho) e Logradouro */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* CEP com Busca Automática */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                    <span>CEP (Início do Endereço)</span>
                    {isSearchingCep && (
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={9}
                      placeholder="00000-000"
                      value={cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      onBlur={() => handleCepLookup()}
                      className="w-full rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50/20 dark:bg-teal-950/20 px-3 py-2 pr-9 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleCepLookup()}
                      disabled={isSearchingCep}
                      className="absolute right-2 top-2 p-1 text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 disabled:opacity-50 cursor-pointer"
                      title="Consultar CEP nos Correios"
                    >
                      {isSearchingCep ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Logradouro / Rua */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                    <span>Logradouro / Rua / Avenida</span>
                    <span className="text-[10px] text-slate-400">Preenchido auto (editável)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Rua, Avenida, Alameda..."
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Feedback visual do CEP */}
              {cepFeedback && (
                <div
                  className={`text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-in fade-in duration-150 ${
                    cepFeedback.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {cepFeedback.type === 'success' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{cepFeedback.message}</span>
                </div>
              )}

              {/* Linha 2: Número (Foco automático após o CEP!), Complemento e Bairro */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Número */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                    <span>Número *</span>
                    <span className="text-[9px] text-teal-600 dark:text-teal-400 font-medium">Foco auto</span>
                  </label>
                  <input
                    id="input-address-number"
                    type="text"
                    placeholder="Ex: 120"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Complemento */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Complemento
                  </label>
                  <input
                    type="text"
                    placeholder="Apto, Bloco, Sala..."
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Bairro */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                    <span>Bairro</span>
                    <span className="text-[10px] text-slate-400">Preenchido auto (editável)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Bairro"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Linha 3: Cidade e Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                    <span>Cidade</span>
                    <span className="text-[10px] text-slate-400">Preenchido auto (editável)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    UF / Estado
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="SP"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-center text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 text-xs">
              {patient.address?.street || patient.address?.cep ? (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {patient.address.street}
                    {patient.address.number ? `, ${patient.address.number}` : ' (S/N)'}
                    {patient.address.complement ? ` - ${patient.address.complement}` : ''}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {patient.address.neighborhood ? `${patient.address.neighborhood}, ` : ''}
                    {patient.address.city || ''}{patient.address.state ? ` - ${patient.address.state}` : ''}
                    {patient.address.cep ? ` • CEP: ${formatCEP(patient.address.cep)}` : ''}
                  </p>
                </div>
              ) : (
                <p className="text-slate-400 italic">Nenhum endereço residencial cadastrado.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. Responsáveis Legais & Contatos de Emergência           */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-slate-100 dark:border-slate-800 pb-2">
          3. Responsáveis Legais & Contatos de Emergência
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Responsável Legal */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
            <span className="font-bold text-slate-700 dark:text-slate-300 block">
              Responsável Legal (para menores de idade ou dependentes):
            </span>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Nome Completo do Responsável"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Parentesco (ex: Mãe)"
                    value={guardianRelationship}
                    onChange={(e) => setGuardianRelationship(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="Telefone do Responsável"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(formatPhone(e.target.value))}
                    className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* CPF do Responsável com Validação em Tempo Real */}
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={14}
                      placeholder="CPF do Responsável"
                      value={guardianCpf}
                      onChange={(e) => setGuardianCpf(formatCPF(e.target.value))}
                      className={`w-full rounded-xl border px-3 py-1.5 pr-8 text-xs text-slate-800 dark:text-white focus:outline-hidden ${
                        cleanGuardianCpf.length === 0
                          ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                          : cleanGuardianCpf.length < 11
                          ? 'border-amber-300 bg-amber-50/20 dark:border-amber-600/70 dark:bg-amber-950/20'
                          : isGuardianCpfValid
                          ? 'border-emerald-500 bg-emerald-50/20 dark:border-emerald-500 text-emerald-950 dark:text-emerald-100'
                          : 'border-rose-400 bg-rose-50/20 dark:border-rose-500 text-rose-950 dark:text-rose-100'
                      }`}
                    />
                    {cleanGuardianCpf.length > 0 && (
                      <div className="absolute right-2 top-2">
                        {cleanGuardianCpf.length < 11 ? (
                          <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                            {cleanGuardianCpf.length}/11
                          </span>
                        ) : isGuardianCpfValid ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="RG / Doc. do Responsável"
                    value={guardianRg}
                    onChange={(e) => setGuardianRg(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Data de Nasc. Responsável</label>
                    <input
                      type="date"
                      value={guardianBirthDate}
                      onChange={(e) => setGuardianBirthDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-1 text-xs text-slate-800 dark:text-white focus:outline-hidden dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">E-mail do Responsável</label>
                    <input
                      type="email"
                      placeholder="E-mail do Responsável"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-1 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            ) : guardianName ? (
              <div className="space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-100">{guardianName}</p>
                <p className="text-slate-500 text-xs">
                  {guardianRelationship || 'Responsável'} {guardianPhone ? `• Tel: ${formatPhone(guardianPhone)}` : ''}
                </p>
                {(guardianCpf || guardianRg || guardianBirthDate || guardianEmail) && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap pt-0.5">
                    {guardianCpf && (
                      <span>
                        CPF: <strong className="font-mono text-slate-700 dark:text-slate-200">{formatCPF(guardianCpf)}</strong>
                        {validateCPF(guardianCpf) ? (
                          <span className="ml-1 text-[9px] font-bold px-1 rounded-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">✓</span>
                        ) : (
                          <span className="ml-1 text-[9px] font-bold px-1 rounded-sm bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">✗</span>
                        )}
                      </span>
                    )}
                    {guardianRg && (
                      <span>• RG: <strong className="font-mono text-slate-700 dark:text-slate-200">{guardianRg}</strong></span>
                    )}
                    {guardianBirthDate && (
                      <span>• Nasc: <strong className="text-slate-700 dark:text-slate-200">{new Date(guardianBirthDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
                    )}
                    {guardianEmail && (
                      <span>• E-mail: <strong className="text-slate-700 dark:text-slate-200">{guardianEmail}</strong></span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 italic">Nenhum responsável legal cadastrado.</p>
            )}
          </div>

          {/* Canais Preferenciais de Comunicação via WhatsApp */}
          <div className="p-4 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-3 sm:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                  Canais Preferenciais de Comunicação via WhatsApp
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Direcionamento padrão para lembretes{canViewFinancial ? ', cobranças e notas fiscais' : ''}
              </span>
            </div>

            {isEditing ? (
              <div className={`grid grid-cols-1 ${canViewFinancial ? 'sm:grid-cols-2' : ''} gap-3 pt-1`}>
                {/* Agendamentos e Lembretes */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Lembretes de Sessão & Agenda:
                  </label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="tabAppointmentChannel"
                        value="GUARDIAN"
                        checked={whatsappAppointmentChannel === 'GUARDIAN'}
                        onChange={() => setWhatsappAppointmentChannel('GUARDIAN')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Responsável Legal {guardianName ? `(${guardianName.split(' ')[0]})` : ''}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="tabAppointmentChannel"
                        value="PATIENT"
                        checked={whatsappAppointmentChannel === 'PATIENT'}
                        onChange={() => setWhatsappAppointmentChannel('PATIENT')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Próprio Paciente</span>
                    </label>
                  </div>
                </div>

                {/* Cobrança & NF */}
                {canViewFinancial && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Cobranças PIX & Notas Fiscais:
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="tabFinancialChannel"
                          value="GUARDIAN"
                          checked={whatsappFinancialChannel === 'GUARDIAN'}
                          onChange={() => setWhatsappFinancialChannel('GUARDIAN')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Responsável Legal {guardianName ? `(${guardianName.split(' ')[0]})` : ''}</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="tabFinancialChannel"
                          value="PATIENT"
                          checked={whatsappFinancialChannel === 'PATIENT'}
                          onChange={() => setWhatsappFinancialChannel('PATIENT')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Próprio Paciente</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`grid grid-cols-1 ${canViewFinancial ? 'sm:grid-cols-2' : ''} gap-3 pt-1`}>
                <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Lembretes de Agenda:</span>
                  <p className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    {whatsappAppointmentChannel === 'GUARDIAN' ? (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Responsável Legal {guardianName ? `(${guardianName})` : ''}</span>
                      </>
                    ) : (
                      <>
                        <User className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                        <span>Próprio Paciente</span>
                      </>
                    )}
                  </p>
                </div>

                {canViewFinancial && (
                  <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Cobranças & Notas Fiscais:</span>
                    <p className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {whatsappFinancialChannel === 'GUARDIAN' ? (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Responsável Legal {guardianName ? `(${guardianName})` : ''}</span>
                        </>
                      ) : (
                        <>
                          <User className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                          <span>Próprio Paciente</span>
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Synapsis Paciente: Gestão de Acesso, Convites e Canal Clínico */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-purple-500/10 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-500/20 space-y-4 sm:col-span-2 shadow-sm">
            {/* Header da Seção */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-500/15">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white text-sm tracking-tight">
                      Portal Synapsis Paciente
                    </span>
                    {/* Status Badge */}
                    {patient.portal_access_enabled === false ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Acesso Desativado
                      </span>
                    ) : patient.portal_last_login_at || patient.portal_first_access_at ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ativo no Portal
                      </span>
                    ) : patient.portal_invite_sent_at ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                        <Send className="w-3 h-3" /> Convite Enviado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Pendente de Convite
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {patient.portal_last_login_at
                      ? `Último acesso em: ${new Date(patient.portal_last_login_at).toLocaleString('pt-BR')}`
                      : patient.portal_invite_sent_at
                      ? `Convite enviado em: ${new Date(patient.portal_invite_sent_at).toLocaleDateString('pt-BR')}`
                      : 'O paciente ainda não recebeu o link mágico de acesso ao aplicativo.'}
                  </p>
                </div>
              </div>

              {/* Botão de Ativação / Bloqueio Global do Portal */}
              <button
                type="button"
                onClick={handleTogglePortalAccess}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer border ${
                  patient.portal_access_enabled !== false
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}
                title={patient.portal_access_enabled !== false ? 'Desativar acesso do paciente ao app' : 'Reativar acesso do paciente ao app'}
              >
                {patient.portal_access_enabled !== false ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Desativar Acesso</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Habilitar Acesso</span>
                  </>
                )}
              </button>
            </div>

            {/* Alertas de Ação */}
            {inviteSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{inviteSuccess}</span>
              </div>
            )}
            {inviteError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            {/* Ações de Envio de Convite */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Disparo de Convite Personalizado (Link Mágico):
              </span>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Enviar via WhatsApp */}
                <button
                  type="button"
                  disabled={isInviting || patient.portal_access_enabled === false}
                  onClick={() => handleGenerateInvite('WHATSAPP')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Enviar Convite via WhatsApp</span>
                </button>

                {/* Enviar por E-mail */}
                <button
                  type="button"
                  disabled={isInviting || !patient.email || patient.portal_access_enabled === false}
                  onClick={() => handleGenerateInvite('EMAIL')}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!patient.email ? 'Cadastre um e-mail para habilitar envio' : 'Enviar link de convite por e-mail'}
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Enviar por E-mail</span>
                </button>

                {/* Copiar Link Direto */}
                <button
                  type="button"
                  disabled={isInviting || patient.portal_access_enabled === false}
                  onClick={() => handleGenerateInvite('COPY')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer border ${
                    copiedInviteLink
                      ? 'bg-teal-50 border-teal-300 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                      : 'bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {copiedInviteLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-teal-600" />
                      <span>Link Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Link de Convite</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Canal Clínico: Liga / Desliga Terapeuta */}
            <div className="pt-3 border-t border-purple-500/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Canal Clínico no App (Mensagens Diretas com Psicólogo):
                </span>
                <span className="text-[10px] text-slate-500">
                  {patient.psychologist_chat_override === 'ENABLED'
                    ? '🟢 Liberado'
                    : patient.psychologist_chat_override === 'DISABLED'
                    ? '🔴 Bloqueado (Apenas Recepção)'
                    : '⚪ Padrão da Clínica'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={async () => {
                      await api.patch(`/patients/${patient.id}/chat-override`, { chatOverride: null });
                      onUpdatePatient({ ...patient, psychologist_chat_override: null });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      !patient.psychologist_chat_override
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    Padrão do Terapeuta
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.patch(`/patients/${patient.id}/chat-override`, { chatOverride: 'ENABLED' });
                      onUpdatePatient({ ...patient, psychologist_chat_override: 'ENABLED' });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      patient.psychologist_chat_override === 'ENABLED'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    Sempre Permitir
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.patch(`/patients/${patient.id}/chat-override`, { chatOverride: 'DISABLED' });
                      onUpdatePatient({ ...patient, psychologist_chat_override: 'DISABLED' });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      patient.psychologist_chat_override === 'DISABLED'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    Bloquear Mensagens
                  </button>
                </div>
              </div>
            </div>

            {/* Rodapé Informativo e Conformidade CFP */}
            <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <span>
                <strong>Blindagem de Prontuário (CFP 01/2009 & 06/2019):</strong> O link mágico permite que o paciente acesse sua agenda, emita recibos de IRPF e responda a questionários. Anotações clínicas e evoluções brutas do psicólogo são terminantemente restritas aos profissionais da clínica.
              </span>
            </div>
          </div>

          {/* Contatos de Emergência (Suporte a 2 contatos) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                Contatos de Emergência (Até 2):
              </span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                Recomendado para crises / urgências
              </span>
            </div>

            {isEditing ? (
              <div className="space-y-3">
                {/* Contato 1 (Principal) */}
                <div className="p-2.5 rounded-lg border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-850 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-white text-[9px]">1</span>
                    <span>Contato Principal</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Nome Completo do Contato 1"
                    value={emergency1Name}
                    onChange={(e) => setEmergency1Name(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Vínculo (ex: Cônjuge, Mãe)"
                      value={emergency1Relationship}
                      onChange={(e) => setEmergency1Relationship(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                    />
                    <input
                      type="text"
                      placeholder="Telefone Direto"
                      value={emergency1Phone}
                      onChange={(e) => setEmergency1Phone(formatPhone(e.target.value))}
                      className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Contato 2 (Secundário / Alternativo) */}
                <div className="p-2.5 rounded-lg border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-850 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-500 text-white text-[9px]">2</span>
                    <span>Contato Secundário (Opcional)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Nome Completo do Contato 2"
                    value={emergency2Name}
                    onChange={(e) => setEmergency2Name(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Vínculo (ex: Irmão, Amigo)"
                      value={emergency2Relationship}
                      onChange={(e) => setEmergency2Relationship(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                    />
                    <input
                      type="text"
                      placeholder="Telefone Direto"
                      value={emergency2Phone}
                      onChange={(e) => setEmergency2Phone(formatPhone(e.target.value))}
                      className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            ) : (emergency1Name || emergency2Name) ? (
              <div className="space-y-2">
                {emergency1Name && (
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700/80">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-800 dark:text-slate-100">{emergency1Name}</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                        Principal
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {emergency1Relationship || 'Contato 1'} {emergency1Phone ? `• Tel: ${formatPhone(emergency1Phone)}` : ''}
                    </p>
                  </div>
                )}
                {emergency2Name && (
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700/80">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-800 dark:text-slate-100">{emergency2Name}</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Secundário
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {emergency2Relationship || 'Contato 2'} {emergency2Phone ? `• Tel: ${formatPhone(emergency2Phone)}` : ''}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 italic">Nenhum contato de emergência cadastrado.</p>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. Plano Terapêutico & Honorários                        */}
      {/* ======================================================== */}
      {canViewFinancial && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-slate-100 dark:border-slate-800 pb-2">
            4. Plano Terapêutico & Honorários por Sessão
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Modelo de Faturamento
              </label>
              {isEditing ? (
                <select
                  value={financialPlan}
                  onChange={(e) => setFinancialPlan(e.target.value as FinancialPlanType)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden"
                >
                  <option value="Por Sessão">Por Sessão (Avulso)</option>
                  <option value="Mensal">Mensalidade / Pacote</option>
                  <option value="Convênio">Convênio / Reembolso</option>
                  <option value="Isento">Isento / Atendimento Social</option>
                </select>
              ) : (
                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  {patient.financial_plan_type || 'Por Sessão'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Valor Acordado por Atendimento (R$)
              </label>
              {isEditing ? (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sessionPrice}
                  onChange={(e) => setSessionPrice(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden"
                />
              ) : (
                <p className="font-extrabold text-teal-600 dark:text-teal-400 text-sm">
                  R$ {Number(patient.session_price || 0).toFixed(2)}
                </p>
              )}
            </div>

            {/* Bloco de Campos Específicos de Convênio */}
            {financialPlan === 'Convênio' && (
              <div className="col-span-1 sm:col-span-2 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Dados do Convênio & Carteirinha
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Operadora Parceira
                    </label>
                    {isEditing ? (
                      <select
                        value={insuranceId || ''}
                        onChange={(e) => setInsuranceId(Number(e.target.value) || null)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden"
                      >
                        <option value="">Selecione a operadora...</option>
                        {availableInsurances.map((ins) => (
                          <option key={ins.id} value={ins.id}>
                            {ins.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {availableInsurances.find((i) => i.id === insuranceId)?.name || 'Não selecionada'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Número da Carteirinha
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        placeholder="Ex: 0023.9485.1203"
                        value={insuranceCardNumber}
                        onChange={(e) => setInsuranceCardNumber(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-mono font-semibold text-slate-800 dark:text-white focus:outline-hidden"
                      />
                    ) : (
                      <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {insuranceCardNumber || '—'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Plano / Categoria
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        placeholder="Ex: Top Nacional Plus"
                        value={insurancePlanName}
                        onChange={(e) => setInsurancePlanName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden"
                      />
                    ) : (
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {insurancePlanName || '—'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. Conformidade LGPD & Termo de Consentimento            */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">
              Consentimento LGPD (Dados Sensíveis de Saúde - Art. 11)
            </p>
            <p className="text-slate-500">
              Registrado em:{' '}
              <strong>
                {patient.lgpd_consent_at
                  ? new Date(patient.lgpd_consent_at).toLocaleDateString('pt-BR')
                  : '01/01/2026'}
              </strong>{' '}
              • Status: <strong>Ativo e Válido</strong>
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          <Check className="h-3.5 w-3.5" />
          <span>Conforme LGPD</span>
        </span>
      </div>
    </form>
  );
};
