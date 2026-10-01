import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api.js';
import { Session, Patient, AgendaEvent, Room, RoomAvailability } from '../types.js';
import { useAuth } from '../context/AuthContext.js';
import { useAcademy } from '../context/AcademyContext.js';
import { MOCK_SANDBOX_PATIENTS } from './academy/mockData.js';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Clock,
  Video,
  Building,
  ThumbsUp,
  CheckCircle,
  XCircle,
  DollarSign,
  MessageCircle,
  PlayCircle,
  Filter,
  User,
  Trash2,
  X,
  Sparkles,
  CalendarDays,
  CalendarRange,
  Eye,
  AlertTriangle,
  Phone,
  FileText,
  Repeat,
  ListOrdered,
  UserPlus,
  Pencil,
  ArrowLeft,
  Save,
  CalendarClock,
  UserX,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ExternalLink,
  Brain,
} from 'lucide-react';
import { WhatsAppSessionReminderModal } from './whatsapp/WhatsAppSessionReminderModal.js';
import { PrepaidReallocationModal } from './calendar/PrepaidReallocationModal.js';

interface AgendaProps {
  onStartSession: (patientId: number, sessionId: number) => void;
  onNavigateToFinancial?: (subTab: 'revenues' | 'expenses') => void;
  onNavigateToPatient?: (patientId: number, tab?: 'overview' | 'profile' | 'clinical' | 'financial' | 'insurance') => void;
}

type ViewMode = 'month' | 'week' | 'day';

// Color palettes for sessions (matching PsicoManager vibrant cards)
const SESSION_PALETTES = [
  'bg-fuchsia-600 text-white dark:bg-fuchsia-600', // Magenta
  'bg-sky-600 text-white dark:bg-sky-600',         // Sky blue
  'bg-emerald-600 text-white dark:bg-emerald-600', // Emerald green
  'bg-indigo-600 text-white dark:bg-indigo-600',   // Indigo/Purple
  'bg-lime-700 text-white dark:bg-lime-700',       // Olive
  'bg-orange-600 text-white dark:bg-orange-600',   // Coral
  'bg-slate-600 text-white dark:bg-slate-600',     // Taupe
  'bg-teal-600 text-white dark:bg-teal-600',       // Teal
  'bg-violet-600 text-white dark:bg-violet-600',   // Violet
];

// Helper to pick deterministic color by patient name
function getSessionColor(patientName: string, status: string): { bgClass: string; isCancelled: boolean } {
  if (
    status === 'CANCELED' ||
    status === 'NO_SHOW' ||
    status === 'CANCELED_BY_PATIENT' ||
    status === 'CANCELED_BY_PSYCHOLOGIST'
  ) {
    return {
      bgClass: 'bg-[#fff5f5] text-[#e11d48] border border-rose-300 dark:bg-[#3d1a24] dark:text-rose-300 dark:border-rose-900/60 line-through',
      isCancelled: true,
    };
  }
  let hash = 0;
  for (let i = 0; i < patientName.length; i++) {
    hash = patientName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SESSION_PALETTES.length;
  return { bgClass: SESSION_PALETTES[index], isCancelled: false };
}

const getRoomInitials = (session: { room_initials?: string | null; room_name?: string | null }): string => {
  if (session.room_initials && session.room_initials.trim()) {
    return session.room_initials.trim().toUpperCase();
  }
  if (!session.room_name) return '';
  const match = session.room_name.match(/(?:Consultório|Sala)\s*(\d+)/i);
  if (match) return `C${match[1]}`;
  const numMatch = session.room_name.match(/\d+/);
  if (numMatch) return `C${numMatch[0]}`;
  return session.room_name.slice(0, 3).toUpperCase();
};

interface HoverCardData {
  session: Session;
  rect: { x: number; y: number; width: number; height: number };
  overlapInfo?: { colIndex: number; totalCols: number };
}

interface PositionedSession {
  session: Session;
  colIndex: number;
  totalCols: number;
}

/**
 * Intelligent Calendar Overlap Collision Algorithm (Standard Google Calendar / Outlook layout)
 * Groups overlapping sessions in a day into clusters and packs them into side-by-side subcolumns.
 */
function calculateSessionOverlapLayout(daySessions: Session[]): PositionedSession[] {
  if (daySessions.length === 0) return [];
  if (daySessions.length === 1) {
    return [{ session: daySessions[0], colIndex: 0, totalCols: 1 }];
  }

  // 1. Sort by start time asc, then duration desc (longer first), then ID asc
  const sorted = [...daySessions].sort((a, b) => {
    const startA = new Date(a.start_time).getTime();
    const startB = new Date(b.start_time).getTime();
    if (startA !== startB) return startA - startB;
    const durA = new Date(a.end_time).getTime() - startA;
    const durB = new Date(b.end_time).getTime() - startB;
    if (durA !== durB) return durB - durA;
    return a.id - b.id;
  });

  // 2. Group into contiguous overlapping clusters (connected components)
  const clusters: Session[][] = [];
  let currentCluster: Session[] = [];
  let clusterEnd = 0;

  for (const session of sorted) {
    const start = new Date(session.start_time).getTime();
    const end = new Date(session.end_time).getTime();

    if (currentCluster.length === 0) {
      currentCluster.push(session);
      clusterEnd = end;
    } else if (start < clusterEnd) {
      // Overlaps with current cluster
      currentCluster.push(session);
      clusterEnd = Math.max(clusterEnd, end);
    } else {
      // New independent cluster
      clusters.push(currentCluster);
      currentCluster = [session];
      clusterEnd = end;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // 3. Within each cluster, pack sessions into the first non-colliding column
  const positioned: PositionedSession[] = [];

  for (const cluster of clusters) {
    const colEndTimes: number[] = [];
    const placedInCluster: { session: Session; colIndex: number }[] = [];

    for (const session of cluster) {
      const start = new Date(session.start_time).getTime();
      const end = new Date(session.end_time).getTime();

      let assignedCol = -1;
      for (let i = 0; i < colEndTimes.length; i++) {
        if (colEndTimes[i] <= start) {
          assignedCol = i;
          colEndTimes[i] = end;
          break;
        }
      }

      if (assignedCol === -1) {
        assignedCol = colEndTimes.length;
        colEndTimes.push(end);
      }

      placedInCluster.push({ session, colIndex: assignedCol });
    }

    const totalCols = colEndTimes.length;
    for (const item of placedInCluster) {
      positioned.push({
        session: item.session,
        colIndex: item.colIndex,
        totalCols,
      });
    }
  }

  return positioned;
}

const HOURS_GRID = Array.from({ length: 19 }, (_, i) => i + 6); // 06:00 to 24:00
const SLOT_HEIGHT = 64; // px per hour

export const Agenda: React.FC<AgendaProps> = ({
  onStartSession,
  onNavigateToFinancial,
  onNavigateToPatient,
}) => {
  const { user, isAdmin, hasPermission, canAccessClinical, isSecretary, clinicSettings, isModuleEnabled } = useAuth();
  const canViewFinancial = isAdmin || Boolean(hasPermission('view_financial'));
  const canCreatePatients = isAdmin || Boolean(hasPermission('create_patients'));
  const canCreateAppointments = isAdmin || Boolean(hasPermission('create_appointments')) || isSecretary;
  const isRoomsEnabled = isModuleEnabled('rooms_enabled');
  const { isSandboxActive, advanceStep } = useAcademy();

  // Core state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // WhatsApp Reminder Modal State
  const [whatsappModalSession, setWhatsappModalSession] = useState<Session | null>(null);

  // Billing Confirmation Modal State
  const [billingConfirmation, setBillingConfirmation] = useState<{
    sessionId: number;
    status: string;
    show: boolean;
  } | null>(null);

  // Hover Tooltip Popover State
  const [hoverData, setHoverData] = useState<HoverCardData | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Rooms & Consultórios Físicos state
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [availableRooms, setAvailableRooms] = useState<RoomAvailability[]>([]);
  const [newRoomId, setNewRoomId] = useState<number | null>(null);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('ALL');
  const [isCheckingRooms, setIsCheckingRooms] = useState(false);

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  // Date controls - default to 2026-09-11 or current date
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    // If today is September 2026 or whenever, format YYYY-MM-DD
    return d.toISOString().split('T')[0];
  });

  type ViewMode = 'month' | 'week' | 'day';
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  // ABAC / Psicólogos Filter: Administradores, Secretárias e Gestores de Agenda
  const canFilterPsychologist =
    isAdmin ||
    isSecretary ||
    Boolean(user?.permissions?.includes('manage_users')) ||
    Boolean(hasPermission('manage_users')) ||
    Boolean(hasPermission('view_agenda'));

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [psychologists, setPsychologists] = useState<Array<{id: number, name: string}>>([]);
  const [selectedPsychologistId, setSelectedPsychologistId] = useState<string>('');

  // Modals state
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [selectedSessionForDetails, setSelectedSessionForDetails] = useState<Session | null>(null);
  const [draggedSession, setDraggedSession] = useState<Session | null>(null);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);

  // New session form
  const [newPatientId, setNewPatientId] = useState<number | ''>('');
  const [newPsychologistId, setNewPsychologistId] = useState<string>('');
  const [newDate, setNewDate] = useState<string>('');
  const [newStartTime, setNewStartTime] = useState<string>('08:00');
  const [newEndTime, setNewEndTime] = useState<string>('08:50');
  const [newModality, setNewModality] = useState<'PRESENTIAL' | 'ONLINE'>('PRESENTIAL');
  const [newPrice, setNewPrice] = useState<number>(clinicSettings?.default_session_price || 180);
  const [newNotes, setNewNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Evaluation package scheduling states
  const [newSessionType, setNewSessionType] = useState<'PSYCHOTHERAPY' | 'EVALUATION'>('PSYCHOTHERAPY');
  const [newEvaluationId, setNewEvaluationId] = useState<number | null>(null);
  const [patientActiveEvaluations, setPatientActiveEvaluations] = useState<any[]>([]);
  const [patientPendingPricingEvaluations, setPatientPendingPricingEvaluations] = useState<any[]>([]);

  const fetchPatientEvaluations = async (patientId: number) => {
    try {
      const res = await api.get(`/evaluations/patient/${patientId}`);
      const allActive = (res.data.evaluations || []).filter(
        (e: any) => e.status === 'IN_PROGRESS' || e.status === 'AWAITING_DEVOLUTIVA'
      );
      const approvedEvals = allActive.filter((e: any) => e.financial_status !== 'PENDING_PRICING');
      const pendingPricing = allActive.filter((e: any) => e.financial_status === 'PENDING_PRICING');

      setPatientActiveEvaluations(approvedEvals);
      setPatientPendingPricingEvaluations(pendingPricing);

      if (approvedEvals.length > 0) {
        setNewSessionType('EVALUATION');
        setNewEvaluationId(approvedEvals[0].id);
      } else {
        setNewSessionType('PSYCHOTHERAPY');
        setNewEvaluationId(null);
      }
    } catch {
      setPatientActiveEvaluations([]);
      setPatientPendingPricingEvaluations([]);
      setNewSessionType('PSYCHOTHERAPY');
      setNewEvaluationId(null);
    }
  };

  // Recurrence states
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('WEEKLY');
  const [recurrenceEndType, setRecurrenceEndType] = useState<'NEVER' | 'COUNT' | 'DATE'>('COUNT');
  const [recurrenceCount, setRecurrenceCount] = useState<number>(8);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');
  const [previewOccurrences, setPreviewOccurrences] = useState<Array<{
    start_time: string;
    end_time: string;
    date: string;
    has_conflict: boolean;
    conflict_reason?: string;
  }>>([]);
  const [showPreviewList, setShowPreviewList] = useState<boolean>(false);
  const [isSubmittingSession, setIsSubmittingSession] = useState<boolean>(false);
  const [recurringSessionToDelete, setRecurringSessionToDelete] = useState<Session | null>(null);

  // Prepaid session credit reallocation states
  const [isReallocationModalOpen, setIsReallocationModalOpen] = useState<boolean>(false);
  const [reallocationCreditData, setReallocationCreditData] = useState<any | null>(null);
  const [pendingSessionPayload, setPendingSessionPayload] = useState<any | null>(null);
  const [isExecutingReallocation, setIsExecutingReallocation] = useState<boolean>(false);

  // New all-day / financial event form
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventType, setNewEventType] = useState<'HOLIDAY' | 'FINANCIAL' | 'REMINDER'>('FINANCIAL');
  const [newEventAmount, setNewEventAmount] = useState<number | ''>('');
  const [newEventCategory, setNewEventCategory] = useState<string>('OUTROS');
  const [newEventStatus, setNewEventStatus] = useState<'PENDING' | 'PAID'>('PENDING');
  const [newEventPaymentMethod, setNewEventPaymentMethod] = useState<string>('PIX');

  // Selected all-day / financial event modal for details and direct status update
  const [selectedFinancialEvent, setSelectedFinancialEvent] = useState<AgendaEvent | null>(null);
  const [isUpdatingEventStatus, setIsUpdatingEventStatus] = useState(false);
  const [payEventDate, setPayEventDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [payEventMethod, setPayEventMethod] = useState<string>('PIX');

  // Quick Patient modal states
  const [isQuickPatientModalOpen, setIsQuickPatientModalOpen] = useState(false);
  const [quickFullName, setQuickFullName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickPrice, setQuickPrice] = useState<number | ''>(clinicSettings?.default_session_price || 180);
  const [isSubmittingQuickPatient, setIsSubmittingQuickPatient] = useState(false);
  const [quickPatientError, setQuickPatientError] = useState<string | null>(null);
  const [quickPatientSuccess, setQuickPatientSuccess] = useState<string | null>(null);

  // Edit session states
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [editPatientId, setEditPatientId] = useState<number | ''>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editStartTime, setEditStartTime] = useState<string>('08:00');
  const [editEndTime, setEditEndTime] = useState<string>('08:50');
  const [editModality, setEditModality] = useState<'PRESENTIAL' | 'ONLINE'>('PRESENTIAL');
  const [editRoomId, setEditRoomId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState<number>(clinicSettings?.default_session_price || 180);
  const [editStatus, setEditStatus] = useState<string>('SCHEDULED');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editScope, setEditScope] = useState<'single' | 'future' | 'all'>('single');
  const [editDetachFromSeries, setEditDetachFromSeries] = useState<boolean>(false);
  const [editIsRecurring, setEditIsRecurring] = useState<boolean>(false);
  const [editRecurrenceFrequency, setEditRecurrenceFrequency] = useState<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('WEEKLY');
  const [editRecurrenceEndType, setEditRecurrenceEndType] = useState<'NEVER' | 'COUNT' | 'DATE'>('COUNT');
  const [editRecurrenceCount, setEditRecurrenceCount] = useState<number>(4);
  const [editRecurrenceEndDate, setEditRecurrenceEndDate] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const handlePhoneInputChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length > 7) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    setQuickPhone(formatted);
  };

  const handleQuickRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickPatientError(null);
    if (!quickFullName.trim()) {
      setQuickPatientError('O Nome Completo é obrigatório.');
      return;
    }
    const cleanPhone = quickPhone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      setQuickPatientError('Informe um celular/WhatsApp válido com DDD.');
      return;
    }

    try {
      setIsSubmittingQuickPatient(true);
      const res = await api.post('/patients/quick', {
        full_name: quickFullName.trim(),
        phone: quickPhone.trim(),
        ...(canViewFinancial && quickPrice !== '' ? { session_price: Number(quickPrice) } : {}),
      });
      const createdPatient: Patient = res.data.patient;
      setPatients((prev) => {
        const newList = [createdPatient, ...prev];
        return newList.sort((a, b) => a.full_name.localeCompare(b.full_name));
      });
      setNewPatientId(createdPatient.id);
      
      // Ensure neuro evaluations are clear for the new patient
      setPatientActiveEvaluations([]);
      setPatientPendingPricingEvaluations([]);
      setNewSessionType('PSYCHOTHERAPY');
      setNewEvaluationId(null);

      if (canViewFinancial && createdPatient.session_price) {
        setNewPrice(createdPatient.session_price);
      } else if (canViewFinancial && quickPrice !== '') {
        setNewPrice(Number(quickPrice));
      }
      setQuickPatientSuccess(`Paciente ${createdPatient.full_name} cadastrado e selecionado!`);
      setTimeout(() => {
        setIsQuickPatientModalOpen(false);
        setQuickFullName('');
        setQuickPhone('');
        setQuickPatientSuccess(null);
        setQuickPatientError(null);
      }, 700);
    } catch (err: any) {
      console.error('Failed to quick-create patient:', err);
      setQuickPatientError(err.response?.data?.error || 'Erro ao cadastrar paciente rápido.');
    } finally {
      setIsSubmittingQuickPatient(false);
    }
  };

  // Auto-scroll ref to current hour
  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Fetch all sessions & agenda events
  const fetchData = async () => {
    try {
      setIsLoading(true);

      let currentPsychId = selectedPsychologistId;

      // If user is Admin/Secretary/Manager, they view strictly 1 psychologist at a time.
      // Load the psychologists list if not yet loaded.
      if (canFilterPsychologist && psychologists.length === 0) {
        try {
          const res = await api.get('/collaborators');
          if (res.data.users) {
            const psychs = res.data.users.filter(
              (u: any) => u.role_id === 2 || u.role_name === 'Psicólogo' || Boolean(u.crp_number) || u.role_id === 1
            );
            setPsychologists(psychs);
            if (psychs.length > 0 && !selectedPsychologistId) {
              const userInList = psychs.find((p: any) => p.id === user?.id);
              currentPsychId = userInList ? String(userInList.id) : String(psychs[0].id);
              setSelectedPsychologistId(currentPsychId);
            }
          }
        } catch (err) {
          console.error('Failed to load psychologists', err);
        }
      }

      let sessionsUrl = '/sessions';
      const qParams: string[] = [];
      if (currentPsychId) {
        qParams.push(`psychologist_id=${currentPsychId}`);
      } else if (canFilterPsychologist) {
        // Se for gestor e ainda não tiver psicólogo selecionado, aguarda a seleção
        qParams.push(`psychologist_id=-1`); 
      }
      if (selectedRoomFilter && selectedRoomFilter !== 'ALL') {
        qParams.push(`room_id=${selectedRoomFilter}`);
      }
      if (qParams.length > 0) {
        sessionsUrl += `?${qParams.join('&')}`;
      }
      
      const [sessRes, eventsRes, ptsRes] = await Promise.all([
        api.get(sessionsUrl),
        api.get('/agenda-events'),
        api.get('/patients'),
      ]);

      const loadedSessions = sessRes.data.sessions || [];
      const loadedEvents = eventsRes.data.events || [];
      let loadedPatients = ptsRes.data.patients || [];
      if (isSandboxActive) {
        loadedPatients = [...(MOCK_SANDBOX_PATIENTS as any), ...loadedPatients];
      }

      setSessions(loadedSessions);
      setAgendaEvents(loadedEvents);
      setPatients(loadedPatients);
      if (loadedPatients && loadedPatients.length > 0 && newPatientId === '') {
        setNewPatientId(loadedPatients[0].id);
      }
    } catch (err) {
      console.error('Failed to load agenda data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllRooms = async () => {
    if (!isRoomsEnabled) return;
    try {
      const res = await api.get('/reception/rooms');
      if (res.data?.rooms) {
        setAllRooms(res.data.rooms);
      }
    } catch (err) {
      console.error('Failed to load rooms in agenda', err);
    }
  };

  const checkRoomsAvailability = async (dateStr: string, startStr: string, endStr: string) => {
    if (!isRoomsEnabled || !dateStr || !startStr || !endStr) return;
    try {
      setIsCheckingRooms(true);
      const res = await api.get('/reception/rooms-availability', {
        params: {
          date: dateStr,
          start_time: startStr,
          end_time: endStr,
        },
      });
      if (res.data?.availability) {
        setAvailableRooms(res.data.availability);
      }
    } catch (err) {
      console.error('Error checking room availability:', err);
    } finally {
      setIsCheckingRooms(false);
    }
  };

  useEffect(() => {
    if (isRoomsEnabled) {
      fetchAllRooms();
    }
  }, [isRoomsEnabled]);

  useEffect(() => {
    fetchData();
  }, [selectedPsychologistId, selectedRoomFilter]);

  useEffect(() => {
    if (isNewSessionModalOpen && isRoomsEnabled && newModality === 'PRESENTIAL' && newDate && newStartTime && newEndTime) {
      checkRoomsAvailability(newDate, newStartTime, newEndTime);
    }
  }, [isNewSessionModalOpen, isRoomsEnabled, newModality, newDate, newStartTime, newEndTime]);

  // Compute default recurrence end date (2 months in future)
  useEffect(() => {
    if (newDate && !recurrenceEndDate) {
      const d = new Date(`${newDate}T12:00:00`);
      d.setMonth(d.getMonth() + 2);
      setRecurrenceEndDate(d.toISOString().split('T')[0]);
    }
  }, [newDate]);

  // Real-time preview of recurrence dates and conflict checks
  useEffect(() => {
    if (!isRecurring || !newDate || !newStartTime || !newEndTime) {
      setPreviewOccurrences([]);
      return;
    }

    const startDateTime = `${newDate}T${newStartTime}:00`;
    const endDateTime = `${newDate}T${newEndTime}:00`;

    let active = true;
    const fetchPreview = async () => {
      try {
        const res = await api.post('/sessions/preview-recurrence', {
          start_time: startDateTime,
          end_time: endDateTime,
          recurrence_frequency: recurrenceFrequency,
          recurrence_end_type: recurrenceEndType,
          recurrence_count: recurrenceCount,
          recurrence_end_date: recurrenceEndDate,
        });
        if (active) {
          setPreviewOccurrences(res.data.occurrences || []);
        }
      } catch (err) {
        console.error('Failed to preview recurrence:', err);
      }
    };

    const timer = setTimeout(fetchPreview, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    isRecurring,
    newDate,
    newStartTime,
    newEndTime,
    recurrenceFrequency,
    recurrenceEndType,
    recurrenceCount,
    recurrenceEndDate,
  ]);

  // Compute week dates array (Sunday to Saturday) based on selectedDate
  const currentWeekDays = useMemo(() => {
    const curr = new Date(`${selectedDate}T12:00:00`);
    const dayOfWeek = curr.getDay(); // 0 = Sunday
    const sunday = new Date(curr);
    sunday.setDate(curr.getDate() - dayOfWeek);

    const weekDays: { dateStr: string; dayName: string; dayNumber: string; isToday: boolean; fullDate: Date }[] = [];
    const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const parts = dateStr.split('-');
      const dayFormatted = `${parts[2]}/${parts[1]}`;

      weekDays.push({
        dateStr,
        dayName: dayNames[i],
        dayNumber: dayFormatted,
        isToday: dateStr === todayStr,
        fullDate: d,
      });
    }
    return weekDays;
  }, [selectedDate]);

  // Format week interval label: "06/09 - 12/09"
  const weekLabel = useMemo(() => {
    if (currentWeekDays.length === 0) return '';
    return `${currentWeekDays[0].dayNumber} - ${currentWeekDays[6].dayNumber}`;
  }, [currentWeekDays]);

  // Navigate dates
  const handlePrev = () => {
    const d = new Date(`${selectedDate}T12:00:00`);
    if (viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else if (viewMode === 'day') {
      d.setDate(d.getDate() - 1);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNext = () => {
    const d = new Date(`${selectedDate}T12:00:00`);
    if (viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else if (viewMode === 'day') {
      d.setDate(d.getDate() + 1);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Open modal with preselected slot
  const handleSlotClick = (dateStr: string, hour: number) => {
    if (!canCreateAppointments) return;
    const hourFormatted = String(hour).padStart(2, '0');
    setNewDate(dateStr);
    setNewStartTime(`${hourFormatted}:00`);
    setNewEndTime(`${hourFormatted}:50`);
    setNewPsychologistId(selectedPsychologistId || '');
    setIsRecurring(false);
    setShowPreviewList(false);
    setFormError(null);
    setNewSessionType('PSYCHOTHERAPY');
    setNewEvaluationId(null);
    if (newPatientId) {
      fetchPatientEvaluations(Number(newPatientId));
    } else {
      setPatientActiveEvaluations([]);
      setPatientPendingPricingEvaluations([]);
    }
    setIsNewSessionModalOpen(true);
  };

  // Status changes
  const confirmStatusChange = async (sessionId: number, newStatus: string, isCharged?: boolean) => {
    try {
      await api.patch(`/sessions/${sessionId}/status`, { 
        status: newStatus,
        is_charged: isCharged 
      });
      await fetchData();
      if (selectedSessionForDetails && selectedSessionForDetails.id === sessionId) {
        let actualStatus = newStatus;
        let cancellationReason: 'PATIENT' | 'PSYCHOLOGIST' | null = null;
        if (newStatus === 'CANCELED_BY_PATIENT') {
          actualStatus = 'CANCELED';
          cancellationReason = 'PATIENT';
        } else if (newStatus === 'CANCELED_BY_PSYCHOLOGIST') {
          actualStatus = 'CANCELED';
          cancellationReason = 'PSYCHOLOGIST';
        } else if (newStatus === 'CANCELED') {
          cancellationReason = null;
        }

        setSelectedSessionForDetails((prev) =>
          prev
            ? {
                ...prev,
                status: actualStatus as any,
                cancellation_reason: cancellationReason,
                price: isCharged === false ? 0.0 : prev.price,
              }
            : null
        );
      }
      setBillingConfirmation(null);
    } catch (err: any) {
      console.error('Failed to change status:', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      } else {
        alert('Erro ao alterar situação da sessão.');
      }
    }
  };

  const handleStatusChange = async (sessionId: number, newStatus: string) => {
    if (newStatus === 'NO_SHOW' || newStatus === 'CANCELED_BY_PATIENT') {
      setBillingConfirmation({ sessionId, status: newStatus, show: true });
      return;
    }
    
    let isCharged: boolean | undefined = undefined;
    if (newStatus === 'CANCELED_BY_PSYCHOLOGIST') {
      isCharged = false;
    }

    await confirmStatusChange(sessionId, newStatus, isCharged);
  };

  // Delete session - handles recurring vs single
  const handleDeleteSession = async (session: Session) => {
    if (session.recurrence_group_id) {
      setRecurringSessionToDelete(session);
      return;
    }

    if (!confirm('Deseja realmente cancelar e excluir este agendamento?')) return;
    try {
      await api.delete(`/sessions/${session.id}`);
      setSelectedSessionForDetails(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const confirmRecurringDelete = async (scope: 'single' | 'future' | 'all') => {
    if (!recurringSessionToDelete) return;
    try {
      await api.delete(`/sessions/${recurringSessionToDelete.id}?scope=${scope}`);
      setRecurringSessionToDelete(null);
      setSelectedSessionForDetails(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete recurring session:', err);
    }
  };

  // WhatsApp reminder modal
  const handleWhatsApp = (sessionOrId: Session | number) => {
    if (typeof sessionOrId === 'object' && sessionOrId !== null) {
      setWhatsappModalSession(sessionOrId);
    } else {
      const found = sessions.find((s) => s.id === sessionOrId);
      if (found) {
        setWhatsappModalSession(found);
      }
    }
  };

  // Start editing existing session
  const handleStartEditSession = (session: Session, overrideDate?: string, overrideStart?: string, overrideEnd?: string) => {
    setSelectedSessionForDetails(session);
    setEditError(null);
    setEditSuccess(null);
    setEditPatientId(session.patient_id);
    const datePart = overrideDate || session.start_time.split('T')[0];
    const sTime = overrideStart || session.start_time.split('T')[1]?.substring(0, 5) || '08:00';
    const eTime = overrideEnd || session.end_time.split('T')[1]?.substring(0, 5) || '08:50';

    setEditDate(datePart);
    setEditStartTime(sTime);
    setEditEndTime(eTime);
    setEditModality(session.modality);
    setEditRoomId(session.room_id || null);
    setEditPrice(session.price);
    
    let initialStatus: string = session.status;
    if (session.cancellation_reason === 'PATIENT') {
      initialStatus = 'CANCELED_BY_PATIENT';
    } else if (session.cancellation_reason === 'PSYCHOLOGIST') {
      initialStatus = 'CANCELED_BY_PSYCHOLOGIST';
    }
    setEditStatus(initialStatus);

    setEditNotes(session.notes || '');
    setEditScope('single');
    setEditDetachFromSeries(false);
    setEditIsRecurring(Boolean(session.recurrence_group_id));

    let freq: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' = 'WEEKLY';
    if (session.recurrence_pattern === 'Quinzenal') freq = 'BIWEEKLY';
    else if (session.recurrence_pattern === 'Mensal') freq = 'MONTHLY';
    setEditRecurrenceFrequency(freq);
    setEditRecurrenceEndType('COUNT');
    setEditRecurrenceCount(4);
    setEditRecurrenceEndDate('');
    setIsEditingSession(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedSessionForDetails(null);
    setIsEditingSession(false);
    setEditError(null);
    setEditSuccess(null);
  };

  const handleApplyEditDuration = (minutes: number) => {
    if (!editStartTime) return;
    const [h, m] = editStartTime.split(':').map(Number);
    const d = new Date(2000, 0, 1, h, m);
    d.setMinutes(d.getMinutes() + minutes);
    const endH = String(d.getHours()).padStart(2, '0');
    const endM = String(d.getMinutes()).padStart(2, '0');
    setEditEndTime(`${endH}:${endM}`);
  };

  const handleSaveEditedSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionForDetails) return;

    if (!editPatientId || !editDate || !editStartTime || !editEndTime) {
      setEditError('Por favor, informe paciente, data e horários de início e término.');
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError(null);
      setEditSuccess(null);

      const startDateTime = `${editDate}T${editStartTime}:00`;
      const endDateTime = `${editDate}T${editEndTime}:00`;

      const payload = {
        patient_id: Number(editPatientId),
        start_time: startDateTime,
        end_time: endDateTime,
        modality: editModality,
        room_id: editModality === 'PRESENTIAL' ? (editRoomId ? Number(editRoomId) : null) : null,
        ...(canViewFinancial ? { price: Number(editPrice) } : {}),
        status: editStatus,
        notes: editNotes,
        scope: editScope,
        detach_from_series: editScope === 'single' && Boolean(selectedSessionForDetails.recurrence_group_id),
        is_recurring: editIsRecurring,
        recurrence_frequency: editRecurrenceFrequency,
        recurrence_end_type: editRecurrenceEndType,
        recurrence_count: editRecurrenceCount,
        recurrence_end_date: editRecurrenceEndDate,
      };

      const res = await api.put(`/sessions/${selectedSessionForDetails.id}`, payload);
      setEditSuccess(res.data.message || 'Agendamento atualizado com sucesso!');
      await fetchData();

      // Atualiza o objeto do modal com os novos dados
      const updatedPatient = patients.find((p) => p.id === Number(editPatientId));
      const updatedRoom = editModality === 'PRESENTIAL' && editRoomId ? allRooms.find((r) => r.id === Number(editRoomId)) : null;
      let resolvedStatus = editStatus;
      let resolvedReason: 'PATIENT' | 'PSYCHOLOGIST' | null = null;
      if (editStatus === 'CANCELED_BY_PATIENT') {
        resolvedStatus = 'CANCELED';
        resolvedReason = 'PATIENT';
      } else if (editStatus === 'CANCELED_BY_PSYCHOLOGIST') {
        resolvedStatus = 'CANCELED';
        resolvedReason = 'PSYCHOLOGIST';
      }

      setSelectedSessionForDetails((prev) =>
        prev
          ? {
              ...prev,
              patient_id: Number(editPatientId),
              patient_name: updatedPatient?.full_name || prev.patient_name,
              patient_phone: updatedPatient?.phone || prev.patient_phone,
              patient_cpf: updatedPatient?.cpf || prev.patient_cpf,
              start_time: startDateTime,
              end_time: endDateTime,
              modality: editModality,
              room_id: editModality === 'PRESENTIAL' ? (editRoomId ? Number(editRoomId) : null) : null,
              room_name: updatedRoom?.name || null,
              room_color: updatedRoom?.color_code || null,
              price: canViewFinancial ? Number(editPrice) : prev.price,
              status: resolvedStatus as any,
              cancellation_reason: resolvedReason,
              notes: editNotes,
              recurrence_group_id: editDetachFromSeries ? null : (editIsRecurring ? (prev.recurrence_group_id || 'rec_series') : prev.recurrence_group_id),
              recurrence_pattern: editDetachFromSeries ? null : (editRecurrenceFrequency === 'WEEKLY' ? 'Semanal' : editRecurrenceFrequency === 'BIWEEKLY' ? 'Quinzenal' : 'Mensal'),
            }
          : null
      );

      setTimeout(() => {
        setIsEditingSession(false);
        setEditSuccess(null);
      }, 1200);
    } catch (err: any) {
      console.error('Failed to update session:', err);
      setEditError(err.response?.data?.error || 'Erro ao atualizar agendamento.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Helper to execute session creation (with optional credit reallocation)
  const executeSessionCreation = async (payload: any, reallocateFromSessionId?: number) => {
    try {
      setIsExecutingReallocation(true);
      const finalPayload = {
        ...payload,
        ...(reallocateFromSessionId ? { reallocate_from_session_id: reallocateFromSessionId } : {}),
      };

      await api.post('/sessions', finalPayload);

      setIsReallocationModalOpen(false);
      setReallocationCreditData(null);
      setPendingSessionPayload(null);

      setIsNewSessionModalOpen(false);
      setNewNotes('');
      setNewRoomId(null);
      setAvailableRooms([]);
      setNewSessionType('PSYCHOTHERAPY');
      setNewEvaluationId(null);
      setIsRecurring(false);
      setShowPreviewList(false);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to create session:', err);
      const msg = err.response?.data?.error || 'Erro ao agendar sessão.';
      if (isReallocationModalOpen) {
        alert(msg);
      } else {
        setFormError(msg);
      }
    } finally {
      setIsExecutingReallocation(false);
    }
  };

  // Create new session (single or recurring)
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientId || !newDate || !newStartTime || !newEndTime) {
      setFormError('Preencha data, paciente e horário.');
      return;
    }

    try {
      setIsSubmittingSession(true);
      setFormError(null);

      // Virtual Sandbox Mode Interception (Synapsis Academy)
      if (isSandboxActive) {
        setIsNewSessionModalOpen(false);
        setNewNotes('');
        setNewRoomId(null);
        setAvailableRooms([]);
        setNewSessionType('PSYCHOTHERAPY');
        setNewEvaluationId(null);
        setIsRecurring(false);
        setShowPreviewList(false);
        setIsSubmittingSession(false);
        if (advanceStep) {
          advanceStep();
        }
        return;
      }

      const startDateTime = `${newDate}T${newStartTime}:00`;
      const endDateTime = `${newDate}T${newEndTime}:00`;

      const sessionPayload = {
        patient_id: Number(newPatientId),
        psychologist_id: canFilterPsychologist && selectedPsychologistId ? Number(selectedPsychologistId) : undefined,
        start_time: startDateTime,
        end_time: endDateTime,
        modality: newModality,
        room_id: newModality === 'PRESENTIAL' ? (newRoomId ? Number(newRoomId) : null) : null,
        ...(canViewFinancial ? { price: newSessionType === 'EVALUATION' ? 0 : Number(newPrice) } : {}),
        notes: newNotes,
        evaluation_id: newSessionType === 'EVALUATION' ? newEvaluationId : null,
        session_type: newSessionType,
        is_recurring: isRecurring,
        recurrence_frequency: recurrenceFrequency,
        recurrence_end_type: recurrenceEndType,
        recurrence_count: recurrenceCount,
        recurrence_end_date: recurrenceEndDate,
      };

      // Check for prepaid credit if this is a single psychotherapy session
      if (newSessionType === 'PSYCHOTHERAPY' && !isRecurring) {
        try {
          const checkRes = await api.get('/sessions/check-prepaid-credit', {
            params: {
              patient_id: Number(newPatientId),
              start_time: startDateTime,
            },
          });

          if (checkRes.data && checkRes.data.hasEligibleCredit && checkRes.data.suggestedDonorSession) {
            setPendingSessionPayload(sessionPayload);
            setReallocationCreditData(checkRes.data);
            setIsReallocationModalOpen(true);
            return;
          }
        } catch (checkErr) {
          console.warn('Falha ao verificar créditos pré-pagos futuros:', checkErr);
        }
      }

      await executeSessionCreation(sessionPayload);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Erro ao agendar sessão');
    } finally {
      setIsSubmittingSession(false);
    }
  };

  // Create all-day event (with optional financial details)
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle || !newEventDate) return;
    try {
      await api.post('/agenda-events', {
        title: newEventTitle,
        date: newEventDate,
        event_type: newEventType,
        amount: newEventType === 'FINANCIAL' && newEventAmount ? Number(newEventAmount) : null,
        category: newEventType === 'FINANCIAL' ? newEventCategory : null,
        status: newEventType === 'FINANCIAL' ? newEventStatus : 'PENDING',
        payment_date: newEventType === 'FINANCIAL' && newEventStatus === 'PAID' ? newEventDate : null,
        payment_method: newEventType === 'FINANCIAL' && newEventStatus === 'PAID' ? newEventPaymentMethod : null,
      });
      setIsNewEventModalOpen(false);
      setNewEventTitle('');
      setNewEventAmount('');
      await fetchData();
    } catch (err) {
      console.error('Failed to create all-day event:', err);
    }
  };

  // Direct status update / payment registration for financial agenda events
  const handleUpdateEventStatus = async (eventId: number, newStatus: 'PAID' | 'PENDING') => {
    try {
      setIsUpdatingEventStatus(true);
      await api.patch(`/agenda-events/${eventId}/status`, {
        status: newStatus,
        payment_date: newStatus === 'PAID' ? payEventDate : null,
        payment_method: newStatus === 'PAID' ? payEventMethod : null,
      });
      await fetchData();
      if (selectedFinancialEvent && selectedFinancialEvent.id === eventId) {
        setSelectedFinancialEvent((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                payment_date: newStatus === 'PAID' ? payEventDate : null,
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to update event status:', err);
    } finally {
      setIsUpdatingEventStatus(false);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    try {
      await api.delete(`/agenda-events/${eventId}`);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  // Filter sessions by status and patient query
  const visibleSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Status filter
      if (statusFilter !== 'ALL' && s.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.patient_name?.toLowerCase().includes(q);
        const matchPhone = s.patient_phone?.includes(q);
        if (!matchName && !matchPhone) return false;
      }
      return true;
    });
  }, [sessions, statusFilter, searchQuery]);

  // Pre-indexed lookups for O(1) day-level access across month, week, and day views
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const d = s.start_time ? s.start_time.slice(0, 10) : '';
      if (d) {
        let list = map.get(d);
        if (!list) {
          list = [];
          map.set(d, list);
        }
        list.push(s);
      }
    }
    return map;
  }, [sessions]);

  const visibleSessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of visibleSessions) {
      const d = s.start_time ? s.start_time.slice(0, 10) : '';
      if (d) {
        let list = map.get(d);
        if (!list) {
          list = [];
          map.set(d, list);
        }
        list.push(s);
      }
    }
    return map;
  }, [visibleSessions]);

  const agendaEventsByDate = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const e of agendaEvents) {
      if (e.date) {
        let list = map.get(e.date);
        if (!list) {
          list = [];
          map.set(e.date, list);
        }
        list.push(e);
      }
    }
    return map;
  }, [agendaEvents]);

  // Current time position calculation
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startDayMinutes = 6 * 60; // 06:00
  const isWithinHours = currentMinutes >= startDayMinutes && currentMinutes <= 24 * 60;
  const currentTimeTop = ((currentMinutes - startDayMinutes) / 60) * SLOT_HEIGHT;
  const currentTimeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Dynamic Real-time Conflict Detection
  const editStartDT = `${editDate}T${editStartTime}:00`;
  const editEndDT = `${editDate}T${editEndTime}:00`;
  const editNewStart = new Date(editStartDT).getTime();
  const editNewEnd = new Date(editEndDT).getTime();
  const editHasConflict = isEditingSession && selectedSessionForDetails ? sessions.some(s => {
    if (s.id === selectedSessionForDetails.id) return false;
    if (s.status === 'CANCELED' || s.status === 'NO_SHOW') return false;
    const sStart = new Date(s.start_time).getTime();
    const sEnd = new Date(s.end_time).getTime();
    return editNewStart < sEnd && editNewEnd > sStart;
  }) : false;

  const createStartDT = `${newDate}T${newStartTime}:00`;
  const createEndDT = `${newDate}T${newEndTime}:00`;
  const createNewStart = new Date(createStartDT).getTime();
  const createNewEnd = new Date(createEndDT).getTime();
  const createHasConflict = isNewSessionModalOpen && !isRecurring ? sessions.some(s => {
    if (s.status === 'CANCELED' || s.status === 'NO_SHOW') return false;
    const sStart = new Date(s.start_time).getTime();
    const sEnd = new Date(s.end_time).getTime();
    return createNewStart < sEnd && createNewEnd > sStart;
  }) : false;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] pb-4 select-none">
      {/* ======================================================== */}
      {/* TOP HEADER CONTROLS (Identical layout to PsicoManager)    */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#181920] border-b border-slate-800 text-slate-200 rounded-t-2xl shadow-sm">
        {/* Left: Date Interval Navigator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              title="Anterior"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="text-sm font-bold tracking-tight text-white px-2">
              {viewMode === 'week' ? weekLabel : selectedDate.split('-').reverse().join('/')}
            </span>

            <button
              onClick={handleNext}
              title="Próximo"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-3 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700/80 rounded-lg transition border border-slate-700/50 cursor-pointer"
          >
            Hoje
          </button>

          {/* View Mode Pills (Mês | Semana | Dia) */}
          <div data-help-id="agenda-view-selector" className="ml-2 flex items-center rounded-xl bg-slate-900/90 p-1 border border-slate-800">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mês
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                viewMode === 'day'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dia
            </button>
          </div>

          {canFilterPsychologist && psychologists.length > 0 && (
            <div className="ml-2 flex items-center gap-1.5 border-l border-slate-700 pl-3">
              <User className="h-4 w-4 text-teal-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                  Psicólogo
                </span>
                <select
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 max-w-[200px] truncate cursor-pointer"
                  value={selectedPsychologistId}
                  onChange={(e) => setSelectedPsychologistId(e.target.value)}
                  title="Selecione o psicólogo para visualizar sua agenda individual"
                >
                  {psychologists.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isRoomsEnabled && allRooms.length > 0 && (
            <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
              <Building className="h-3.5 w-3.5 text-teal-400 shrink-0" />
              <select
                className="bg-slate-800 border border-slate-700 text-white text-xs font-medium rounded-lg px-2 py-1 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 max-w-[150px] truncate"
                value={selectedRoomFilter}
                onChange={(e) => setSelectedRoomFilter(e.target.value)}
                title="Filtrar agenda por consultório físico"
              >
                <option value="ALL">Todas as salas</option>
                {allRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right Controls: Search, New Session Button, Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar clientes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 sm:w-56 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Primary Action Button: + Agendar sessão */}
          {canCreateAppointments && (
            <button
              type="button"
              data-help-id="agenda-new-session"
              data-tour="agenda-create-btn"
              onClick={() => {
                setNewDate(selectedDate);
                setNewStartTime('08:00');
                setNewEndTime('08:50');
                setNewPsychologistId(selectedPsychologistId || '');
                setFormError(null);
                setNewSessionType('PSYCHOTHERAPY');
                setNewEvaluationId(null);
                if (newPatientId) {
                  fetchPatientEvaluations(Number(newPatientId));
                } else {
                  setPatientActiveEvaluations([]);
                  setPatientPendingPricingEvaluations([]);
                }
                setIsNewSessionModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agendar sessão</span>
            </button>
          )}

          {/* Status Filter */}
          <div data-help-id="agenda-status-filter" className="flex items-center gap-1 bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
            <span className="text-slate-500 font-medium">Situação:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 font-bold focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">Todos</option>
              <option value="CONFIRMED" className="bg-slate-900 text-white">Confirmados</option>
              <option value="SCHEDULED" className="bg-slate-900 text-white">Agendados</option>
              <option value="COMPLETED" className="bg-slate-900 text-white">Realizados</option>
              <option value="CANCELED" className="bg-slate-900 text-white">Cancelados</option>
              <option value="NO_SHOW" className="bg-slate-900 text-white">Faltas</option>
            </select>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MAIN CALENDAR BODY (WEEK VIEW - MATCHING PSICOMANAGER)   */}
      {/* ======================================================== */}
      {viewMode === 'week' && (
        <div
          ref={gridScrollRef}
          className="flex-1 overflow-y-auto bg-[#14151b] border-x border-b border-slate-800 rounded-b-2xl text-slate-300 shadow-xl relative"
        >
          <div className="min-w-[760px] w-full">
            {/* Header Fixo Sticky: Dias da Semana e Linha "Dia todo" perfeitamente alinhados à grade horária */}
            <div className="sticky top-0 z-20 shadow-md">
              {/* Header Row with Days */}
              <div
                className="grid border-b border-slate-800 bg-[#181920]"
                style={{ gridTemplateColumns: '72px repeat(7, minmax(0, 1fr))' }}
              >
                {/* Time corner header */}
                <div className="py-2.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-r border-slate-800 flex items-center justify-center truncate select-none min-w-0">
                  Horário
                </div>

                {/* 7 Days of the Week */}
                {currentWeekDays.map((day, dayIndex) => (
                  <div
                    key={day.dateStr}
                    className={`py-2.5 px-1 text-center min-w-0 overflow-hidden transition ${
                      dayIndex === currentWeekDays.length - 1 ? 'border-r-0' : 'border-r border-slate-800'
                    } ${
                      day.isToday ? 'bg-indigo-950/40 text-indigo-300' : 'text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold tracking-wide uppercase flex items-center justify-center gap-1 truncate">
                      <span>{day.dayName}</span>
                      <span>-</span>
                      <span className={day.isToday ? 'text-indigo-400 font-black underline underline-offset-4 decoration-2' : ''}>
                        {day.dayNumber}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* All-Day Events ("Dia todo") Row */}
              <div
                className="grid border-b border-slate-800 bg-[#16171f]"
                style={{ gridTemplateColumns: '72px repeat(7, minmax(0, 1fr))' }}
              >
                <div className="p-2 text-[11px] font-bold text-slate-400 border-r border-slate-800 flex items-center justify-center truncate select-none min-w-0">
                  Dia todo
                </div>

                {currentWeekDays.map((day, dayIndex) => {
                  const dayEvents = agendaEventsByDate.get(day.dateStr) || [];

                  return (
                    <div
                      key={`allday-${day.dateStr}`}
                      className={`p-1.5 min-h-[50px] space-y-1 relative group min-w-0 overflow-hidden ${
                        dayIndex === currentWeekDays.length - 1 ? 'border-r-0' : 'border-r border-slate-800'
                      }`}
                    >
                      {dayEvents.map((evt) => {
                        const isFinancial = evt.event_type === 'FINANCIAL';
                        const isPaid = evt.status === 'PAID';
                        const isOverdue = !isPaid && evt.date < todayStr;

                        return (
                          <div
                            key={evt.id}
                            onClick={() => setSelectedFinancialEvent(evt)}
                            className={`text-[10px] font-semibold px-1.5 py-1 rounded-md flex items-center justify-between gap-1 shadow-xs cursor-pointer transition transform hover:scale-[1.01] min-w-0 overflow-hidden ${
                              evt.event_type === 'HOLIDAY'
                                ? 'bg-sky-950/80 text-sky-200 border border-sky-800 hover:bg-sky-900/80'
                                : isFinancial
                                ? isPaid
                                  ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-700/80 hover:bg-emerald-900/90'
                                  : isOverdue
                                  ? 'bg-rose-950/90 text-rose-200 border border-rose-700/80 hover:bg-rose-900/90'
                                  : 'bg-amber-950/90 text-amber-200 border border-amber-700/80 hover:bg-amber-900/90'
                                : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-750'
                            }`}
                            title={
                              isFinancial
                                ? `${evt.title} - R$ ${evt.amount ? evt.amount.toFixed(2) : '0,00'} (${
                                    isPaid ? 'Pago' : isOverdue ? 'Vencido' : 'Pendente'
                                  }) - Clique para ver detalhes e dar baixa`
                                : evt.title
                            }
                          >
                            <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
                              {isFinancial ? (
                                isPaid ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                                ) : isOverdue ? (
                                  <AlertCircle className="h-3 w-3 text-rose-400 shrink-0 animate-pulse" />
                                ) : (
                                  <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                                )
                              ) : evt.event_type === 'HOLIDAY' ? (
                                <CalendarIcon className="h-3 w-3 text-sky-400 shrink-0" />
                              ) : (
                                <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                              )}
                              <span className="truncate font-medium">{evt.title}</span>
                            </div>

                            {isFinancial && (
                              <div className="flex items-center gap-1 shrink-0 ml-0.5">
                                {evt.amount != null && (
                                  <span className="font-bold text-[9px] opacity-90">
                                    R${Math.round(evt.amount)}
                                  </span>
                                )}
                                <span
                                  className={`text-[8px] font-black uppercase px-1 py-0.5 rounded leading-none ${
                                    isPaid
                                      ? 'bg-emerald-900/90 text-emerald-300 border border-emerald-600/50'
                                      : isOverdue
                                      ? 'bg-rose-900/90 text-rose-300 border border-rose-600/50'
                                      : 'bg-amber-900/90 text-amber-300 border border-amber-600/50'
                                  }`}
                                >
                                  {isPaid ? 'PAGO' : isOverdue ? 'VENC.' : 'PEND.'}
                                </span>
                              </div>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvent(evt.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 hover:text-rose-400 text-slate-500 transition px-0.5 shrink-0"
                              title="Remover evento"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}

                      {/* Add all-day event quick button */}
                      <button
                        onClick={() => {
                          setNewEventDate(day.dateStr);
                          setNewEventTitle('');
                          setNewEventAmount('');
                          setNewEventType('FINANCIAL');
                          setNewEventCategory('OUTROS');
                          setNewEventStatus('PENDING');
                          setIsNewEventModalOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 hover:text-indigo-400 flex items-center gap-0.5 font-medium transition cursor-pointer"
                      >
                        + Lembrete/Despesa
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hourly Calendar Grid with Current Time overlay */}
            <div className="relative">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: '72px repeat(7, minmax(0, 1fr))',
                  height: `${HOURS_GRID.length * SLOT_HEIGHT}px`,
                }}
              >
                {/* Time labels column */}
                <div className="border-r border-slate-800 bg-[#16171f]/50 min-w-0">
                  {HOURS_GRID.map((hour) => (
                    <div
                      key={hour}
                      style={{ height: `${SLOT_HEIGHT}px` }}
                      className="border-b border-slate-800/80 pr-2 pt-1 text-right text-[11px] font-bold text-slate-500 select-none truncate"
                    >
                      {String(hour).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                {currentWeekDays.map((day, dayIndex) => {
                  const daySessions = visibleSessionsByDate.get(day.dateStr) || [];

                  return (
                    <div
                      key={`col-${day.dateStr}`}
                      className={`relative min-w-0 ${
                        dayIndex === currentWeekDays.length - 1 ? 'border-r-0' : 'border-r border-slate-800'
                      } ${day.isToday ? 'bg-indigo-950/10' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedSession) {
                          const start = new Date(draggedSession.start_time);
                          const end = new Date(draggedSession.end_time);
                          const durationMinutes = (end.getTime() - start.getTime()) / 60000;
                          
                          const rect = e.currentTarget.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          const hourOffset = Math.floor(y / SLOT_HEIGHT);
                          const remainder = y % SLOT_HEIGHT;
                          
                          const newStartH = HOURS_GRID[0] + hourOffset;
                          const newStartM = remainder >= (SLOT_HEIGHT / 2) ? 30 : 0;
                          
                          const d = new Date(2000, 0, 1, newStartH, newStartM);
                          const overrideStart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                          
                          d.setMinutes(d.getMinutes() + durationMinutes);
                          const overrideEnd = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                          
                          setDraggedSession(null);
                          handleStartEditSession(draggedSession, day.dateStr, overrideStart, overrideEnd);
                        }
                      }}
                    >
                      {/* Horizontal hour lines & clickable slots */}
                      {HOURS_GRID.map((hour) => (
                        <div
                          key={`slot-${day.dateStr}-${hour}`}
                          onClick={() => {
                            if (!canCreateAppointments) return;
                            handleSlotClick(day.dateStr, hour);
                          }}
                          style={{ height: `${SLOT_HEIGHT}px` }}
                          className={`border-b border-slate-800/60 relative group transition ${
                            canCreateAppointments ? 'hover:bg-indigo-600/5 cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          {/* Half-hour dashed guide line */}
                          <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-slate-800/40 pointer-events-none" />

                          {/* Hover plus hint */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                            <span className="text-[10px] font-bold text-indigo-400 bg-slate-900/90 px-2 py-0.5 rounded-full border border-indigo-500/30">
                              + {String(hour).padStart(2, '0')}:00
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Session Cards positioned in this day column with intelligent overlap layout */}
                      {calculateSessionOverlapLayout(daySessions).map(({ session, colIndex, totalCols }) => {
                        const startDate = new Date(session.start_time);
                        const endDate = new Date(session.end_time);

                        const startMin = startDate.getHours() * 60 + startDate.getMinutes();
                        const endMin = endDate.getHours() * 60 + endDate.getMinutes();
                        const durationMin = Math.max(30, endMin - startMin);

                        const topPx = ((startMin - startDayMinutes) / 60) * SLOT_HEIGHT;
                        const heightPx = Math.max(32, (durationMin / 60) * SLOT_HEIGHT - 3);

                        const { bgClass } = getSessionColor(session.patient_name, session.status);

                        const timeStr = totalCols >= 3
                          ? `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
                          : `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')} - ${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

                        const colWidthPercent = 100 / totalCols;
                        const leftPercent = colIndex * colWidthPercent;

                        return (
                          <div
                            key={session.id}
                            draggable
                            onDragStart={(e) => {
                              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                              setHoverData(null);
                              setDraggedSession(session);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', session.id.toString());
                            }}
                            onDragEnd={(e) => {
                               setDraggedSession(null);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                              setHoverData(null);
                              setSelectedSessionForDetails(session);
                            }}
                            onMouseEnter={(e) => {
                              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                              const target = e.currentTarget;
                              hoverTimeoutRef.current = setTimeout(() => {
                                const rect = target.getBoundingClientRect();
                                setHoverData({
                                  session,
                                  rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
                                  overlapInfo: totalCols > 1 ? { colIndex, totalCols } : undefined,
                                });
                              }, 200);
                            }}
                            onMouseLeave={() => {
                              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                              hoverTimeoutRef.current = setTimeout(() => {
                                setHoverData(null);
                              }, 150);
                            }}
                            style={{
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                              left: totalCols > 1 ? `calc(${leftPercent}% + 2px)` : '4px',
                              width: totalCols > 1 ? `calc(${colWidthPercent}% - 4px)` : 'calc(100% - 8px)',
                              zIndex: 10 + colIndex,
                              pointerEvents: draggedSession && draggedSession.id !== session.id ? 'none' : 'auto',
                            }}
                            className={`absolute rounded-lg px-1.5 py-1 shadow-md cursor-pointer transition transform hover:scale-[1.03] hover:z-40 overflow-hidden flex flex-col justify-between border-l-[3px] ${
                              session.status === 'CONFIRMED'
                                ? 'border-l-emerald-400 ring-1 ring-emerald-400/50 shadow-emerald-950/30'
                                : session.status === 'COMPLETED'
                                ? 'border-l-purple-400 ring-1 ring-purple-400/30'
                                : session.status === 'CANCELED' || session.status === 'NO_SHOW'
                                ? 'border-l-rose-500 ring-1 ring-rose-500/30 opacity-75'
                                : 'border-l-sky-400 ring-1 ring-sky-400/20'
                            } ${bgClass}`}
                          >
                            {/* Line 1: Patient Name */}
                            <div className="font-bold text-[11px] leading-tight truncate tracking-tight flex items-center gap-1">
                              {session.session_type === 'EVALUATION' && (
                                <Brain className="h-3 w-3 shrink-0 text-purple-300" title="Avaliação Neuropsicológica (Pacote)" />
                              )}
                              <span className="truncate">{session.patient_name}</span>
                            </div>

                            {/* Line 2: Time, Status icon, Payment icon, Modality icon */}
                            <div className="flex items-center gap-1.5 text-[10px] leading-none opacity-95">
                              <span className="font-semibold">{timeStr}</span>

                              {/* Status Icon */}
                              {session.status === 'CONFIRMED' && (
                                <span className="flex items-center gap-0.5 text-emerald-200" title="Confirmado">
                                  <ThumbsUp className="h-3 w-3 shrink-0" />
                                  {totalCols <= 2 && <span className="text-[9px] font-extrabold tracking-tight">Conf.</span>}
                                </span>
                              )}
                              {session.status === 'SCHEDULED' && (
                                <Clock className="h-3 w-3 shrink-0 text-sky-200" title="Agendado" />
                              )}
                              {session.status === 'COMPLETED' && (
                                <CheckCircle className="h-3 w-3 shrink-0 text-purple-200" title="Realizada" />
                              )}
                              {(session.status === 'CANCELED' || session.status === 'NO_SHOW') && (
                                <XCircle className="h-3 w-3 shrink-0 text-rose-300" title="Cancelado / Falta" />
                              )}

                              {/* Financial Icon ($) or Pacote */}
                              {session.session_type === 'EVALUATION' ? (
                                <span className="text-[9px] font-bold text-purple-200 bg-purple-950/70 px-1 rounded border border-purple-700/50" title="Pacote de Avaliação Neuropsicológica">
                                  Pacote
                                </span>
                              ) : (
                                <span
                                  className={`font-black text-[11px] ${
                                    session.payment_status === 'PAID'
                                      ? 'text-emerald-300 font-extrabold'
                                      : 'opacity-70'
                                  }`}
                                  title={session.payment_status === 'PAID' ? 'Pago' : 'Pendente de pagamento'}
                                >
                                  $
                                </span>
                              )}

                              {/* Modality Icon & Compact Room Badge (Opção A) */}
                              {session.modality === 'ONLINE' ? (
                                <Video className="h-3 w-3 shrink-0" title="Atendimento Online" />
                              ) : (
                                <>
                                  <Building className="h-3 w-3 shrink-0" title="Presencial no Consultório" />
                                  {isRoomsEnabled && session.room_name && (
                                    <span
                                      className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded shrink-0 shadow-xs border border-white/30 text-white leading-none tracking-tight"
                                      style={{ backgroundColor: session.room_color || '#0d9488' }}
                                      title={`Consultório Físico: ${session.room_name}`}
                                    >
                                      {getRoomInitials(session)}
                                    </span>
                                  )}
                                </>
                              )}

                              {/* Recurrence Icon */}
                              {session.recurrence_group_id && (
                                <Repeat className="h-3 w-3 shrink-0 text-white/90" title={`Recorrente (${session.recurrence_pattern || 'Série'})`} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Current Time Horizontal Line with badge positioned as an independent overlay */}
              {isWithinHours && (
                <div
                  style={{ top: `${currentTimeTop}px` }}
                  className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                >
                  <div className="bg-cyan-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded-r-md shadow-md">
                    {currentTimeLabel}
                  </div>
                  <div className="flex-1 h-[2px] bg-cyan-400/90 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DAY VIEW (DIÁRIO DETALHADO)                             */}
      {/* ======================================================== */}
      {viewMode === 'day' && (
        <div className="flex-1 flex flex-col bg-[#14151b] border-x border-b border-slate-800 rounded-b-2xl overflow-hidden text-slate-300 shadow-xl">
          <div className="p-3 bg-[#181920] border-b border-slate-800 font-bold text-sm text-center text-white">
            Atendimentos do Dia: {selectedDate.split('-').reverse().join('/')}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(() => {
              const daySessions = visibleSessionsByDate.get(selectedDate) || [];
              if (daySessions.length === 0) {
                return (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    Nenhum agendamento para este dia. Clique em "+ Agendar sessão" para cadastrar.
                  </div>
                );
              }
              return daySessions.map((s) => {
                const startDate = new Date(s.start_time);
                const endDate = new Date(s.end_time);
                const timeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')} - ${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
                const { bgClass } = getSessionColor(s.patient_name, s.status);

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSessionForDetails(s)}
                    className={`p-4 rounded-xl shadow-sm cursor-pointer flex items-center justify-between border border-slate-700/50 hover:brightness-110 transition ${bgClass}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base">{s.patient_name}</h3>
                        {s.session_type === 'EVALUATION' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-purple-900/90 text-purple-200 border border-purple-600/60 px-2 py-0.5 rounded-md">
                            <Brain className="h-3 w-3 text-purple-300" />
                            <span>Avaliação Neuropsicológica</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs mt-1 opacity-90">
                        <span className="flex items-center gap-1 font-semibold">
                          <Clock className="h-3.5 w-3.5" />
                          {timeStr}
                        </span>
                        <span>{s.modality === 'ONLINE' ? '📹 Online' : '🏢 Presencial'}</span>
                        {isRoomsEnabled && s.modality === 'PRESENTIAL' && s.room_name && (
                          <>
                            <span>•</span>
                            <span
                              className="px-2 py-0.5 rounded-md text-[11px] font-bold text-white shadow-xs flex items-center gap-1"
                              style={{ backgroundColor: s.room_color || '#0d9488' }}
                            >
                              <span>🏢 {s.room_name}</span>
                            </span>
                          </>
                        )}
                        {canViewFinancial && s.price != null && (
                          <>
                            <span>•</span>
                            <span>{s.session_type === 'EVALUATION' ? 'Pacote Fechado' : `R$ ${s.price.toFixed(2)}`}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="font-bold uppercase tracking-wider text-[11px]">
                          {s.status === 'CONFIRMED'
                            ? 'Confirmada'
                            : s.status === 'COMPLETED'
                            ? 'Realizada'
                            : s.status === 'NO_SHOW'
                            ? 'Falta'
                            : s.status === 'CANCELED'
                            ? s.cancellation_reason === 'PATIENT'
                              ? 'Canc. Paciente'
                              : s.cancellation_reason === 'PSYCHOLOGIST'
                              ? 'Canc. Psicólogo'
                              : 'Cancelada'
                            : 'Agendada'}
                        </span>
                        {s.recurrence_group_id && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-indigo-300 font-semibold text-[11px] bg-indigo-950/70 px-1.5 py-0.5 rounded-md border border-indigo-700/50">
                              <Repeat className="h-3 w-3" />
                              <span>{s.recurrence_pattern || 'Recorrente'}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canAccessClinical && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartSession(s.patient_id, s.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold text-xs flex items-center gap-1"
                        >
                          <PlayCircle className="h-4 w-4" />
                          <span>Atender</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MONTH VIEW (VISÃO MENSAL EM GRADE)                      */}
      {/* ======================================================== */}
      {viewMode === 'month' && (
        <div className="flex-1 flex flex-col bg-[#14151b] border-x border-b border-slate-800 rounded-b-2xl overflow-hidden text-slate-300 shadow-xl p-4">
          <div className="text-center font-bold text-white mb-3 text-sm">
            Visão Mensal • {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 py-1 border-b border-slate-800">
            <div>DOM</div><div>SEG</div><div>TER</div><div>QUA</div><div>QUI</div><div>SEX</div><div>SÁB</div>
          </div>
          <div className="grid grid-cols-7 gap-1 flex-1 mt-1 auto-rows-fr">
            {Array.from({ length: 35 }).map((_, idx) => {
              // Simple month grid simulation
              const dayNum = (idx % 30) + 1;
              const dateStr = `2026-09-${String(dayNum).padStart(2, '0')}`;
              const count = (sessionsByDate.get(dateStr) || []).length;
              const isCurrentDay = dateStr === selectedDate;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setViewMode('day');
                  }}
                  className={`p-2 rounded-xl border border-slate-800/80 flex flex-col justify-between hover:bg-slate-800/60 cursor-pointer transition ${
                    isCurrentDay ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-900/30'
                  }`}
                >
                  <span className={`text-xs font-bold ${isCurrentDay ? 'text-indigo-400 font-extrabold' : 'text-slate-400'}`}>
                    {dayNum}
                  </span>
                  {count > 0 && (
                    <div className="mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-600/60 text-indigo-100">
                        {count} sessões
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DETALHES / AÇÕES / EDIÇÃO DA SESSÃO (DIALOG)      */}
      {/* ======================================================== */}
      {selectedSessionForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100 relative max-h-[92vh] overflow-y-auto">
            
            {/* TELA DE EDIÇÃO DO AGENDAMENTO */}
            {isEditingSession ? (
              <form onSubmit={handleSaveEditedSession} className="space-y-4">
                {/* Header Edição */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingSession(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                      title="Voltar aos Detalhes"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-indigo-400" />
                        <span>Editar Agendamento</span>
                      </h2>
                      <p className="text-xs text-slate-400">
                        Corrija data, horários, paciente, valor ou recorrência
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseDetailsModal}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Feedback Messages */}
                {editError && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{editError}</span>
                  </div>
                )}
                {editSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{editSuccess}</span>
                  </div>
                )}

                {/* Paciente */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Paciente *
                  </label>
                  <select
                    value={editPatientId}
                    onChange={(e) => {
                      const pid = Number(e.target.value);
                      setEditPatientId(pid);
                      const p = patients.find((item) => item.id === pid);
                      if (p && p.session_price) {
                        setEditPrice(p.session_price);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-hidden"
                    required
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} {p.cpf ? `(CPF: ${p.cpf})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data do Agendamento */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Data da Sessão *
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>

                {/* Horários e Atalhos */}
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Horário de Início *
                      </label>
                      <input
                        type="time"
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Horário de Término *
                      </label>
                      <input
                        type="time"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  {/* Atalhos rápidos de duração */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400">Duração rápida:</span>
                    <button
                      type="button"
                      onClick={() => handleApplyEditDuration(45)}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 font-semibold cursor-pointer"
                    >
                      +45 min
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyEditDuration(50)}
                      className="px-2 py-0.5 rounded-md bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700 text-[11px] text-indigo-200 font-semibold cursor-pointer"
                    >
                      +50 min (Padrão)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyEditDuration(60)}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 font-semibold cursor-pointer"
                    >
                      +60 min
                    </button>
                  </div>
                </div>

                {/* Modalidade e Preço */}
                <div className={`grid ${canViewFinancial ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Modalidade
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditModality('PRESENTIAL')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition cursor-pointer ${
                          editModality === 'PRESENTIAL'
                            ? 'bg-amber-600/30 text-amber-300 border-amber-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        <Building className="h-3.5 w-3.5" />
                        <span>Presencial</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditModality('ONLINE')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition cursor-pointer ${
                          editModality === 'ONLINE'
                            ? 'bg-sky-600/30 text-sky-300 border-sky-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        <Video className="h-3.5 w-3.5" />
                        <span>Online</span>
                      </button>
                    </div>
                  </div>

                  {canViewFinancial && (
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Valor da Sessão (R$)
                      </label>
                      <input
                        type="number"
                        step="5"
                        min="0"
                        value={editPrice}
                        onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-hidden"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Consultório Físico */}
                {isRoomsEnabled && editModality === 'PRESENTIAL' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Consultório Físico
                    </label>
                    <select
                      value={editRoomId || ''}
                      onChange={(e) => setEditRoomId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="">-- A definir na recepção --</option>
                      {allRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} {r.room_type ? `(${r.room_type})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Situação / Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Situação do Agendamento
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="SCHEDULED">Agendada (Pendente)</option>
                    <option value="CONFIRMED">Confirmada</option>
                    <option value="COMPLETED">Realizada</option>
                    <option value="NO_SHOW">Falta (Não Compareceu)</option>
                    <option value="CANCELED_BY_PATIENT">Paciente Cancelou</option>
                    <option value="CANCELED_BY_PSYCHOLOGIST">Psicólogo Cancelou</option>
                    <option value="CANCELED">Cancelada (Outro/Geral)</option>
                  </select>
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Observações Internas
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Orientações ou lembretes sobre a sessão..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* Seção de Recorrência */}
                {selectedSessionForDetails.recurrence_group_id ? (
                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-700/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Repeat className="h-4 w-4 text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-200">
                          Série Recorrente Ativa ({selectedSessionForDetails.recurrence_pattern || 'Semanal'})
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-300 font-bold">
                        Recorrente
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-300 mb-1.5">
                        Onde aplicar as alterações de data, horário e valor?
                      </span>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name="editScope"
                            value="single"
                            checked={editScope === 'single'}
                            onChange={() => setEditScope('single')}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <strong className="text-white block">Apenas este agendamento</strong>
                            <span className="text-[11px] text-slate-400">
                              Altera somente esta sessão ({editDate}) e a desvincula da série recorrente
                            </span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name="editScope"
                            value="future"
                            checked={editScope === 'future'}
                            onChange={() => setEditScope('future')}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <strong className="text-white block">Este e todos os futuros da série</strong>
                            <span className="text-[11px] text-slate-400">
                              Propaga o novo horário, valor e recorrência para as próximas datas
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg transition ${editIsRecurring ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <Repeat className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-200 block text-xs">
                            Tornar Agendamento Recorrente
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Repetir esta sessão periodicamente na agenda
                          </span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editIsRecurring}
                          onChange={(e) => setEditIsRecurring(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    {editIsRecurring && (
                      <div className="space-y-3.5 pt-2 border-t border-slate-700/60 animate-in fade-in slide-in-from-top-1">
                        {/* Frequência: Semanal, Quinzenal, Mensal */}
                        <div>
                          <label className="block font-semibold text-slate-300 mb-1.5 text-xs">
                            Frequência da Recorrência *
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setEditRecurrenceFrequency('WEEKLY')}
                              className={`py-2 px-2 rounded-xl border text-center font-semibold transition cursor-pointer flex flex-col items-center gap-0.5 ${
                                editRecurrenceFrequency === 'WEEKLY'
                                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                              }`}
                            >
                              <span className="text-xs">Semanal</span>
                              <span className="text-[10px] opacity-75 font-normal">A cada 7 dias</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditRecurrenceFrequency('BIWEEKLY')}
                              className={`py-2 px-2 rounded-xl border text-center font-semibold transition cursor-pointer flex flex-col items-center gap-0.5 ${
                                editRecurrenceFrequency === 'BIWEEKLY'
                                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                              }`}
                            >
                              <span className="text-xs">Quinzenal</span>
                              <span className="text-[10px] opacity-75 font-normal">A cada 14 dias</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditRecurrenceFrequency('MONTHLY')}
                              className={`py-2 px-2 rounded-xl border text-center font-semibold transition cursor-pointer flex flex-col items-center gap-0.5 ${
                                editRecurrenceFrequency === 'MONTHLY'
                                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                              }`}
                            >
                              <span className="text-xs">Mensal</span>
                              <span className="text-[10px] opacity-75 font-normal">Mesmo dia/mês</span>
                            </button>
                          </div>
                        </div>

                        {/* Término: Nunca, Após X sessões, Em determinada data */}
                        <div>
                          <label className="block font-semibold text-slate-300 mb-1.5 text-xs">
                            Término da Recorrência *
                          </label>
                          <div className="grid grid-cols-3 gap-2 mb-2.5">
                            <button
                              type="button"
                              onClick={() => setEditRecurrenceEndType('NEVER')}
                              className={`py-1.5 px-2 rounded-lg border text-center font-semibold text-xs transition cursor-pointer ${
                                editRecurrenceEndType === 'NEVER'
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Nunca
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditRecurrenceEndType('COUNT')}
                              className={`py-1.5 px-2 rounded-lg border text-center font-semibold text-xs transition cursor-pointer ${
                                editRecurrenceEndType === 'COUNT'
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Após X sessões
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditRecurrenceEndType('DATE')}
                              className={`py-1.5 px-2 rounded-lg border text-center font-semibold text-xs transition cursor-pointer ${
                                editRecurrenceEndType === 'DATE'
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Em determinada data
                            </button>
                          </div>

                          {/* Sub-inputs based on endType */}
                          {editRecurrenceEndType === 'COUNT' && (
                            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-300 font-medium text-xs">Quantidade total de sessões:</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditRecurrenceCount((prev) => Math.max(2, prev - 1))}
                                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold border border-slate-700 cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="2"
                                    max="52"
                                    value={editRecurrenceCount}
                                    onChange={(e) => setEditRecurrenceCount(Math.max(2, Math.min(52, Number(e.target.value) || 2)))}
                                    className="w-14 text-center rounded-lg border border-slate-700 bg-slate-800 py-1 text-white font-bold text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditRecurrenceCount((prev) => Math.min(52, prev + 1))}
                                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold border border-slate-700 cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              {/* Quick count presets */}
                              <div className="flex items-center gap-1.5 pt-1">
                                <span className="text-[10px] text-slate-400">Atalhos:</span>
                                {[4, 8, 12, 24].map((count) => (
                                  <button
                                    key={count}
                                    type="button"
                                    onClick={() => setEditRecurrenceCount(count)}
                                    className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold cursor-pointer ${
                                      editRecurrenceCount === count
                                        ? 'bg-indigo-500 text-white border-indigo-400'
                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                    }`}
                                  >
                                    {count} sessões
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {editRecurrenceEndType === 'DATE' && (
                            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60">
                              <label className="block text-slate-300 font-medium mb-1 text-xs">
                                Data limite final para repetição:
                              </label>
                              <input
                                type="date"
                                value={editRecurrenceEndDate}
                                min={editDate}
                                onChange={(e) => setEditRecurrenceEndDate(e.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-white text-xs"
                                required
                              />
                            </div>
                          )}

                          {editRecurrenceEndType === 'NEVER' && (
                            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 text-[11px] leading-relaxed flex items-start gap-2">
                              <Sparkles className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
                              <span>
                                <strong>Recorrência Contínua:</strong> O sistema criará os agendamentos dos próximos 6 meses (26 semanas) e manterá o horário reservado para o paciente na agenda.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Conflict Real-time Warning */}
                {editHasConflict && (
                  <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>
                      <strong>Atenção:</strong> Este horário coincide com outro agendamento. Se não for um atendimento em grupo, ajuste o horário.
                    </span>
                  </div>
                )}

                {/* Botões Rodapé da Edição */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditingSession(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    {isSavingEdit ? (
                      <>
                        <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Salvar Alterações</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* TELA PADRÃO DE DETALHES DA SESSÃO */
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                      Ψ
                    </div>
                    <div>
                      <h2
                        onClick={() => {
                          if (onNavigateToPatient && selectedSessionForDetails.patient_id) {
                            onNavigateToPatient(selectedSessionForDetails.patient_id, 'profile');
                            handleCloseDetailsModal();
                          }
                        }}
                        className={`text-lg font-bold text-white flex items-center gap-1.5 ${
                          onNavigateToPatient ? 'cursor-pointer hover:text-teal-300 hover:underline' : ''
                        }`}
                        title={onNavigateToPatient ? 'Acessar cadastro completo do paciente' : undefined}
                      >
                        <span>{selectedSessionForDetails.patient_name}</span>
                        {onNavigateToPatient && <ExternalLink className="h-4 w-4 text-teal-400 opacity-80" />}
                      </h2>
                      <p className="text-xs text-slate-400">
                        CPF: {selectedSessionForDetails.patient_cpf || 'Não informado'} • Tel: {selectedSessionForDetails.patient_phone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStartEditSession(selectedSessionForDetails)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-xs font-semibold text-white transition cursor-pointer"
                      title="Editar agendamento, data, horário ou recorrência"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={handleCloseDetailsModal}
                      className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {selectedSessionForDetails.session_type === 'EVALUATION' && (
                  <div className="mb-3.5 flex items-center gap-2 rounded-xl bg-purple-950/70 border border-purple-800/80 p-2.5 text-xs text-purple-200">
                    <Brain className="h-4 w-4 text-purple-400 shrink-0" />
                    <span>Sessão vinculada ao pacote fechado de <strong>Avaliação Neuropsicológica</strong> (sem cobrança avulsa).</span>
                  </div>
                )}

                {/* Session Metadata Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Data & Hora</span>
                    <span className="font-bold text-white">
                      {new Date(selectedSessionForDetails.start_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às{' '}
                      {new Date(selectedSessionForDetails.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Modalidade</span>
                    <span className="font-bold text-white flex items-center gap-1 mt-0.5">
                      {selectedSessionForDetails.modality === 'ONLINE' ? (
                        <>
                          <Video className="h-3.5 w-3.5 text-sky-400" />
                          <span>Online</span>
                        </>
                      ) : (
                        <>
                          <Building className="h-3.5 w-3.5 text-amber-400" />
                          <span>Presencial</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Situação</span>
                    <span
                      className={`font-bold text-xs ${
                        selectedSessionForDetails.status === 'CONFIRMED'
                          ? 'text-emerald-400'
                          : selectedSessionForDetails.status === 'COMPLETED'
                          ? 'text-purple-400'
                          : selectedSessionForDetails.status === 'NO_SHOW'
                          ? 'text-rose-400'
                          : selectedSessionForDetails.status === 'CANCELED'
                          ? selectedSessionForDetails.cancellation_reason === 'PATIENT'
                            ? 'text-rose-400'
                            : selectedSessionForDetails.cancellation_reason === 'PSYCHOLOGIST'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                          : 'text-indigo-300'
                      }`}
                    >
                      {selectedSessionForDetails.status === 'CONFIRMED'
                        ? 'Confirmada'
                        : selectedSessionForDetails.status === 'COMPLETED'
                        ? 'Realizada'
                        : selectedSessionForDetails.status === 'NO_SHOW'
                        ? 'Falta'
                        : selectedSessionForDetails.status === 'CANCELED'
                        ? selectedSessionForDetails.cancellation_reason === 'PATIENT'
                          ? 'Paciente Cancelou'
                          : selectedSessionForDetails.cancellation_reason === 'PSYCHOLOGIST'
                          ? 'Psicólogo Cancelou'
                          : 'Cancelada'
                        : 'Agendada'}
                    </span>
                  </div>
                </div>

                {/* Consultório Físico Destacado (Sem cortes) */}
                {isRoomsEnabled && selectedSessionForDetails.modality === 'PRESENTIAL' && (
                  <div className="mb-3.5 p-3 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Building className="h-4 w-4 text-amber-400 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                          Consultório Físico Reservado
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {selectedSessionForDetails.room_name ? (
                            <>
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold text-white shadow-xs shrink-0"
                                style={{ backgroundColor: selectedSessionForDetails.room_color || '#0d9488' }}
                              >
                                {selectedSessionForDetails.room_initials || getRoomInitials(selectedSessionForDetails)}
                              </span>
                              <span className="font-bold text-white text-sm">
                                {selectedSessionForDetails.room_name}
                              </span>
                            </>
                          ) : (
                            <span className="text-amber-400 text-xs font-semibold">
                              ⚠️ Nenhuma sala física vinculada (clique em Editar para definir)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedSessionForDetails.room_name && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-lg font-bold shrink-0 hidden sm:inline-block">
                        ✓ Sala Reservada
                      </span>
                    )}
                  </div>
                )}

                {/* Honorários Previstos */}
                {canViewFinancial && selectedSessionForDetails.price != null && (
                  <div className="mb-3.5 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Honorários Previstos:</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      {selectedSessionForDetails.session_type === 'EVALUATION'
                        ? 'Pacote de Avaliação Neuropsicológica'
                        : `R$ ${selectedSessionForDetails.price.toFixed(2)}`}
                    </span>
                  </div>
                )}

                {/* Atendimento por Convênio & Atalho para Guia */}
                {selectedSessionForDetails.patient_id && onNavigateToPatient && (
                  <div className="mb-3.5 px-3 py-2 rounded-xl bg-teal-950/40 border border-teal-800/60 flex items-center justify-between text-xs text-teal-200">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-teal-400 shrink-0" />
                      <span>Convênio & Autorizações do Paciente</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateToPatient(selectedSessionForDetails.patient_id, 'insurance');
                        handleCloseDetailsModal();
                      }}
                      className="text-[11px] font-bold text-teal-300 hover:text-white underline cursor-pointer"
                    >
                      Acessar Guias & Saldo →
                    </button>
                  </div>
                )}

                {/* Recurring session info badge */}
                {selectedSessionForDetails.recurrence_group_id && (
                  <div className="mb-4 px-3 py-2 rounded-xl bg-indigo-950/60 border border-indigo-700/60 flex items-center justify-between text-xs text-indigo-200">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-indigo-400 shrink-0" />
                      <span>
                        Agendamento Recorrente: <strong>{selectedSessionForDetails.recurrence_pattern || 'Série'}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] bg-indigo-900/80 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-700/50 font-bold">
                      Série Ativa
                    </span>
                  </div>
                )}

                {selectedSessionForDetails.notes && (
                  <div className="mb-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                    <span className="font-bold block text-slate-400 mb-0.5">Observações:</span>
                    "{selectedSessionForDetails.notes}"
                  </div>
                )}

                {/* Quick Status Changers */}
                <div className="mb-5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Alterar Situação do Agendamento:
                  </span>
                  
                  <div className="space-y-2 text-xs font-semibold">
                    {/* Linha 1: Três situações principais */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleStatusChange(selectedSessionForDetails.id, 'CONFIRMED')}
                        className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          selectedSessionForDetails.status === 'CONFIRMED'
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        <ThumbsUp className="h-4 w-4 shrink-0" />
                        <span className="truncate">Confirmado</span>
                      </button>

                      <button
                        onClick={() => handleStatusChange(selectedSessionForDetails.id, 'COMPLETED')}
                        className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          selectedSessionForDetails.status === 'COMPLETED'
                            ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <span className="truncate">Realizada</span>
                      </button>

                      <button
                        onClick={() => handleStatusChange(selectedSessionForDetails.id, 'NO_SHOW')}
                        className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          selectedSessionForDetails.status === 'NO_SHOW'
                            ? 'bg-rose-600 text-white border-rose-500 shadow-xs'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="truncate">Falta</span>
                      </button>
                    </div>

                    {/* Linhas 2 e 3: Cancelamentos um acima do outro com destaque visual e rótulo claro */}
                    <div className="pt-2 border-t border-slate-800 space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        Opções de Cancelamento:
                      </span>
                      <button
                        onClick={() => handleStatusChange(selectedSessionForDetails.id, 'CANCELED_BY_PATIENT')}
                        className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer font-bold ${
                          selectedSessionForDetails.status === 'CANCELED' &&
                          selectedSessionForDetails.cancellation_reason === 'PATIENT'
                            ? 'bg-rose-600 text-white border-rose-500 shadow-md ring-2 ring-rose-500/40'
                            : 'bg-slate-800/80 text-rose-300 border-slate-700/80 hover:bg-rose-950/40 hover:text-white hover:border-rose-700'
                        }`}
                        title="Marcar como cancelado pelo paciente"
                      >
                        <UserX className="h-4 w-4 text-rose-400 shrink-0" />
                        <span>Paciente Cancelou</span>
                      </button>

                      <button
                        onClick={() => handleStatusChange(selectedSessionForDetails.id, 'CANCELED_BY_PSYCHOLOGIST')}
                        className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer font-bold ${
                          selectedSessionForDetails.status === 'CANCELED' &&
                          selectedSessionForDetails.cancellation_reason === 'PSYCHOLOGIST'
                            ? 'bg-amber-600 text-white border-amber-500 shadow-md ring-2 ring-amber-500/40'
                            : 'bg-slate-800/80 text-amber-300 border-slate-700/80 hover:bg-amber-950/40 hover:text-white hover:border-amber-700'
                        }`}
                        title="Marcar como cancelado pelo psicólogo"
                      >
                        <UserCheck className="h-4 w-4 text-amber-400 shrink-0" />
                        <span>Psicólogo Cancelou</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-4 border-t border-slate-800">
                  {canAccessClinical && (
                    <button
                      onClick={() => {
                        const s = selectedSessionForDetails;
                        setSelectedSessionForDetails(null);
                        onStartSession(s.patient_id, s.id);
                      }}
                      className="w-full sm:flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                    >
                      <PlayCircle className="h-4 w-4" />
                      <span>Iniciar Atendimento Clínico (DAP/BIRP)</span>
                    </button>
                  )}


                  <button
                    onClick={() => handleWhatsApp(selectedSessionForDetails.id)}
                    className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    title="Enviar lembrete neutro via WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={() => handleDeleteSession(selectedSessionForDetails)}
                    className="p-2.5 rounded-xl text-rose-400 hover:bg-rose-950/60 hover:text-rose-300 transition cursor-pointer"
                    title="Excluir Agendamento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NOVO AGENDAMENTO DE SESSÃO                       */}
      {/* ======================================================== */}
      {isNewSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-400" />
                <span>Novo Agendamento</span>
              </h2>
              <button
                onClick={() => setIsNewSessionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-rose-950/80 border border-rose-800 p-3 text-xs text-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSession} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-300">
                    Paciente *
                  </label>
                  <button
                    type="button"
                    id="btn-quick-new-patient"
                    onClick={() => {
                      setQuickFullName('');
                      setQuickPhone('');
                      setQuickPatientError(null);
                      setQuickPatientSuccess(null);
                      setPatientActiveEvaluations([]);
                      setNewSessionType('PSYCHOTHERAPY');
                      setNewEvaluationId(null);
                      setNewPatientId('__NEW__' as any);
                      setIsQuickPatientModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 hover:text-white border border-indigo-500/40 text-[11px] font-semibold transition cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>+ Novo Paciente</span>
                  </button>
                </div>
                <select
                  data-tour="agenda-modal-patient"
                  value={newPatientId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__NEW__') {
                      setQuickFullName('');
                      setQuickPhone('');
                      setQuickPrice(150); // Optional default or empty
                      setQuickPatientError(null);
                      setQuickPatientSuccess(null);
                      setPatientActiveEvaluations([]);
                      setPatientPendingPricingEvaluations([]);
                      setNewSessionType('PSYCHOTHERAPY');
                      setNewEvaluationId(null);
                      setIsQuickPatientModalOpen(true);
                    } else {
                      const pId = Number(val);
                      setNewPatientId(pId);
                      const patient = patients.find(p => p.id === pId);
                      if (canViewFinancial && patient?.session_price) {
                        setNewPrice(patient.session_price);
                      }
                      fetchPatientEvaluations(pId);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:outline-hidden focus:border-indigo-500"
                  required
                >
                  <option value="" disabled>-- Selecione um paciente --</option>
                  {canCreatePatients && (
                    <option value="__NEW__" className="text-indigo-400 font-bold bg-slate-900">+ Cadastrar Novo Paciente...</option>
                  )}
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} {p.cpf ? `(CPF: ${p.cpf})` : '(Sem CPF)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Avaliação Neuropsicológica Selector (se o paciente possuir avaliação ativa) */}
              {patientActiveEvaluations.length > 0 && (
                <div className="space-y-3 p-3.5 rounded-xl border border-purple-500/30 bg-purple-950/20">
                  <div>
                    <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Brain className="h-4 w-4 text-purple-400" />
                      <span>Tipo do Atendimento Clínico</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewSessionType('EVALUATION');
                          if (patientActiveEvaluations.length > 0) {
                            setNewEvaluationId(patientActiveEvaluations[0].id);
                          }
                          setNewPrice(0);
                        }}
                        className={`p-2.5 rounded-lg text-left border transition text-xs flex flex-col gap-1 cursor-pointer ${
                          newSessionType === 'EVALUATION'
                            ? 'border-purple-500 bg-purple-600/30 text-white font-bold ring-1 ring-purple-500'
                            : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <Brain className="h-3.5 w-3.5 text-purple-400" />
                          <span>Avaliação Neuropsicológica</span>
                        </span>
                        <span className="text-[10px] text-purple-300 font-normal">
                          {canViewFinancial ? 'Pacote fechado (R$ 0,00 avulso)' : 'Sessão do protocolo'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewSessionType('PSYCHOTHERAPY');
                          setNewEvaluationId(null);
                          const patient = patients.find(p => p.id === newPatientId);
                          if (canViewFinancial && patient?.session_price) {
                            setNewPrice(patient.session_price);
                          }
                        }}
                        className={`p-2 rounded-lg text-left border transition text-xs flex flex-col gap-1 cursor-pointer ${
                          newSessionType === 'PSYCHOTHERAPY'
                            ? 'border-indigo-500 bg-indigo-500/20 text-white font-medium ring-1 ring-indigo-500/50'
                            : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-indigo-400" />
                          <span>Psicoterapia Tradicional</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {canViewFinancial ? 'Cobrança padrão por sessão' : 'Atendimento avulso'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {newSessionType === 'EVALUATION' && (
                    <div className="space-y-2 pt-1 border-t border-purple-500/20">
                      {patientActiveEvaluations.length > 1 && (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Vincular à Avaliação:
                          </label>
                          <select
                            value={newEvaluationId || ''}
                            onChange={(e) => setNewEvaluationId(Number(e.target.value))}
                            className="w-full rounded-lg border border-purple-500/40 bg-slate-800 p-2 text-xs text-white focus:outline-hidden"
                          >
                            {patientActiveEvaluations.map((ev) => (
                              <option key={ev.id} value={ev.id}>
                                #{ev.id} - {ev.title} ({ev.status === 'AWAITING_DEVOLUTIVA' ? 'Devolutiva Pendente' : 'Em Andamento'})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <p className="text-[11px] text-purple-300/90 flex items-center gap-1.5 bg-purple-950/40 p-2 rounded-lg border border-purple-500/20">
                        <span>ℹ️</span> Esta sessão faz parte do pacote de avaliação{canViewFinancial ? '. O valor será fixado em R$ 0,00 e o controle financeiro é gerido pelas parcelas do laudo.' : ' (sem cobrança avulsa).'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Alerta de Avaliação Pendente de Precificação Comercial */}
              {patientPendingPricingEvaluations.length > 0 && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 flex items-start gap-2.5 text-xs text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold">Avaliação aguardando plano financeiro:</span>
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      Este paciente possui {patientPendingPricingEvaluations.length === 1 ? 'uma avaliação' : `${patientPendingPricingEvaluations.length} avaliações`} aguardando definição e aprovação das condições comerciais pela Recepção/Administração. As sessões deste pacote estarão liberadas para agendamento após a aprovação financeira.
                    </p>
                  </div>
                </div>
              )}

              {canFilterPsychologist && psychologists.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Psicólogo *
                  </label>
                  <select
                    value={newPsychologistId}
                    onChange={(e) => setNewPsychologistId(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:outline-hidden focus:border-indigo-500"
                    required
                  >
                    <option value="" disabled>-- Selecione um psicólogo --</option>
                    {psychologists.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Data da Sessão *
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:outline-hidden focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Horário de Início *
                  </label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:outline-hidden focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Horário de Término *
                  </label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:outline-hidden focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className={`grid ${canViewFinancial ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Modalidade *
                  </label>
                  <select
                    data-tour="agenda-modal-modality"
                    value={newModality}
                    onChange={(e) => setNewModality(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="PRESENTIAL">Presencial (Consultório)</option>
                    <option value="ONLINE">Online (Teleconsulta)</option>
                  </select>
                </div>

                {canViewFinancial && (
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Valor da Sessão (R$) *
                    </label>
                    <input
                      type="number"
                      value={newSessionType === 'EVALUATION' ? 0 : newPrice}
                      onChange={(e) => setNewPrice(Number(e.target.value))}
                      disabled={newSessionType === 'EVALUATION'}
                      className={`w-full rounded-xl border p-2.5 text-white focus:outline-hidden ${
                        newSessionType === 'EVALUATION'
                          ? 'border-purple-500/40 bg-purple-950/30 text-purple-200 cursor-not-allowed'
                          : 'border-slate-700 bg-slate-800 focus:border-indigo-500'
                      }`}
                      step="10"
                      min="0"
                      required
                    />
                    {newSessionType === 'EVALUATION' && (
                      <span className="text-[10px] text-purple-400 mt-1 block">
                        Pacote fechado: faturamento pelas parcelas da avaliação.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* CONSULTÓRIO FÍSICO (Se presencial e módulo ativo) */}
              {isRoomsEnabled && newModality === 'PRESENTIAL' && (
                <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-300">
                      Consultório Físico (Opcional)
                    </label>
                    {isCheckingRooms && (
                      <span className="text-[10px] text-teal-400 flex items-center gap-1 animate-pulse">
                        Verificando disponibilidade...
                      </span>
                    )}
                  </div>

                  <select
                    value={newRoomId || ''}
                    onChange={(e) => setNewRoomId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-xs text-white focus:outline-hidden focus:border-teal-500"
                  >
                    <option value="">-- A definir / Alocar na recepção --</option>
                    {(availableRooms.length > 0 ? availableRooms : allRooms).map((r: any) => {
                      const isConflict = r.is_available === false;
                      return (
                        <option
                          key={r.id}
                          value={r.id}
                          className={isConflict ? 'text-rose-400 bg-slate-900' : 'text-slate-200'}
                        >
                          {r.name} {r.room_type ? `(${r.room_type})` : ''} — {isConflict ? '⚠️ OCUPADA' : '✓ Disponível'}
                        </option>
                      );
                    })}
                  </select>

                  {/* Alerta amigável de choque se sala selecionada estiver ocupada */}
                  {(() => {
                    const selectedRoom = availableRooms.find((r) => r.id === newRoomId);
                    if (selectedRoom && selectedRoom.is_available === false && selectedRoom.conflict_session) {
                      return (
                        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                          <span className="text-sm">⚠️</span>
                          <div>
                            <p className="font-semibold text-[11px]">Conflito de Horário no Consultório</p>
                            <p className="text-[10px] text-rose-200/80">
                              Esta sala já possui atendimento com {selectedRoom.conflict_session.psychologist_name} das{' '}
                              {selectedRoom.conflict_session.start_time.split('T')[1]?.slice(0, 5)} às{' '}
                              {selectedRoom.conflict_session.end_time.split('T')[1]?.slice(0, 5)}.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* RECURRÊNCIA */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg transition ${isRecurring ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      <Repeat className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-200 block text-xs">
                        Agendamento Recorrente
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Repetir esta sessão periodicamente na agenda
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {isRecurring && (
                  <div className="space-y-3.5 pt-2 border-t border-slate-700/60 animate-in fade-in slide-in-from-top-1">
                    {/* Frequência: Semanal, Quinzenal, Mensal */}
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5 text-xs">
                        Frequência da Recorrência *
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setRecurrenceFrequency('WEEKLY')}
                          className={`py-2 px-2 rounded-xl border text-center font-semibold transition cursor-pointer flex flex-col items-center gap-0.5 ${
                            recurrenceFrequency === 'WEEKLY'
                              ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                          }`}
                        >
                          <span className="text-xs">Semanal</span>
                          <span className="text-[10px] opacity-75 font-normal">A cada 7 dias</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRecurrenceFrequency('BIWEEKLY')}
                          className={`py-2 px-2 rounded-xl border text-center font-semibold transition cursor-pointer flex flex-col items-center gap-0.5 ${
                            recurrenceFrequency === 'BIWEEKLY'
                              ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                          }`}
                        >
                          <span className="text-xs">Quinzenal</span>
                          <span className="text-[10px] opacity-75 font-normal">A cada 14 dias</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRecurrenceFrequency('MONTHLY')}
                          className={`py-2 px-2 rounded-xl border text-center font-semibold transition cursor-pointer flex flex-col items-center gap-0.5 ${
                            recurrenceFrequency === 'MONTHLY'
                              ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                          }`}
                        >
                          <span className="text-xs">Mensal</span>
                          <span className="text-[10px] opacity-75 font-normal">Mesmo dia/mês</span>
                        </button>
                      </div>
                    </div>

                    {/* Término: Nunca, Após X sessões, Em determinada data */}
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5 text-xs">
                        Término da Recorrência *
                      </label>
                      <div className="grid grid-cols-3 gap-2 mb-2.5">
                        <button
                          type="button"
                          onClick={() => setRecurrenceEndType('NEVER')}
                          className={`py-1.5 px-2 rounded-lg border text-center font-semibold text-xs transition cursor-pointer ${
                            recurrenceEndType === 'NEVER'
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Nunca
                        </button>

                        <button
                          type="button"
                          onClick={() => setRecurrenceEndType('COUNT')}
                          className={`py-1.5 px-2 rounded-lg border text-center font-semibold text-xs transition cursor-pointer ${
                            recurrenceEndType === 'COUNT'
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Após X sessões
                        </button>

                        <button
                          type="button"
                          onClick={() => setRecurrenceEndType('DATE')}
                          className={`py-1.5 px-2 rounded-lg border text-center font-semibold text-xs transition cursor-pointer ${
                            recurrenceEndType === 'DATE'
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Em determinada data
                        </button>
                      </div>

                      {/* Sub-inputs based on endType */}
                      {recurrenceEndType === 'COUNT' && (
                        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-300 font-medium">Quantidade total de sessões:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setRecurrenceCount((prev) => Math.max(2, prev - 1))}
                                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold border border-slate-700 cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="2"
                                max="52"
                                value={recurrenceCount}
                                onChange={(e) => setRecurrenceCount(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
                                className="w-14 text-center rounded-lg border border-slate-700 bg-slate-800 py-1 text-white font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => setRecurrenceCount((prev) => Math.min(52, prev + 1))}
                                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold border border-slate-700 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          {/* Quick count presets */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-slate-400">Atalhos:</span>
                            {[4, 8, 12, 24].map((count) => (
                              <button
                                key={count}
                                type="button"
                                onClick={() => setRecurrenceCount(count)}
                                className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold cursor-pointer ${
                                  recurrenceCount === count
                                    ? 'bg-indigo-500 text-white border-indigo-400'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                {count} sessões
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {recurrenceEndType === 'DATE' && (
                        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60">
                          <label className="block text-slate-300 font-medium mb-1 text-xs">
                            Data limite final para repetição:
                          </label>
                          <input
                            type="date"
                            value={recurrenceEndDate}
                            min={newDate}
                            onChange={(e) => setRecurrenceEndDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-white text-xs"
                            required
                          />
                        </div>
                      )}

                      {recurrenceEndType === 'NEVER' && (
                        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 text-[11px] leading-relaxed flex items-start gap-2">
                          <Sparkles className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
                          <span>
                            <strong>Recorrência Contínua:</strong> O sistema criará os agendamentos dos próximos 6 meses (26 semanas) e manterá o horário reservado para o paciente na agenda.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Resumo Dinâmico & Detecção de Conflitos */}
                    {previewOccurrences.length > 0 && (
                      <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-3 text-slate-300 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                            <CalendarDays className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                            <span>
                              {previewOccurrences.length} sessões programadas
                            </span>
                            <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
                              ({newDate ? newDate.split('-').reverse().join('/') : ''} a{' '}
                              {previewOccurrences[previewOccurrences.length - 1]?.date.split('-').reverse().join('/')})
                            </span>
                          </div>
                          {canViewFinancial && (
                            <span className="font-extrabold text-emerald-400 text-xs">
                              Total: R$ {(previewOccurrences.length * Number(newPrice)).toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Conflict detection notice */}
                        {previewOccurrences.some((o) => o.has_conflict) ? (
                          <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/80 text-amber-200 text-[11px] flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-medium">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              Atenção: {previewOccurrences.filter((o) => o.has_conflict).length} data(s) possuem conflito de horário ou feriado.
                            </span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-400/90 flex items-center gap-1.5">
                            <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                            <span>Horários verificados: nenhum conflito de agenda encontrado.</span>
                          </div>
                        )}

                        {/* Toggle Preview occurrences list */}
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowPreviewList(!showPreviewList)}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline flex items-center gap-1 cursor-pointer"
                          >
                            <ListOrdered className="h-3 w-3" />
                            <span>{showPreviewList ? 'Ocultar lista de datas' : `Ver todas as ${previewOccurrences.length} datas geradas`}</span>
                          </button>

                          {showPreviewList && (
                            <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-2 space-y-1">
                              {previewOccurrences.map((occ, idx) => (
                                <div
                                  key={idx}
                                  className={`text-[11px] flex items-center justify-between px-2 py-1 rounded-md ${
                                    occ.has_conflict ? 'bg-amber-950/40 text-amber-300 border border-amber-800/50' : 'bg-slate-800/60 text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-400">{idx + 1}ª</span>
                                    <span>{occ.date.split('-').reverse().join('/')}</span>
                                    <span className="text-slate-400 font-mono">
                                      {occ.start_time.split('T')[1].substring(0, 5)} - {occ.end_time.split('T')[1].substring(0, 5)}
                                    </span>
                                  </div>
                                  {occ.has_conflict ? (
                                    <span className="text-amber-400 text-[10px] font-semibold">
                                      ⚠️ {occ.conflict_reason}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400 text-[10px]">Livre ✓</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Observações Gerais (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Demanda de avaliação ou observações clínicas"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Conflict Real-time Warning */}
              {createHasConflict && (
                <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>Atenção:</strong> Este horário coincide com outro agendamento. Se não for um atendimento em grupo, ajuste o horário.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewSessionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-tour="agenda-modal-save-btn"
                  disabled={isSubmittingSession}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingSession ? (
                    <span>Salvando...</span>
                  ) : isRecurring ? (
                    <>
                      <Repeat className="h-4 w-4" />
                      <span>Salvar {previewOccurrences.length || ''} Agendamentos Recorrentes</span>
                    </>
                  ) : (
                    <span>Salvar Agendamento</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CADASTRO RÁPIDO DE PACIENTE                      */}
      {/* ======================================================== */}
      {isQuickPatientModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-white">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Cadastro Rápido de Paciente</h3>
                    <p className="text-[11px] text-slate-400">Insira os dados essenciais para agendamento imediato</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickPatientModalOpen(false);
                    if (newPatientId === '__NEW__') setNewPatientId('');
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {quickPatientError && (
                <div className="mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200">
                  {quickPatientError}
                </div>
              )}

              {quickPatientSuccess && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{quickPatientSuccess}</span>
                </div>
              )}

              <form onSubmit={handleQuickRegisterPatient} className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Nome Completo do Paciente *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Maria Silva Santos"
                    value={quickFullName}
                    onChange={(e) => setQuickFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs"
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Celular / WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="tel"
                      placeholder="(11) 98765-4321"
                      value={quickPhone}
                      onChange={(e) => handlePhoneInputChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Utilizado para envio de confirmações e lembretes de sessão via WhatsApp.
                  </span>
                </div>

                {canViewFinancial && (
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Valor da Sessão
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="180.00"
                        value={quickPrice}
                        onChange={(e) => setQuickPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-[11px] text-indigo-200/90 leading-relaxed">
                  ℹ️ O novo paciente será incluído instantaneamente na <strong>Lista Geral de Pacientes</strong>. Dados complementares como CPF, endereço ou prontuário poderão ser preenchidos a qualquer momento no módulo de Pacientes.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickPatientModalOpen(false);
                      if (newPatientId === '__NEW__') setNewPatientId('');
                    }}
                    className="rounded-xl px-4 py-2 font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingQuickPatient}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50 shadow-md cursor-pointer"
                  >
                    {isSubmittingQuickPatient ? 'Salvando...' : 'Salvar e Selecionar'}
                  </button>
                </div>
              </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NOVO EVENTO / LEMBRETE DIA TODO                  */}
      {/* ======================================================== */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">
                Adicionar Lembrete / Evento (Dia Todo)
              </h2>
              <button
                onClick={() => setIsNewEventModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Título do Lembrete *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Aluguel 💵, Feriado 🏳️, Energia elétrica 💵"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:outline-hidden focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Data *
                </label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:outline-hidden focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Tipo do Evento *
                </label>
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="FINANCIAL">Despesa / Conta a Pagar (💵)</option>
                  <option value="REMINDER">Lembrete Administrativo (📋)</option>
                  <option value="HOLIDAY">Feriado / Recesso (🏳️)</option>
                </select>
              </div>

              {newEventType === 'FINANCIAL' && (
                <div className="space-y-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Valor (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 450.00"
                        value={newEventAmount}
                        onChange={(e) => setNewEventAmount(e.target.value ? Number(e.target.value) : '')}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-white focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Categoria
                      </label>
                      <select
                        value={newEventCategory}
                        onChange={(e) => setNewEventCategory(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-white focus:outline-hidden focus:border-indigo-500"
                      >
                        <option value="ALUGUEL">Aluguel / Sala</option>
                        <option value="CONDOMINIO">Condomínio</option>
                        <option value="ENERGIA">Energia Elétrica</option>
                        <option value="INTERNET">Internet / Telefonia</option>
                        <option value="CRP">CRP / Conselho</option>
                        <option value="SOFTWARE">Software / PsicoManager</option>
                        <option value="SUPERVISAO">Supervisão Clínica</option>
                        <option value="MARKETING">Marketing / Divulgação</option>
                        <option value="OUTROS">Outras Despesas</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Situação Inicial
                      </label>
                      <select
                        value={newEventStatus}
                        onChange={(e) => setNewEventStatus(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-white focus:outline-hidden focus:border-indigo-500"
                      >
                        <option value="PENDING">⏳ Pendente</option>
                        <option value="PAID">✓ Já Pago</option>
                      </select>
                    </div>

                    {newEventStatus === 'PAID' && (
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">
                          Forma Pagamento
                        </label>
                        <select
                          value={newEventPaymentMethod}
                          onChange={(e) => setNewEventPaymentMethod(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-white focus:outline-hidden focus:border-indigo-500"
                        >
                          <option value="PIX">PIX</option>
                          <option value="BOLETO">Boleto</option>
                          <option value="CARTAO">Cartão</option>
                          <option value="TRANSFERENCIA">Transferência</option>
                          <option value="DEBITO_AUTOMATICO">Débito Aut.</option>
                          <option value="DINHEIRO">Dinheiro</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-sm cursor-pointer"
                >
                  Salvar {newEventType === 'FINANCIAL' ? 'Despesa' : 'Lembrete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DETALHES & BAIXA DE CONTA/EVENTO (DIA TODO)       */}
      {/* ======================================================== */}
      {selectedFinancialEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl ${
                    selectedFinancialEvent.event_type === 'FINANCIAL'
                      ? selectedFinancialEvent.status === 'PAID'
                        ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                        : selectedFinancialEvent.date < todayStr
                        ? 'bg-rose-950 border border-rose-800 text-rose-400'
                        : 'bg-amber-950 border border-amber-800 text-amber-400'
                      : selectedFinancialEvent.event_type === 'HOLIDAY'
                      ? 'bg-sky-950 border border-sky-800 text-sky-400'
                      : 'bg-purple-950 border border-purple-800 text-purple-400'
                  }`}
                >
                  {selectedFinancialEvent.event_type === 'FINANCIAL' ? (
                    <Receipt className="h-5 w-5" />
                  ) : selectedFinancialEvent.event_type === 'HOLIDAY' ? (
                    <CalendarIcon className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {selectedFinancialEvent.title}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {selectedFinancialEvent.event_type === 'FINANCIAL'
                      ? 'Despesa / Conta a Pagar'
                      : selectedFinancialEvent.event_type === 'HOLIDAY'
                      ? 'Feriado / Recesso'
                      : 'Lembrete Administrativo'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedFinancialEvent(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Informações detalhadas do evento */}
            <div className="space-y-3 mb-5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Data / Vencimento</span>
                  <span className="font-bold text-white text-sm">
                    {selectedFinancialEvent.date.split('-').reverse().join('/')}
                  </span>
                </div>

                {selectedFinancialEvent.amount != null ? (
                  <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Valor da Despesa</span>
                    <span className="font-bold text-rose-400 text-sm">
                      R$ {Number(selectedFinancialEvent.amount).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Tipo</span>
                    <span className="font-bold text-slate-300 text-sm">
                      {selectedFinancialEvent.event_type}
                    </span>
                  </div>
                )}
              </div>

              {selectedFinancialEvent.event_type === 'FINANCIAL' && (
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Situação do Pagamento:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        selectedFinancialEvent.status === 'PAID'
                          ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-600/50'
                          : selectedFinancialEvent.date < todayStr
                          ? 'bg-rose-900/80 text-rose-300 border border-rose-600/50'
                          : 'bg-amber-900/80 text-amber-300 border border-amber-600/50'
                      }`}
                    >
                      {selectedFinancialEvent.status === 'PAID'
                        ? '✓ PAGO'
                        : selectedFinancialEvent.date < todayStr
                        ? '⚠️ VENCIDO'
                        : '⏳ PENDENTE'}
                    </span>
                  </div>

                  {selectedFinancialEvent.status === 'PAID' && selectedFinancialEvent.payment_date && (
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Data de Liquidação:</span>
                      <span className="text-white font-medium">
                        {selectedFinancialEvent.payment_date.split('-').reverse().join('/')}
                      </span>
                    </div>
                  )}

                  {selectedFinancialEvent.category && (
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Categoria da Despesa:</span>
                      <span className="text-slate-200 font-semibold capitalize">
                        {selectedFinancialEvent.category.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Seção de Baixa / Ações Financeiras Diretas na Agenda */}
              {selectedFinancialEvent.event_type === 'FINANCIAL' && (
                <div className="p-3 rounded-xl bg-slate-800 border border-slate-700/80 space-y-2.5">
                  <span className="font-bold text-slate-300 block">Ações Financeiras Rápidas:</span>

                  {selectedFinancialEvent.status !== 'PAID' ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Data Pagamento:</label>
                          <input
                            type="date"
                            value={payEventDate}
                            onChange={(e) => setPayEventDate(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Forma de Pagamento:</label>
                          <select
                            value={payEventMethod}
                            onChange={(e) => setPayEventMethod(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                          >
                            <option value="PIX">PIX</option>
                            <option value="BOLETO">Boleto</option>
                            <option value="CARTAO">Cartão de Crédito</option>
                            <option value="TRANSFERENCIA">Transferência / TED</option>
                            <option value="DEBITO_AUTOMATICO">Débito Automático</option>
                            <option value="DINHEIRO">Dinheiro</option>
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={() => handleUpdateEventStatus(selectedFinancialEvent.id, 'PAID')}
                        disabled={isUpdatingEventStatus}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>{isUpdatingEventStatus ? 'Registrando...' : 'Dar Baixa / Confirmar Pagamento'}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpdateEventStatus(selectedFinancialEvent.id, 'PENDING')}
                      disabled={isUpdatingEventStatus}
                      className="w-full py-2 px-3 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <Clock className="h-4 w-4" />
                      <span>{isUpdatingEventStatus ? 'Atualizando...' : 'Reabrir Pagamento (Marcar como Pendente)'}</span>
                    </button>
                  )}

                  {onNavigateToFinancial && (
                    <button
                      onClick={() => {
                        setSelectedFinancialEvent(null);
                        onNavigateToFinancial('expenses');
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-indigo-900/50 transition cursor-pointer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Abrir no Módulo de Despesas</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  handleDeleteEvent(selectedFinancialEvent.id);
                  setSelectedFinancialEvent(null);
                }}
                className="text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Excluir Evento</span>
              </button>

              <button
                onClick={() => setSelectedFinancialEvent(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EXCLUSÃO DE SÉRIE RECORRENTE                      */}
      {/* ======================================================== */}
      {recurringSessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 mb-3 text-amber-400">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Repeat className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Agendamento Recorrente</h3>
                <p className="text-xs text-slate-400">Este horário faz parte de uma série</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              A sessão com <strong className="text-white">{recurringSessionToDelete.patient_name}</strong> é recorrente ({recurringSessionToDelete.recurrence_pattern || 'Série'}).
              Como você deseja proceder com o cancelamento?
            </p>

            <div className="space-y-2.5 mb-5">
              <button
                onClick={() => confirmRecurringDelete('single')}
                className="w-full p-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-left text-xs transition cursor-pointer group"
              >
                <div className="font-bold text-white group-hover:text-indigo-300">
                  Excluir apenas este agendamento
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Cancela apenas o dia {recurringSessionToDelete.start_time.split('T')[0].split('-').reverse().join('/')}. Os demais horários da série permanecem intactos.
                </div>
              </button>

              <button
                onClick={() => confirmRecurringDelete('future')}
                className="w-full p-3 rounded-xl border border-rose-900/60 bg-rose-950/20 hover:bg-rose-950/40 text-left text-xs transition cursor-pointer group"
              >
                <div className="font-bold text-rose-300 group-hover:text-rose-200">
                  Excluir este e todos os agendamentos futuros
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Preserva o histórico passado e cancela a partir desta data em diante.
                </div>
              </button>

              <button
                onClick={() => confirmRecurringDelete('all')}
                className="w-full p-3 rounded-xl border border-rose-800 bg-rose-900/30 hover:bg-rose-900/50 text-left text-xs transition cursor-pointer group"
              >
                <div className="font-bold text-rose-200">
                  Excluir toda a série recorrente
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  Remove todos os agendamentos desta série na agenda.
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setRecurringSessionToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Flutuante de Prévia Rápida no Hover */}
      {hoverData && (
        <div
          style={{
            position: 'fixed',
            left:
              hoverData.rect.x + hoverData.rect.width + 16 > window.innerWidth - 300
                ? Math.max(10, hoverData.rect.x - 300)
                : hoverData.rect.x + hoverData.rect.width + 10,
            top: Math.min(
              Math.max(10, hoverData.rect.y - 10),
              Math.max(10, window.innerHeight - 280)
            ),
            zIndex: 9999,
          }}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
          }}
          onMouseLeave={() => {
            setHoverData(null);
          }}
          className="w-72 bg-slate-900/98 backdrop-blur-md border border-slate-700/90 p-3.5 rounded-2xl shadow-2xl text-xs text-slate-200 pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header do Popover: Nome do Paciente & Status */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div className="min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                  const pid = hoverData.session.patient_id;
                  setHoverData(null);
                  if (onNavigateToPatient && pid) {
                    onNavigateToPatient(pid, 'profile');
                  }
                }}
                className="font-bold text-white text-sm truncate flex items-center gap-1.5 hover:text-teal-300 hover:underline transition cursor-pointer text-left group"
                title="Acessar Cadastro do Paciente"
              >
                {hoverData.session.session_type === 'EVALUATION' && (
                  <Brain className="h-3.5 w-3.5 text-purple-400 shrink-0" title="Avaliação Neuropsicológica" />
                )}
                <span className="truncate">{hoverData.session.patient_name}</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-teal-400 shrink-0" />
              </button>

              {hoverData.session.patient_phone && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Phone className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span>{hoverData.session.patient_phone}</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      const session = hoverData.session;
                      setHoverData(null);
                      setWhatsappModalSession(session);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60 transition cursor-pointer flex items-center gap-1 text-[10px] font-semibold"
                    title="Abrir Lembrete de Consulta via WhatsApp"
                  >
                    <MessageCircle className="h-3 w-3 text-emerald-400" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              )}
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                hoverData.session.status === 'CONFIRMED'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                  : hoverData.session.status === 'COMPLETED'
                  ? 'bg-purple-950/80 text-purple-300 border-purple-700/80'
                  : hoverData.session.status === 'NO_SHOW'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-700/80'
                  : hoverData.session.status === 'CANCELED'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-700/80'
                  : 'bg-indigo-950/80 text-indigo-300 border-indigo-700/80'
              }`}
            >
              {hoverData.session.status === 'CONFIRMED'
                ? 'Confirmada'
                : hoverData.session.status === 'COMPLETED'
                ? 'Realizada'
                : hoverData.session.status === 'NO_SHOW'
                ? 'Falta'
                : hoverData.session.status === 'CANCELED'
                ? 'Cancelada'
                : 'Agendada'}
            </span>
          </div>

          {/* Dados do Atendimento */}
          <div className="py-2.5 space-y-2 text-xs">
            {/* Aviso de sobreposição / horário simultâneo */}
            {hoverData.overlapInfo && hoverData.overlapInfo.totalCols > 1 && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-950/60 border border-amber-700/60 text-amber-200 text-[11px] font-medium">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>
                  <strong>Horário compartilhado:</strong> {hoverData.overlapInfo.colIndex + 1}º de {hoverData.overlapInfo.totalCols} agendamentos simultâneos
                </span>
              </div>
            )}

            {/* Horário */}
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="h-3.5 w-3.5 text-teal-400 shrink-0" />
              <span>
                {new Date(hoverData.session.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às{' '}
                {new Date(hoverData.session.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                <span className="text-slate-500 ml-1 text-[11px]">
                  ({Math.round((new Date(hoverData.session.end_time).getTime() - new Date(hoverData.session.start_time).getTime()) / 60000)} min)
                </span>
              </span>
            </div>

            {/* Modalidade & Consultório */}
            <div className="flex items-center gap-2 text-slate-300">
              {hoverData.session.modality === 'ONLINE' ? (
                <>
                  <Video className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  <span className="font-semibold text-sky-300">Atendimento Online (Teleconsulta)</span>
                </>
              ) : (
                <>
                  <Building className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold">Presencial:</span>
                    {hoverData.session.room_name ? (
                      <span className="flex items-center gap-1 min-w-0">
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold text-white shrink-0 leading-none"
                          style={{ backgroundColor: hoverData.session.room_color || '#0d9488' }}
                        >
                          {hoverData.session.room_initials || getRoomInitials(hoverData.session)}
                        </span>
                        <span className="truncate text-white font-medium">
                          {hoverData.session.room_name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Sala a definir</span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Profissional Responsável */}
            {hoverData.session.psychologist_name && (
              <div className="flex items-center gap-2 text-slate-300">
                <User className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">
                  Profissional: <strong className="text-white font-medium">{hoverData.session.psychologist_name}</strong>
                </span>
              </div>
            )}

            {/* Honorários / Tipo */}
            {canViewFinancial && hoverData.session.price != null && (
              <div className="flex items-center gap-2 text-slate-300">
                <DollarSign className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>
                  {hoverData.session.session_type === 'EVALUATION' ? (
                    <span className="text-purple-300 font-bold">Pacote de Avaliação Neuropsicológica</span>
                  ) : (
                    <>
                      Honorários: <strong className="text-emerald-400">R$ {hoverData.session.price.toFixed(2)}</strong>
                      {hoverData.session.payment_status === 'PAID' ? (
                        <span className="ml-1 text-[10px] text-emerald-400 font-bold">(Quitado)</span>
                      ) : (
                        <span className="ml-1 text-[10px] text-amber-400">(Pendente)</span>
                      )}
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Observações */}
            {hoverData.session.notes && (
              <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 italic">
                "{hoverData.session.notes}"
              </div>
            )}
          </div>

          {/* Rodapé do Popover: Ação para abrir gestão completa da sessão */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
              const session = hoverData.session;
              setHoverData(null);
              setSelectedSessionForDetails(session);
            }}
            className="pt-2 border-t border-slate-800 text-[10px] flex items-center justify-between cursor-pointer hover:bg-slate-800/40 -mx-3.5 -mb-3.5 px-3.5 pb-3 pt-2.5 rounded-b-2xl transition group"
            title="Clique para abrir todos os detalhes e gerenciar esta sessão"
          >
            <span className="text-slate-400 group-hover:text-slate-300">Clique para gerenciar a sessão</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                const session = hoverData.session;
                setHoverData(null);
                setSelectedSessionForDetails(session);
              }}
              className="text-teal-400 group-hover:text-teal-300 font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <span>Ver detalhes</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Cobrança para Faltas/Cancelamentos */}
      {billingConfirmation && billingConfirmation.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-indigo-500" />
                <h3 className="font-bold text-slate-800 dark:text-white">Cobrança da Sessão</h3>
              </div>
              <button
                onClick={() => setBillingConfirmation(null)}
                className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 text-center leading-relaxed">
                Você alterou a situação para <strong className="text-slate-800 dark:text-slate-200">{billingConfirmation.status === 'NO_SHOW' ? 'Falta' : 'Cancelado pelo Paciente'}</strong>. <br/><br/>
                Deseja isentar o paciente desta cobrança ou manter a cobrança ativa?
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => confirmStatusChange(billingConfirmation.sessionId, billingConfirmation.status, true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium shadow-sm"
                >
                  <DollarSign className="h-4 w-4" />
                  Manter Cobrança
                </button>
                <button
                  onClick={() => confirmStatusChange(billingConfirmation.sessionId, billingConfirmation.status, false)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition font-medium"
                >
                  <XCircle className="h-4 w-4" />
                  Isentar Paciente (R$ 0,00)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Lembrete de Consulta via WhatsApp */}
      <WhatsAppSessionReminderModal
        isOpen={Boolean(whatsappModalSession)}
        onClose={() => setWhatsappModalSession(null)}
        session={whatsappModalSession}
      />

      {/* Modal de Decisao de Realocacao de Credito Pre-Pago */}
      {reallocationCreditData?.suggestedDonorSession && (
        <PrepaidReallocationModal
          isOpen={isReallocationModalOpen}
          onClose={() => {
            setIsReallocationModalOpen(false);
            setReallocationCreditData(null);
            setPendingSessionPayload(null);
          }}
          patientName={
            patients.find((p) => p.id === Number(newPatientId))?.full_name || 'Paciente'
          }
          newSession={{
            startTime: pendingSessionPayload?.start_time || `${newDate}T${newStartTime}:00`,
            endTime: pendingSessionPayload?.end_time || `${newDate}T${newEndTime}:00`,
            price: pendingSessionPayload?.price ?? Number(newPrice),
            psychologistName: psychologists.find((p) => String(p.id) === String(selectedPsychologistId || user?.id))?.name || user?.name,
          }}
          suggestedDonorSession={reallocationCreditData.suggestedDonorSession}
          hasInvoiceLock={reallocationCreditData.suggestedDonorSession.invoice_id != null}
          onConfirmReallocation={() => {
            if (pendingSessionPayload && reallocationCreditData.suggestedDonorSession?.id) {
              executeSessionCreation(pendingSessionPayload, reallocationCreditData.suggestedDonorSession.id);
            }
          }}
          onConfirmAdditionalSession={() => {
            if (pendingSessionPayload) {
              executeSessionCreation(pendingSessionPayload);
            }
          }}
          isLoading={isExecutingReallocation}
        />
      )}
    </div>
  );
};

