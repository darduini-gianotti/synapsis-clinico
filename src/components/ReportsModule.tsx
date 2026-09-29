import React, { useState, useEffect } from 'react';
import { 
  FileText, Calendar, Filter, Download, FileDown,
  DollarSign, CheckCircle2, AlertCircle, TrendingUp, User
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function ReportsModule() {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalPaid: 0, totalPending: 0, totalGeneral: 0 });
  const [isFetching, setIsFetching] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );
  const [dateFilterType, setDateFilterType] = useState('SESSION_DATE');
  const [status, setStatus] = useState('ALL');
  const [serviceType, setServiceType] = useState('ALL'); // 'ALL' | 'PSYCHOTHERAPY' | 'EVALUATION'
  const [patientId, setPatientId] = useState('ALL');
  const [psychologistId, setPsychologistId] = useState('ALL');
  const [paymentMethod, setPaymentMethod] = useState('ALL');

  // Lookups
  const [patients, setPatients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate, dateFilterType, status, serviceType, patientId, psychologistId, paymentMethod]);

  const fetchLookups = async () => {
    try {
      const [patientsRes, usersRes] = await Promise.all([
        api.get('/patients'),
        api.get('/collaborators')
      ]);
      setPatients(patientsRes.data.patients || []);
      setUsers(usersRes.data.users || []);
    } catch (err) {
      console.error('Failed to fetch lookups:', err);
    }
  };

  const fetchReports = async () => {
    try {
      setIsFetching(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (dateFilterType) params.append('dateFilterType', dateFilterType);
      if (status) params.append('status', status);
      if (serviceType && serviceType !== 'ALL') params.append('serviceType', serviceType);
      if (patientId) params.append('patientId', patientId);
      if (psychologistId) params.append('psychologistId', psychologistId);
      if (paymentMethod) params.append('paymentMethod', paymentMethod);

      const res = await api.get(`/reports/financial?${params.toString()}`);
      setReports(res.data.transactions || []);
      setSummary(res.data.summary || { totalPaid: 0, totalPending: 0, totalGeneral: 0 });
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setIsFetching(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };
  
  const formatDateLocal = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR');
  };

  const sortedReports = React.useMemo(() => {
    return [...reports].sort((a, b) => {
      const timeA = new Date(a.transaction_date || a.start_time || 0).getTime();
      const timeB = new Date(b.transaction_date || b.start_time || 0).getTime();
      return timeA - timeB;
    });
  }, [reports]);

  const handleExportExcel = () => {
    const data = sortedReports.map(r => ({
      'Situação': r.final_status === 'PAID' ? 'Pago' : 'Não Pago',
      'Tipo de Atendimento': r.service_label || (r.service_type === 'EVALUATION' ? 'Avaliação Neuropsicológica' : 'Psicoterapia'),
      'Profissional': r.psych_name,
      'Data Atend./Sessão': formatDateLocal(r.start_time),
      'Vencimento': formatDate(r.transaction_date || r.start_time),
      'Data Pagamento': formatDate(r.paid_at),
      'Paciente': r.patient_name,
      'CPF do Paciente': r.patient_cpf || '-',
      'Pagador / Titular': r.payer_name || r.patient_name,
      'CPF do Pagador': r.payer_cpf || r.patient_cpf || '-',
      'Meio de Pagamento': r.payment_method || '-',
      'Valor (R$)': r.amount
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório Financeiro");
    XLSX.writeFile(workbook, `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = async () => {
    // Modo paisagem (landscape) para acomodar com legibilidade paciente, pagador e CPF
    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Título e Cabeçalho
    doc.setFontSize(15);
    doc.setTextColor(30, 41, 59);
    doc.text('Relatório Financeiro Analítico de Atendimentos', 14, 16);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    const filterDesc = [
      `Período: ${formatDate(startDate)} a ${formatDate(endDate)}`,
      `Tipo: ${serviceType === 'PSYCHOTHERAPY' ? 'Psicoterapia' : serviceType === 'EVALUATION' ? 'Avaliações Neuro' : 'Todos'}`,
      `Status: ${status === 'PAID' ? 'Pagos' : status === 'PENDING' ? 'Não Pagos' : 'Todos'}`
    ].join(' • ');
    doc.text(filterDesc, 14, 22);
    
    // Resumo de KPIs no PDF
    doc.setFontSize(10);
    doc.setTextColor(22, 163, 74); // Verde
    doc.text(`Total Recebido: ${formatCurrency(summary.totalPaid)}`, 14, 30);
    doc.setTextColor(220, 38, 38); // Vermelho
    doc.text(`Total Pendente: ${formatCurrency(summary.totalPending)}`, 90, 30);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Geral: ${formatCurrency(summary.totalGeneral)}`, 165, 30);

    const tableColumn = [
      "Situação",
      "Tipo",
      "Profissional",
      "Data / Sessão",
      "Venc.",
      "Data Pgto",
      "Paciente",
      "CPF Paciente",
      "Pagador / Titular",
      "CPF Pagador",
      "Meio",
      "Valor"
    ];

    const tableRows = sortedReports.map(r => [
      r.final_status === 'PAID' ? 'PAGO' : 'NÃO PAGO',
      r.service_label || (r.service_type === 'EVALUATION' ? 'Avaliação Neuro' : 'Psicoterapia'),
      r.psych_name,
      formatDateLocal(r.start_time),
      formatDate(r.transaction_date || r.start_time),
      formatDate(r.paid_at),
      r.patient_name,
      r.patient_cpf || '-',
      r.payer_name || r.patient_name,
      r.payer_cpf || r.patient_cpf || '-',
      r.payment_method || '-',
      formatCurrency(r.amount)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 36,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' }, // Teal-700
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 26 },
        2: { cellWidth: 28 },
        3: { cellWidth: 20 },
        4: { cellWidth: 18 },
        5: { cellWidth: 18 },
        6: { cellWidth: 32 },
        7: { cellWidth: 25 },
        8: { cellWidth: 32 },
        9: { cellWidth: 25 },
        10: { cellWidth: 16 },
        11: { cellWidth: 20, halign: 'right' }
      }
    });

    doc.save(`relatorio_financeiro_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-indigo-500" />
            Relatório de Pagamentos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Gestão analítica de pagamentos e faturamento das sessões
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            data-help-id="financial-export-cpf"
            onClick={handleExportExcel}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-2 font-medium shadow-sm cursor-pointer"
          >
            <FileDown className="h-4 w-4" /> Exportar Excel
          </button>
          <button 
            data-help-id="financial-export-cpf"
            onClick={handleExportPDF}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-2 font-medium shadow-sm cursor-pointer"
          >
            <Download className="h-4 w-4" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Warning Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Este relatório apresenta uma abordagem flexível para os pagamentos por sessão. Você pode visualizar os valores filtrando pela <strong>Data em que a sessão ocorreu</strong> ou pela <strong>Data em que o pagamento foi realizado</strong>.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border-l-4 border-l-emerald-500 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Total Recebido (Pago)
          </p>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-white">
            {formatCurrency(summary.totalPaid)}
          </h3>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border-l-4 border-l-red-500 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1 flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Total Pendente (Não pago)
          </p>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-white">
            {formatCurrency(summary.totalPending)}
          </h3>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border-l-4 border-l-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Total Geral (Período)
          </p>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-white">
            {formatCurrency(summary.totalGeneral)}
          </h3>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2 text-slate-700 dark:text-slate-300 font-medium">
          <Filter className="h-4 w-4 text-indigo-500" />
          <span>Filtros do Relatório</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8 gap-3.5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Filtrar por data de:</label>
            <select
              value={dateFilterType}
              onChange={(e) => setDateFilterType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-xs focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option value="SESSION_DATE">Data do Atendimento</option>
              <option value="TRANSACTION_DATE">Vencimento / Pgto</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Data Inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-xs focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Data Final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-xs focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Situação</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-xs focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option value="ALL">Todas as situações</option>
              <option value="PAID">Pagos (Quitados)</option>
              <option value="PENDING">Não Pagos (Em Aberto)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Tipo de Atendimento</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-xs focus:ring-indigo-500 focus:border-indigo-500 dark:text-white font-medium"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="PSYCHOTHERAPY">Psicoterapia</option>
              <option value="EVALUATION">Avaliação Neuropsicológica</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Psicólogo / Profissional</label>
            <select
              value={psychologistId}
              onChange={(e) => setPsychologistId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-xs focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option value="ALL">Todos os Psicólogos</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Cliente / Paciente</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-xs focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option value="ALL">Todos os clientes</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Meio de Pagamento</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-xs focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option value="ALL">Todos</option>
              <option value="PIX">PIX</option>
              <option value="CARTAO">Cartão</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="BOLETO">Boleto</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[350px]">
          <table className="w-full text-left text-xs table-auto border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 select-none text-slate-500 dark:text-slate-400 uppercase font-semibold text-[11px]">
              <tr>
                <th className="px-3.5 py-3 whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Situação</th>
                <th className="px-3.5 py-3 whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Tipo</th>
                <th className="px-3.5 py-3 whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Profissional</th>
                <th className="px-3.5 py-3 whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Data Atend.</th>
                <th className="px-3.5 py-3 whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Vencimento</th>
                <th className="px-3.5 py-3 whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Pagamento em</th>
                <th className="px-3.5 py-3 min-w-[170px] bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Paciente</th>
                <th className="px-3.5 py-3 min-w-[180px] bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Pagador / Titular</th>
                <th className="px-3.5 py-3 whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Forma Pgto</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Valor (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isFetching ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                    Carregando relatórios...
                  </td>
                </tr>
              ) : sortedReports.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    Nenhum registro financeiro encontrado neste período com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                sortedReports.map((r, i) => (
                  <tr key={`report_${r.id || i}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition">
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {r.final_status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                          PAGO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[10px] font-bold border border-red-200 dark:border-red-800">
                          NÃO PAGO
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {r.service_type === 'EVALUATION' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Avaliação Neuro
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                          Psicoterapia
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs">
                      <div className="flex items-center gap-1.5 font-medium">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{r.psych_name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatDateLocal(r.start_time)}
                    </td>
                    <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono">
                      {formatDate(r.transaction_date || r.start_time)}
                    </td>
                    <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono">
                      {formatDate(r.paid_at)}
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {r.patient_name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        CPF: {r.patient_cpf || '-'}
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {r.payer_name || r.patient_name}
                      </div>
                      <div className="text-[10px] font-mono font-medium text-teal-600 dark:text-teal-400">
                        CPF: {r.payer_cpf || r.patient_cpf || '-'}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        {r.payment_method || '-'}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatCurrency(r.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
