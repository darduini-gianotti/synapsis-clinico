import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Expense,
  ExpenseCategory,
  ExpensePaymentStatus,
  ExpensePaymentMethod,
  ExpenseRecurrencePeriod,
  ExpenseScope,
  ExpenseSettlement,
  SettlementBalance,
} from '../types.js';
import {
  DollarSign,
  Calendar,
  Repeat,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  FileText,
  Download,
  CreditCard,
  Wallet,
  TrendingDown,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Building2,
  Sparkles,
  Users,
  ArrowRight,
  Coins,
  Receipt,
  Scale,
  Handshake,
  Check,
} from 'lucide-react';

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; icon: string; deductible: boolean }[] = [
  { id: 'ALUGUEL', label: 'Aluguel de Consultório', icon: '🏢', deductible: true },
  { id: 'CONDOMINIO', label: 'Condomínio & IPTU', icon: '🏢', deductible: true },
  { id: 'UTILIDADES', label: 'Energia Elétrica & Água', icon: '💡', deductible: true },
  { id: 'TELECOMUNICACOES', label: 'Internet Fibra & Telefonia', icon: '🌐', deductible: true },
  { id: 'CRP_CONSELHO', label: 'Anuidade Conselho (CRP/CFP)', icon: '⚖️', deductible: true },
  { id: 'SERVICOS_PROFISSIONAIS', label: 'Assessoria Contábil & Jurídica', icon: '📑', deductible: true },
  { id: 'SISTEMAS_SOFTWARE', label: 'Software & Prontuário Digital', icon: '💻', deductible: true },
  { id: 'MATERIAIS_TESTES', label: 'Protocolos & Testes Psicológicos', icon: '📋', deductible: true },
  { id: 'MANUTENCAO_LIMPEZA', label: 'Limpeza, Higiene & Manutenção', icon: '🧹', deductible: true },
  { id: 'OUTROS', label: 'Outras Despesas Operacionais', icon: '📦', deductible: false },
];

export const PAYMENT_METHODS: { id: ExpensePaymentMethod; label: string }[] = [
  { id: 'PIX', label: 'PIX' },
  { id: 'BOLETO', label: 'Boleto Bancário' },
  { id: 'DEBITO_AUTOMATICO', label: 'Débito Automático' },
  { id: 'CARTAO', label: 'Cartão de Crédito/Débito' },
  { id: 'TRANSFERENCIA', label: 'Transferência Bancária (TED/DOC)' },
  { id: 'DINHEIRO', label: 'Dinheiro' },
];

interface ExpenseSummary {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  deductible: number;
}

interface ExpensesModuleProps {
  onNavigateToAgenda?: () => void;
}

export const ExpensesModule: React.FC<ExpensesModuleProps> = ({ onNavigateToAgenda }) => {
  const { user, isAdmin } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    deductible: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    // Por padrão o mês atual do sistema (2026-09 ou data corrente)
    return '2026-09';
  });
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'CLINIC' | 'INDIVIDUAL' | 'SHARED'>('ALL');
  const [search, setSearch] = useState('');

  // Modais
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [paymentModalExpense, setPaymentModalExpense] = useState<Expense | null>(null);
  const [deleteConfirmExpense, setDeleteConfirmExpense] = useState<Expense | null>(null);
  const [isCarneLeaoBookOpen, setIsCarneLeaoBookOpen] = useState(false);
  const [carneLeaoBookData, setCarneLeaoBookData] = useState<any>(null);
  const [isLoadingBook, setIsLoadingBook] = useState(false);

  // Formulário de Criação/Edição
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('ALUGUEL');
  const [formAmount, setFormAmount] = useState<string>('1800.00');
  const [formDueDate, setFormDueDate] = useState<string>('2026-09-10');
  const [formStatus, setFormStatus] = useState<ExpensePaymentStatus>('PENDING');
  const [formPaymentDate, setFormPaymentDate] = useState<string>('2026-09-10');
  const [formPaymentMethod, setFormPaymentMethod] = useState<ExpensePaymentMethod>('PIX');
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formRecurrencePeriod, setFormRecurrencePeriod] = useState<ExpenseRecurrencePeriod>('MONTHLY');
  const [formInstallmentsTotal, setFormInstallmentsTotal] = useState<number>(12);
  const [formCarneLeaoDeductible, setFormCarneLeaoDeductible] = useState(true);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rateio de Consultório Compartilhado & Escopo
  const [psychologists, setPsychologists] = useState<any[]>([]);
  const [formScope, setFormScope] = useState<ExpenseScope>('CLINIC');
  const [formPayerUserId, setFormPayerUserId] = useState<number | ''>('');
  const [formPsychologistId, setFormPsychologistId] = useState<number | ''>('');
  const [formIsShared, setFormIsShared] = useState(false);
  const [formSharedSplits, setFormSharedSplits] = useState<{ [key: number]: number }>({});
  const [formRfbAccountCode, setFormRfbAccountCode] = useState<string>('ALUGUEL_SUBLOCACAO');

  // Acerto de Contas & Reembolsos entre Terapeutas
  const [settlementData, setSettlementData] = useState<{
    balances: SettlementBalance[];
    settlements: ExpenseSettlement[];
    sharedExpensesCount: number;
  } | null>(null);
  const [isLoadingSettlements, setIsLoadingSettlements] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<SettlementBalance | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleDate, setSettleDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [settleMethod, setSettleMethod] = useState<string>('PIX');
  const [settleNotes, setSettleNotes] = useState<string>('');
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  // Modal de Baixa Rápida de Pagamento
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [payMethod, setPayMethod] = useState<ExpensePaymentMethod>('PIX');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Escopo de Exclusão
  const [deleteScope, setDeleteScope] = useState<'single' | 'all' | 'future'>('single');
  const [isDeleting, setIsDeleting] = useState(false);

  const distributeEvenly = (psychs: any[]) => {
    if (!psychs || psychs.length === 0) return;
    const count = psychs.length;
    const basePct = Math.floor((100 / count) * 10) / 10;
    const remainder = Number((100 - (basePct * (count - 1))).toFixed(1));
    const newSplits: { [key: number]: number } = {};
    psychs.forEach((p, idx) => {
      newSplits[p.id] = idx === 0 ? remainder : basePct;
    });
    setFormSharedSplits(newSplits);
  };

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedMonth) params.append('month', selectedMonth);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (scopeFilter !== 'ALL') params.append('scope', scopeFilter);
      if (search) params.append('search', search);

      const res = await api.get(`/financial/expenses?${params.toString()}`);
      setExpenses(res.data.expenses || []);
      setSummary(res.data.summary || { total: 0, paid: 0, pending: 0, overdue: 0, deductible: 0 });
    } catch (err) {
      console.error('Falha ao carregar despesas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettlements = async () => {
    try {
      setIsLoadingSettlements(true);
      const res = await api.get('/financial/expenses/settlement-balance', {
        params: { month: selectedMonth },
      });
      setSettlementData(res.data);
    } catch (err) {
      console.error('Falha ao carregar balanço de acertos:', err);
    } finally {
      setIsLoadingSettlements(false);
    }
  };

  useEffect(() => {
    const fetchPsychs = async () => {
      try {
        const res = await api.get('/users');
        const psychs = (res.data || []).filter((u: any) => u.role === 'PSYCHOLOGIST' || u.role === 'ADMIN');
        setPsychologists(psychs);
      } catch (err) {
        console.error('Falha ao carregar psicólogos para rateio:', err);
      }
    };
    fetchPsychs();
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetchSettlements();
  }, [selectedMonth, statusFilter, categoryFilter, scopeFilter, search]);

  const handleMonthChange = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const yStr = date.getFullYear().toString();
    const mStr = (date.getMonth() + 1).toString().padStart(2, '0');
    setSelectedMonth(`${yStr}-${mStr}`);
  };

  const handleOpenSettlementModal = (balance?: SettlementBalance) => {
    if (balance) {
      setSettlementTarget(balance);
      setSettleAmount(balance.netPending.toFixed(2));
    } else {
      if (psychologists.length >= 2) {
        setSettlementTarget({
          fromUserId: psychologists[0].id,
          fromName: psychologists[0].name,
          toUserId: psychologists[1].id,
          toName: psychologists[1].name,
          grossOwed: 0,
          settledAmount: 0,
          netPending: 0,
        });
      } else {
        setSettlementTarget(null);
      }
      setSettleAmount('');
    }
    setSettleDate(new Date().toISOString().substring(0, 10));
    setSettleMethod('PIX');
    setSettleNotes(`Acerto de rateio de despesas ${selectedMonth}`);
    setSettlementError(null);
    setIsSettlementModalOpen(true);
  };

  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementTarget) return;
    const numAmount = parseFloat(settleAmount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setSettlementError('Informe um valor válido maior que zero');
      return;
    }

    try {
      setIsSubmittingSettlement(true);
      setSettlementError(null);
      await api.post('/financial/expenses/settlements', {
        from_user_id: settlementTarget.fromUserId,
        to_user_id: settlementTarget.toUserId,
        amount: numAmount,
        payment_date: settleDate,
        payment_method: settleMethod,
        competence_month: selectedMonth,
        notes: settleNotes.trim() || null,
      });

      setIsSettlementModalOpen(false);
      setSettlementTarget(null);
      await fetchSettlements();
      await fetchExpenses();
    } catch (err: any) {
      setSettlementError(err.response?.data?.error || 'Erro ao registrar acerto');
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  const handleDeleteSettlement = async (settlementId: number) => {
    if (!confirm('Deseja excluir este registro de acerto? O saldo pendente será recalculado.')) return;
    try {
      await api.delete(`/financial/expenses/settlements/${settlementId}`);
      await fetchSettlements();
      await fetchExpenses();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir acerto');
    }
  };

  const handleOpenNewModal = () => {
    setEditingExpense(null);
    setFormTitle('');
    setFormCategory('ALUGUEL');
    setFormAmount('');
    setFormDueDate(`${selectedMonth}-10`);
    setFormStatus('PENDING');
    setFormPaymentDate(`${selectedMonth}-10`);
    setFormPaymentMethod('PIX');
    setFormIsRecurring(false);
    setFormRecurrencePeriod('MONTHLY');
    setFormInstallmentsTotal(12);
    setFormCarneLeaoDeductible(true);
    setFormNotes('');
    setFormScope('CLINIC');
    setFormPayerUserId(user?.id || '');
    setFormPsychologistId(user?.id || '');
    setFormIsShared(false);
    setFormRfbAccountCode('ALUGUEL_SUBLOCACAO');
    distributeEvenly(psychologists);
    setFormError(null);
    setIsNewExpenseModalOpen(true);
  };

  const handleOpenEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setFormTitle(exp.title);
    setFormCategory(exp.category);
    setFormAmount(exp.amount.toString());
    setFormDueDate(exp.due_date);
    setFormStatus(exp.status);
    setFormPaymentDate(exp.payment_date || exp.due_date);
    setFormPaymentMethod(exp.payment_method || 'PIX');
    setFormIsRecurring(exp.is_recurring);
    setFormRecurrencePeriod(exp.recurrence_period || 'MONTHLY');
    setFormInstallmentsTotal(exp.installments_total || 1);
    setFormCarneLeaoDeductible(exp.carne_leao_deductible);
    setFormNotes(exp.notes || '');
    const currentScope = exp.scope || (exp.is_shared ? 'SHARED' : 'CLINIC');
    setFormScope(currentScope);
    setFormPayerUserId(exp.payer_user_id || '');
    setFormPsychologistId(exp.psychologist_id || '');
    setFormIsShared(currentScope === 'SHARED');
    setFormRfbAccountCode(exp.rfb_account_code || 'ALUGUEL_SUBLOCACAO');
    if (exp.shared_splits_json) {
      try {
        setFormSharedSplits(JSON.parse(exp.shared_splits_json));
      } catch {
        distributeEvenly(psychologists);
      }
    } else {
      distributeEvenly(psychologists);
    }
    setFormError(null);
    setIsNewExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Informe o título ou descrição da despesa');
      return;
    }
    const numAmount = parseFloat(formAmount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Informe um valor válido maior que zero');
      return;
    }
    if (!formDueDate) {
      setFormError('Informe a data de vencimento');
      return;
    }

    const isShared = formScope === 'SHARED';
    if (isShared) {
      const totalPct = (Object.values(formSharedSplits) as number[]).reduce((sum: number, v: number) => sum + (Number(v) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.5) {
        setFormError(`A soma dos percentuais de rateio deve ser exatamente 100%. Total atual: ${totalPct.toFixed(1)}%`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const payload = {
        title: formTitle.trim(),
        category: formCategory,
        amount: numAmount,
        due_date: formDueDate,
        status: formStatus,
        payment_date: formStatus === 'PAID' ? formPaymentDate : null,
        payment_method: formStatus === 'PAID' ? formPaymentMethod : null,
        is_recurring: formIsRecurring,
        recurrence_period: formRecurrencePeriod,
        installments_total: formIsRecurring ? formInstallmentsTotal : 1,
        carne_leao_deductible: formCarneLeaoDeductible,
        notes: formNotes.trim() || null,
        scope: formScope,
        is_shared: isShared ? 1 : 0,
        payer_user_id: formPayerUserId ? Number(formPayerUserId) : null,
        psychologist_id: formScope === 'INDIVIDUAL' && formPsychologistId ? Number(formPsychologistId) : undefined,
        shared_splits_json: isShared ? JSON.stringify(formSharedSplits) : null,
        rfb_account_code: formRfbAccountCode,
      };

      if (editingExpense) {
        await api.put(`/financial/expenses/${editingExpense.id}`, payload);
      } else {
        await api.post('/financial/expenses', payload);
      }

      setIsNewExpenseModalOpen(false);
      await fetchExpenses();
      await fetchSettlements();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Erro ao salvar despesa');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPaymentModal = (exp: Expense) => {
    setPaymentModalExpense(exp);
    setPayDate(new Date().toISOString().substring(0, 10));
    setPayMethod(exp.payment_method || 'PIX');
  };

  const handleConfirmPayment = async () => {
    if (!paymentModalExpense) return;
    try {
      setIsSubmittingPay(true);
      await api.patch(`/financial/expenses/${paymentModalExpense.id}/status`, {
        status: 'PAID',
        payment_date: payDate,
        payment_method: payMethod,
      });
      setPaymentModalExpense(null);
      fetchExpenses();
    } catch (err) {
      console.error('Falha ao registrar pagamento:', err);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleToggleStatusQuick = async (exp: Expense) => {
    if (exp.status === 'PAID') {
      try {
        await api.patch(`/financial/expenses/${exp.id}/status`, {
          status: 'PENDING',
          payment_date: null,
        });
        fetchExpenses();
      } catch (err) {
        console.error('Falha ao reverter pagamento:', err);
      }
    } else {
      handleOpenPaymentModal(exp);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmExpense) return;
    try {
      setIsDeleting(true);
      await api.delete(`/financial/expenses/${deleteConfirmExpense.id}?scope=${deleteScope}`);
      setDeleteConfirmExpense(null);
      fetchExpenses();
    } catch (err) {
      console.error('Falha ao excluir despesa:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenCarneLeaoBook = async () => {
    setIsCarneLeaoBookOpen(true);
    setIsLoadingBook(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const res = await api.get(`/financial/carne-leao-book?year=${year}&month=${month}`);
      setCarneLeaoBookData(res.data);
    } catch (err) {
      console.error('Falha ao buscar Livro-Caixa:', err);
    } finally {
      setIsLoadingBook(false);
    }
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const getCategoryInfo = (cat: ExpenseCategory) => {
    return EXPENSE_CATEGORIES.find((c) => c.id === cat) || {
      id: cat,
      label: cat,
      icon: '📦',
      deductible: false,
    };
  };

  // Mês legível
  const monthName = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    const name = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Gestão de Despesas & Contas a Pagar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Controle de custos do consultório, itens recorrentes, integração direta com a Agenda e Livro-Caixa Carnê-Leão
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector Navigator */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => handleMonthChange(-1)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer"
              title="Mês Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-3 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-[130px] text-center">
              {monthName}
            </div>
            <button
              onClick={() => handleMonthChange(1)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer"
              title="Próximo Mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Botão Livro-Caixa */}
          <button
            onClick={handleOpenCarneLeaoBook}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            <span>Livro-Caixa Carnê-Leão</span>
          </button>

          {/* Botão Nova Despesa */}
          <button
            onClick={handleOpenNewModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Despesa</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Despesas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Total Previsto ({monthName.split(' ')[0]})</span>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
            {formatMoney(summary.total)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {expenses.length} despesa(s) cadastradas
          </div>
        </div>

        {/* Pagas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Contas Pagas</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatMoney(summary.paid)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
            Baixas efetuadas com comprovante
          </div>
        </div>

        {/* Pendentes */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
            <span>A Vencer (Pendentes)</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-amber-600 dark:text-amber-400">
            {formatMoney(summary.pending)}
          </div>
          <div className="mt-1 text-[11px] text-amber-600/80 dark:text-amber-400/80">
            Dentro do prazo de vencimento
          </div>
        </div>

        {/* Vencidas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-medium">
            <span>Vencidas</span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-rose-600 dark:text-rose-400">
            {formatMoney(summary.overdue)}
          </div>
          <div className="mt-1 text-[11px] text-rose-600/80 dark:text-rose-400/80">
            {summary.overdue > 0 ? 'Atenção aos juros/multas' : 'Nenhuma conta atrasada'}
          </div>
        </div>

        {/* Dedutíveis Carnê-Leão */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900/60 shadow-xs">
          <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300 font-medium">
            <span>Dedutíveis (Livro-Caixa)</span>
            <Sparkles className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-indigo-700 dark:text-indigo-300">
            {formatMoney(summary.deductible)}
          </div>
          <div className="mt-1 text-[11px] text-indigo-600/80 dark:text-indigo-400/80">
            Abatimento direto no IRPF
          </div>
        </div>
      </div>

      {/* Painel de Acerto de Contas & Reembolsos entre Terapeutas */}
      {psychologists.length > 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Handshake className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Acerto de Contas & Rateio do Consultório
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {monthName}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cálculo automático de débitos líquidos entre psicólogos que compartilham o mesmo espaço físico
                </p>
              </div>
            </div>

            <button
              onClick={() => handleOpenSettlementModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-2xs transition cursor-pointer self-start sm:self-auto"
            >
              <Coins className="h-4 w-4" />
              <span>Registrar Acerto (PIX)</span>
            </button>
          </div>

          {/* Estado dos Balanços Líquidos */}
          {settlementData.balances.length === 0 ? (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>Tudo em dia!</strong> Não há saldos devedores ou pendências de reembolso calculadas para esta competência.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {settlementData.balances.map((b, idx) => (
                <div
                  key={`${b.fromUserId}-${b.toUserId}-${idx}`}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80 shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {b.fromName}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        deve para <ArrowRight className="h-3 w-3 text-indigo-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{b.toName}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                      {formatMoney(b.netPending)}
                    </span>
                    <button
                      onClick={() => handleOpenSettlementModal(b)}
                      title="Quitar este valor via PIX/Transferência"
                      className="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] transition cursor-pointer"
                    >
                      Liquidar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Histórico de Liquidações Realizadas no Mês */}
          {settlementData.settlements.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
                Reembolsos já Efetuados neste mês ({settlementData.settlements.length})
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {settlementData.settlements.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-200/60 dark:border-emerald-900/30 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-200 font-medium">
                        <strong>{s.from_user_name || s.from_name}</strong> pagou <strong>{s.to_user_name || s.to_name}</strong>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        • {formatDate(s.settlement_date)} ({s.payment_method})
                      </span>
                      {s.notes && (
                        <span className="text-[10px] text-slate-500 italic max-w-xs truncate">
                          - "{s.notes}"
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                        {formatMoney(s.amount)}
                      </span>
                      <button
                        onClick={() => handleDeleteSettlement(s.id)}
                        title="Estornar liquidação"
                        className="text-slate-400 hover:text-rose-500 transition p-1 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {(['ALL', 'PENDING', 'PAID', 'OVERDUE'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st === 'ALL' && 'Todas'}
                {st === 'PENDING' && 'Pendentes'}
                {st === 'PAID' && 'Pagas'}
                {st === 'OVERDUE' && 'Vencidas'}
              </button>
            ))}
          </div>

          {/* Scope Filter Dropdown */}
          <div className="relative">
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as any)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-teal-500"
            >
              <option value="ALL">🏢 Todos os Escopos</option>
              <option value="CLINIC">🏢 Geral da Clínica</option>
              <option value="SHARED">🤝 Rateio Compartilhado</option>
              <option value="INDIVIDUAL">👤 Exclusivas / Privadas</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-teal-500"
            >
              <option value="ALL">Todas as Categorias</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por descrição ou nota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-teal-500"
          />
        </div>
      </div>

      {/* Expenses List / Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full mb-3" />
            <p>Carregando despesas de {monthName}...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
              <TrendingDown className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              Nenhuma despesa encontrada
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Não há lançamentos de despesas registrados para este período ou com os filtros selecionados.
            </p>
            <button
              onClick={handleOpenNewModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Cadastrar Primeira Despesa</span>
            </button>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px]">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                <tr>
                  <th className="py-3.5 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Descrição & Categoria</th>
                  <th className="py-3.5 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Vencimento</th>
                  <th className="py-3.5 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Recorrência</th>
                  <th className="py-3.5 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Carnê-Leão</th>
                  <th className="py-3.5 px-4 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Valor</th>
                  <th className="py-3.5 px-4 text-center bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Situação</th>
                  <th className="py-3.5 px-4 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenses.map((exp: any) => {
                  const catInfo = getCategoryInfo(exp.category);
                  const isOverdue = exp.computed_status === 'OVERDUE';
                  const isPaid = exp.status === 'PAID';

                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition"
                    >
                      {/* Descrição & Categoria */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                          <span>{exp.title}</span>
                          {exp.scope === 'SHARED' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              <Handshake className="h-2.5 w-2.5" />
                              <span>Rateio</span>
                            </span>
                          )}
                          {exp.scope === 'INDIVIDUAL' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <span>Exclusiva {exp.psychologist_name ? `• ${exp.psychologist_name.split(' ')[0]}` : ''}</span>
                            </span>
                          )}
                          {(!exp.scope || exp.scope === 'CLINIC') && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              <span>Geral</span>
                            </span>
                          )}
                          {exp.notes && (
                            <span
                              title={exp.notes}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-help"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <span>{catInfo.icon}</span>
                            <span>{catInfo.label}</span>
                          </span>
                          {exp.payer_name && (
                            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded">
                              Pago por: <strong className="text-slate-600 dark:text-slate-300">{exp.payer_name}</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Vencimento */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatDate(exp.due_date)}
                        </div>
                        {isPaid && exp.payment_date && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            Pago em {formatDate(exp.payment_date)}
                          </div>
                        )}
                        {!isPaid && isOverdue && (
                          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                            Vencido
                          </div>
                        )}
                      </td>

                      {/* Recorrência */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {exp.is_recurring ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            <Repeat className="h-3 w-3" />
                            <span>
                              {exp.installment_number && exp.installments_total
                                ? `${exp.installment_number}/${exp.installments_total}`
                                : 'Mensal'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Única</span>
                        )}
                      </td>

                      {/* Dedutível Carnê-Leão */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          {exp.carne_leao_deductible ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span>Dedutível</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Não dedutível</span>
                          )}
                          {Boolean(exp.is_shared) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                              <span>Rateio ({Object.keys(JSON.parse(exp.shared_splits_json || '{}')).length} psi)</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Valor */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {formatMoney(exp.amount)}
                        </span>
                      </td>

                      {/* Situação */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatusQuick(exp)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                          title="Clique para alterar situação"
                        >
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Pago</span>
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>Vencido</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Pendente</span>
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid && (
                            <button
                              onClick={() => handleOpenPaymentModal(exp)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition cursor-pointer"
                              title="Registrar Pagamento"
                            >
                              Dar Baixa
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditModal(exp)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Editar Despesa"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteConfirmExpense(exp);
                              setDeleteScope('single');
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Excluir Despesa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO DE DESPESA                                      */}
      {/* ========================================================================= */}
      {isNewExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingExpense ? 'Editar Despesa' : 'Cadastrar Nova Despesa'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sincroniza automaticamente com a Agenda do consultório
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewExpenseModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="mt-4 space-y-4 text-xs">
              {/* Título */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título / Descrição da Despesa *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Aluguel da Sala Clínica, Energia Elétrica, Anuidade CRP"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-teal-500 text-xs"
                  required
                />
              </div>

              {/* Categoria e Valor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Categoria *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      const cat = e.target.value as ExpenseCategory;
                      setFormCategory(cat);
                      const catDef = getCategoryInfo(cat);
                      setFormCarneLeaoDeductible(catDef.deductible);
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:border-teal-500 text-xs"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white font-bold placeholder-slate-400 focus:outline-hidden focus:border-teal-500 text-xs"
                    required
                  />
                </div>
              </div>

              {/* Vencimento e Situação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:border-teal-500 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Situação Inicial *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:border-teal-500 text-xs"
                  >
                    <option value="PENDING">Pendente (A pagar)</option>
                    <option value="PAID">Já Pago</option>
                  </select>
                </div>
              </div>

              {/* Se já pago: Data do pagamento e Forma */}
              {formStatus === 'PAID' && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-3">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Dados da Quitação</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Data Efetiva do Pagamento
                      </label>
                      <input
                        type="date"
                        value={formPaymentDate}
                        onChange={(e) => setFormPaymentDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-900 dark:text-white text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Forma de Pagamento
                      </label>
                      <select
                        value={formPaymentMethod}
                        onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-900 dark:text-white text-xs"
                      >
                        {PAYMENT_METHODS.map((pm) => (
                          <option key={pm.id} value={pm.id}>
                            {pm.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Se for criação: Recorrência */}
              {!editingExpense && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Repeat className="h-4 w-4 text-indigo-500" />
                        Despesa Recorrente?
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Gera automaticamente os lançamentos futuros e sincroniza com a Agenda
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsRecurring}
                        onChange={(e) => setFormIsRecurring(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-teal-600" />
                    </label>
                  </div>

                  {formIsRecurring && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Frequência
                        </label>
                        <select
                          value={formRecurrencePeriod}
                          onChange={(e) => setFormRecurrencePeriod(e.target.value as any)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-white text-xs"
                        >
                          <option value="MONTHLY">Mensal (12 meses)</option>
                          <option value="BIMONTHLY">Bimestral</option>
                          <option value="SEMIANNUAL">Semestral</option>
                          <option value="YEARLY">Anual</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Quantidade de Parcelas
                        </label>
                        <input
                          type="number"
                          min="2"
                          max="48"
                          value={formInstallmentsTotal}
                          onChange={(e) => setFormInstallmentsTotal(parseInt(e.target.value) || 12)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-white text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dedutibilidade no Carnê-Leão */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60">
                <input
                  type="checkbox"
                  id="carneLeaoCheck"
                  checked={formCarneLeaoDeductible}
                  onChange={(e) => setFormCarneLeaoDeductible(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <label htmlFor="carneLeaoCheck" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Dedutível no Carnê-Leão (Livro-Caixa da Receita Federal)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Permite abater o valor desta despesa dos rendimentos tributáveis de psicólogo autônomo (código 2251-05).
                  </span>
                </label>
              </div>

              {/* Classificação Oficial Carnê-Leão (Tabela RFB) */}
              {formCarneLeaoDeductible && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Classificação Fiscal RFB (Livro-Caixa) *
                  </label>
                  <select
                    value={formRfbAccountCode}
                    onChange={(e) => setFormRfbAccountCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:border-teal-500 text-xs"
                  >
                    <option value="ALUGUEL_SUBLOCACAO">Aluguel / Sublocação / Coworking de Consultório</option>
                    <option value="CONDOMINIO_IPTU">Condomínio e IPTU do Consultório</option>
                    <option value="ENERGIA_AGUA_TEL">Energia Elétrica, Água, Internet e Telefone</option>
                    <option value="CRP_ANUIDADE">Anuidade CRP / CFP e Órgãos de Classe</option>
                    <option value="HONORARIOS_SECRETARIA">Secretária, Recepção e Serviços de Terceiros</option>
                    <option value="MATERIAL_ESCRITORIO">Material de Escritório, Limpeza e Descartáveis</option>
                    <option value="LIVROS_CURSOS">Livros Técnicos, Testes Psicológicos e Congressos</option>
                    <option value="DESPESAS_GERAIS">Outras Despesas de Custeio e Manutenção</option>
                  </select>
                </div>
              )}

              {/* Escopo da Despesa: Geral, Rateio Compartilhado ou Exclusiva */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3.5">
                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 text-xs mb-1.5">
                    Escopo de Destinação da Despesa *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Opção CLINIC */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormScope('CLINIC');
                        setFormIsShared(false);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        formScope === 'CLINIC'
                          ? 'bg-white dark:bg-slate-900 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                          : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                        <span>🏢</span>
                        <span>Geral da Clínica</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Custeada pela clínica corporativa
                      </span>
                    </button>

                    {/* Opção SHARED */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormScope('SHARED');
                        setFormIsShared(true);
                        if (Object.keys(formSharedSplits).length === 0 && psychologists.length > 0) {
                          distributeEvenly(psychologists);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        formScope === 'SHARED'
                          ? 'bg-white dark:bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-700 dark:text-indigo-400">
                        <span>🤝</span>
                        <span>Rateio Dividido</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Compartilhada entre os psicólogos
                      </span>
                    </button>

                    {/* Opção INDIVIDUAL */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormScope('INDIVIDUAL');
                        setFormIsShared(false);
                        if (!formPsychologistId && psychologists.length > 0) {
                          setFormPsychologistId(psychologists[0].id);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        formScope === 'INDIVIDUAL'
                          ? 'bg-white dark:bg-slate-900 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                          : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-400">
                        <span>👤</span>
                        <span>Exclusiva / Privada</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        De um profissional específico
                      </span>
                    </button>
                  </div>
                </div>

                {/* Se for INDIVIDUAL: Selecionar o Psicólogo Titular */}
                {formScope === 'INDIVIDUAL' && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 animate-in fade-in">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 text-xs">
                      Psicólogo Titular desta Despesa *
                    </label>
                    <select
                      value={formPsychologistId}
                      onChange={(e) => setFormPsychologistId(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-amber-500"
                    >
                      {psychologists.map((psych) => (
                        <option key={psych.id} value={psych.id}>
                          {psych.name} {psych.crp_number ? `(CRP: ${psych.crp_number})` : ''}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Esta despesa é privada: visível apenas para este profissional e administradores.
                    </span>
                  </div>
                )}

                {/* Se for SHARED: Painel de Divisão Percentual */}
                {formScope === 'SHARED' && (
                  <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/50 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                        Divisão de Rateio por Psicólogo (%):
                      </span>
                      <button
                        type="button"
                        onClick={() => distributeEvenly(psychologists)}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Dividir Igualmente
                      </button>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {psychologists.map((psych) => {
                        const pct = formSharedSplits[psych.id] ?? 0;
                        const calculatedPart = (parseFloat(formAmount.replace(',', '.')) || 0) * (pct / 100);
                        return (
                          <div key={psych.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 dark:text-white truncate">{psych.name}</p>
                              <p className="text-[10px] text-slate-400">CRP: {psych.crp_number || 'N/A'}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-mono text-slate-500">
                                R$ {calculatedPart.toFixed(2).replace('.', ',')}
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={pct}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setFormSharedSplits(prev => ({ ...prev, [psych.id]: val }));
                                  }}
                                  className="w-16 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-1.5 text-center font-bold text-xs"
                                />
                                <span className="font-bold text-slate-600 dark:text-slate-400">%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Totalizador de porcentagem */}
                    {(() => {
                      const totalPct = (Object.values(formSharedSplits) as number[]).reduce((sum: number, v: number) => sum + (Number(v) || 0), 0);
                      const is100 = Math.abs(totalPct - 100) < 0.1;
                      return (
                        <div className={`flex items-center justify-between pt-1 text-[11px] font-bold ${
                          is100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          <span>Soma dos Percentuais:</span>
                          <span>{totalPct.toFixed(1)}% {is100 ? '✓' : '(A soma deve ser exatamente 100%)'}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Quem pagou / adiantou o valor desta despesa? */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 text-xs">
                    Quem desembolsou / adiantou o pagamento deste boleto?
                  </label>
                  <select
                    value={formPayerUserId}
                    onChange={(e) => setFormPayerUserId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-teal-500"
                  >
                    <option value="">🏢 Caixa Geral da Clínica / Conta Corporativa</option>
                    {psychologists.map((psych) => (
                      <option key={psych.id} value={psych.id}>
                        👤 {psych.name} (Adiantou do próprio bolso)
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Fundamental para despesas compartilhadas: o sistema calculará automaticamente o reembolso devido pelos outros colegas.
                  </span>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observações / Notas Internas
                </label>
                <textarea
                  rows={2}
                  placeholder="Número do contrato, código de barras, detalhes adicionais..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-teal-500 text-xs"
                />
              </div>

              {/* Botões de Rodapé */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Salvando...' : editingExpense ? 'Salvar Alterações' : 'Cadastrar Despesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DAR BAIXA RÁPIDA / REGISTRAR PAGAMENTO                            */}
      {/* ========================================================================= */}
      {paymentModalExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 mb-4 text-emerald-600 dark:text-emerald-400">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Registrar Pagamento de Despesa
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {paymentModalExpense.title}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 text-xs mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Valor a Pagar:</span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {formatMoney(paymentModalExpense.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Vencimento Original:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatDate(paymentModalExpense.due_date)}
                </span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data Efetiva da Baixa / Pagamento *
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white font-semibold text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Forma de Pagamento Utilizada *
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white font-semibold text-xs"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-5 mt-5 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPaymentModalExpense(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmittingPay}
                onClick={handleConfirmPayment}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-sm cursor-pointer"
              >
                {isSubmittingPay ? 'Registrando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO (SÉRIE OU INDIVIDUAL)                    */}
      {/* ========================================================================= */}
      {deleteConfirmExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 mb-3 text-rose-600 dark:text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Excluir Despesa
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {deleteConfirmExpense.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
              Você tem certeza que deseja excluir esta despesa no valor de{' '}
              <strong className="text-slate-900 dark:text-white">
                {formatMoney(deleteConfirmExpense.amount)}
              </strong>
              ? O evento correspondente na Agenda também será removido.
            </p>

            {deleteConfirmExpense.is_recurring && (
              <div className="space-y-2 mb-4">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Esta despesa faz parte de uma série recorrente. Como deseja excluir?
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="delScope"
                      checked={deleteScope === 'single'}
                      onChange={() => setDeleteScope('single')}
                      className="text-rose-600"
                    />
                    <span>Excluir apenas esta parcela</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="delScope"
                      checked={deleteScope === 'future'}
                      onChange={() => setDeleteScope('future')}
                      className="text-rose-600"
                    />
                    <span>Excluir esta e todas as parcelas futuras</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="delScope"
                      checked={deleteScope === 'all'}
                      onChange={() => setDeleteScope('all')}
                      className="text-rose-600"
                    />
                    <span>Excluir toda a série recorrente</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmExpense(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-sm cursor-pointer"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LIVRO-CAIXA CARNÊ-LEÃO (RECEITAS - DESPESAS DEDUTÍVEIS)            */}
      {/* ========================================================================= */}
      {isCarneLeaoBookOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Livro-Caixa Consolidado para Carnê-Leão (Receita Federal)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Apuração contábil de {monthName} para Psicólogo Autônomo (CBO 2251-05)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCarneLeaoBookOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingBook ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <div className="inline-block animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-3" />
                <p>Calculando demonstrativo contábil...</p>
              </div>
            ) : carneLeaoBookData ? (
              <div className="mt-5 space-y-6">
                {/* DRE Mini Resumo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      (+) Receitas Brutas (Honorários)
                    </span>
                    <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                      {formatMoney(carneLeaoBookData.total_receitas)}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                    <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                      (-) Despesas Escrituradas Livro-Caixa
                    </span>
                    <div className="text-xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">
                      {formatMoney(carneLeaoBookData.total_despesas_dedutiveis)}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
                    <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                      (=) Base de Cálculo do IRPF
                    </span>
                    <div className="text-xl font-extrabold text-teal-700 dark:text-teal-300 mt-1">
                      {formatMoney(carneLeaoBookData.rendimento_tributavel)}
                    </div>
                  </div>
                </div>

                {/* Tabela de Despesas Dedutíveis do Mês */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2.5 flex items-center justify-between">
                    <span>Despesas Dedutíveis Lançadas no Livro-Caixa ({monthName})</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      {carneLeaoBookData.despesas?.length || 0} item(ns)
                    </span>
                  </h4>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-auto max-h-[350px]">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 select-none">
                        <tr>
                          <th className="py-2.5 px-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Data</th>
                          <th className="py-2.5 px-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Descrição da Despesa</th>
                          <th className="py-2.5 px-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Enquadramento</th>
                          <th className="py-2.5 px-3 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Valor Escriturado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {carneLeaoBookData.despesas && carneLeaoBookData.despesas.length > 0 ? (
                          carneLeaoBookData.despesas.map((d: any) => (
                            <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 whitespace-nowrap font-medium">
                                {formatDate(d.data)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                {d.descricao}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-800">
                                  Livro-Caixa Aceito
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                {formatMoney(d.valor)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                              Nenhuma despesa dedutível quitada encontrada neste mês.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                  <p className="font-semibold mb-0.5">Orientações Fiscais da Receita Federal:</p>
                  <p>
                    Conforme o Regulamento do Imposto de Renda (RIR) para profissionais autônomos da saúde, são dedutíveis
                    no Livro-Caixa os gastos indispensáveis à prestação de serviços (aluguel, água, luz, telefone, condomínio,
                    anuidade do CRP e assessoria contábil). Guarde os comprovantes de pagamento originais por 5 anos.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2.5 pt-5 mt-5 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCarneLeaoBookOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR ACERTO DE CONTAS / REEMBOLSO ENTRE TERAPEUTAS           */}
      {/* ========================================================================= */}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Registrar Acerto de Rateio
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Competência {monthName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {settlementError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{settlementError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmSettlement} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Devedor (Quem paga) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Quem está pagando o reembolso? *
                  </label>
                  <select
                    value={settlementTarget?.fromUserId || ''}
                    onChange={(e) => {
                      const uid = Number(e.target.value);
                      const psych = psychologists.find((p) => p.id === uid);
                      setSettlementTarget((prev) => ({
                        fromUserId: uid,
                        fromName: psych?.name || '',
                        toUserId: prev?.toUserId || (psychologists.find((p) => p.id !== uid)?.id || uid),
                        toName: prev?.toName || (psychologists.find((p) => p.id !== uid)?.name || ''),
                        grossOwed: prev?.grossOwed || 0,
                        settledAmount: prev?.settledAmount || 0,
                        netPending: prev?.netPending || 0,
                      }));
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white font-semibold"
                    required
                  >
                    {psychologists.map((psych) => (
                      <option key={psych.id} value={psych.id}>
                        {psych.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Credor (Quem recebe) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Quem recebe o reembolso? *
                  </label>
                  <select
                    value={settlementTarget?.toUserId || ''}
                    onChange={(e) => {
                      const uid = Number(e.target.value);
                      const psych = psychologists.find((p) => p.id === uid);
                      setSettlementTarget((prev) => ({
                        fromUserId: prev?.fromUserId || (psychologists.find((p) => p.id !== uid)?.id || uid),
                        fromName: prev?.fromName || (psychologists.find((p) => p.id !== uid)?.name || ''),
                        toUserId: uid,
                        toName: psych?.name || '',
                        grossOwed: prev?.grossOwed || 0,
                        settledAmount: prev?.settledAmount || 0,
                        netPending: prev?.netPending || 0,
                      }));
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white font-semibold"
                    required
                  >
                    {psychologists.map((psych) => (
                      <option key={psych.id} value={psych.id}>
                        {psych.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Valor */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valor Pago (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white font-bold"
                    required
                  >
                  </input>
                </div>

                {/* Data */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data do Pagamento *
                  </label>
                  <input
                    type="date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white font-semibold"
                    required
                  />
                </div>

                {/* Forma */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Forma de Envio *
                  </label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="PIX">PIX</option>
                    <option value="TRANSFERENCIA">Transferência Bancária</option>
                    <option value="DINHEIRO">Dinheiro em Espécie</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
              </div>

              {/* Observação */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observações / Comprovante
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Ex: Chave PIX utilizada, ID da transação..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettlement || !settleAmount || parseFloat(settleAmount) <= 0}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmittingSettlement ? 'Registrando...' : 'Confirmar Quitação'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
