const PATIENT_TOKEN_KEY = 'synapsis_patient_token';
const PATIENT_DATA_KEY = 'synapsis_patient_data';

export interface PatientUser {
  id: number;
  name: string;
  cpf: string;
  isGuardian?: boolean;
}

export interface Dependent {
  id: number;
  full_name: string;
  birth_date?: string;
  group_type?: string;
  is_titular?: boolean;
}

async function patientRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(PATIENT_TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api/patient${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem(PATIENT_TOKEN_KEY);
    localStorage.removeItem(PATIENT_DATA_KEY);
    window.dispatchEvent(new Event('patient_session_expired'));
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { error: text || `Erro ${response.status}: ${response.statusText}` };
  }

  if (!response.ok) {
    throw new Error(data.error || `Erro ${response.status}: Ocorreu um erro ao processar sua requisição.`);
  }

  return data;
}

export const patientApi = {
  getToken(): string | null {
    return localStorage.getItem(PATIENT_TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(PATIENT_TOKEN_KEY, token);
  },

  getStoredPatient(): PatientUser | null {
    const raw = localStorage.getItem(PATIENT_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  setStoredPatient(patient: PatientUser) {
    localStorage.setItem(PATIENT_DATA_KEY, JSON.stringify(patient));
  },

  logout() {
    localStorage.removeItem(PATIENT_TOKEN_KEY);
    localStorage.removeItem(PATIENT_DATA_KEY);
  },

  request: patientRequest,

  // --- FLUXO DE CONVITE (MAGIC LINK) ---
  async verifyInvite(inviteToken: string) {
    return patientRequest<{
      valid: boolean;
      patient: {
        id: number;
        fullName: string;
        firstName: string;
        phoneMasked: string;
        email: string;
        hasPin: boolean;
        isFirstAccess: boolean;
      };
    }>('/auth/verify-invite', {
      method: 'POST',
      body: JSON.stringify({ inviteToken }),
    });
  },

  async setInitialPin(inviteToken: string, pin: string) {
    const data = await patientRequest<{
      token: string;
      patient: PatientUser;
      hasPin: boolean;
      dependents: Dependent[];
    }>('/auth/set-initial-pin', {
      method: 'POST',
      body: JSON.stringify({ inviteToken, pin }),
    });
    this.setToken(data.token);
    this.setStoredPatient(data.patient);
    return data;
  },

  // --- AUTENTICAÇÃO ---
  async requestOtp(cpf: string) {
    return patientRequest('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ cpf }),
    });
  },

  async verifyOtp(cpf: string, otpCode: string) {
    const data = await patientRequest<{
      token: string;
      patient: PatientUser;
      hasPin: boolean;
      dependents: Dependent[];
      devOtp?: string;
      phoneMasked?: string;
    }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ cpf, otpCode }),
    });
    this.setToken(data.token);
    this.setStoredPatient(data.patient);
    return data;
  },

  async verifyPin(cpf: string, pin: string) {
    const data = await patientRequest<{
      token: string;
      patient: PatientUser;
      hasPin: boolean;
      dependents: Dependent[];
    }>('/auth/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ cpf, pin }),
    });
    this.setToken(data.token);
    this.setStoredPatient(data.patient);
    return data;
  },

  async setPin(pin: string) {
    return patientRequest('/auth/set-pin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  },

  async switchDependent(dependentId: number) {
    const data = await patientRequest<{
      token: string;
      activeDependent: { id: number; name: string };
    }>('/switch-dependent', {
      method: 'POST',
      body: JSON.stringify({ dependentId }),
    });
    this.setToken(data.token);
    const stored = this.getStoredPatient();
    if (stored) {
      this.setStoredPatient({
        ...stored,
        id: data.activeDependent.id,
        name: data.activeDependent.name,
      });
    }
    return data;
  },

  async getProfile() {
    return patientRequest('/profile');
  },

  // --- AGENDA ---
  async getAppointments() {
    return patientRequest('/appointments');
  },

  async confirmAppointment(id: number) {
    return patientRequest(`/appointments/${id}/confirm`, {
      method: 'POST',
    });
  },

  async getAvailableSlots() {
    return patientRequest('/available-slots');
  },

  async rescheduleAppointment(id: number, newStartTime: string, newEndTime: string, reason?: string) {
    return patientRequest(`/appointments/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ newStartTime, newEndTime, reason }),
    });
  },

  async cancelAppointment(id: number, reason?: string) {
    return patientRequest(`/appointments/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // --- FINANCEIRO ---
  async getFinancial() {
    return patientRequest('/financial');
  },

  // --- DOCUMENTOS ---
  async getDocuments() {
    return patientRequest('/documents');
  },

  // --- ATIVIDADES E ESCALAS ---
  async getActivities() {
    return patientRequest('/activities');
  },

  async submitActivity(id: number, responseJson: any) {
    return patientRequest(`/activities/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ responseJson }),
    });
  },

  // --- MENSAGENS ---
  async getMessagesStatus() {
    return patientRequest('/messages/status');
  },

  async getMessages(channel: 'ADMINISTRATIVE' | 'CLINICAL') {
    return patientRequest(`/messages?channel=${channel}`);
  },

  async sendMessage(channelType: 'ADMINISTRATIVE' | 'CLINICAL', messageText: string) {
    return patientRequest('/messages', {
      method: 'POST',
      body: JSON.stringify({ channelType, messageText }),
    });
  },
};
