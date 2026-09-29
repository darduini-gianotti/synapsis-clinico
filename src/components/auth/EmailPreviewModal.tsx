import React, { useState } from 'react';
import {
  Mail,
  X,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Send,
  Sparkles,
} from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  emailPreview: {
    to: string;
    name: string;
    subject: string;
    token: string;
    tokenType: 'INVITE' | 'RESET';
    actionUrl: string;
    expiresInText: string;
    html?: string;
  } | null;
  onClose: () => void;
  onOpenActionUrl?: (url: string) => void;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  emailPreview,
  onClose,
  onOpenActionUrl,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !emailPreview) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(emailPreview.actionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const isInvite = emailPreview.tokenType === 'INVITE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  E-mail Transacional Disparado
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
                  Simulador de Teste
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Visualização do e-mail enviado para <strong>{emailPreview.to}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Email Meta Bar */}
        <div className="p-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-slate-400">Destinatário:</span>{' '}
              <strong className="text-slate-800 dark:text-slate-200">{emailPreview.name} &lt;{emailPreview.to}&gt;</strong>
            </div>
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[11px]">
              <Clock className="h-3.5 w-3.5 text-teal-600" />
              <span>{emailPreview.expiresInText}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400">Assunto:</span>{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{emailPreview.subject}</span>
          </div>
        </div>

        {/* Rendered Email Body in Sandbox Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          <div className="max-w-lg mx-auto rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-lg space-y-4">
            <div className="text-center pb-4 border-b border-slate-800 space-y-1">
              <div className="inline-block bg-teal-600 text-white w-10 h-10 leading-10 rounded-xl font-bold text-lg">Ψ</div>
              <h4 className="font-bold text-base text-white">PsicoGestão</h4>
              <p className="text-[11px] text-slate-400">Gestão Clínica • Criptografia AES-256 (LGPD) • Padrão CFP</p>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <p className="font-semibold text-sm text-slate-200">
                Olá, {emailPreview.name}!
              </p>
              <p className="text-slate-300">
                {isInvite
                  ? 'Você foi cadastrado(a) na plataforma clínica do consultório. Para começar a utilizar o sistema com segurança, clique no botão abaixo para criar sua senha de acesso pessoal.'
                  : 'Recebemos uma solicitação para redefinir a senha da sua conta no consultório. Clique no botão abaixo para cadastrar uma nova senha forte.'}
              </p>

              <div className="py-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenActionUrl) {
                      onOpenActionUrl(emailPreview.actionUrl);
                    } else {
                      window.location.href = emailPreview.actionUrl;
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-md transition cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>{isInvite ? 'Cadastrar Minha Senha de Acesso' : 'Redefinir Minha Senha'}</span>
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/80 border-l-4 border-teal-500 text-[11px] text-slate-300">
                ⏳ <strong>Validade do Link:</strong> {emailPreview.expiresInText}.
              </div>

              <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                🔒 Link de uso único. Caso não tenha solicitado, ignore esta notificação.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Link Copiado!' : 'Copiar Link Seguro'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                if (onOpenActionUrl) {
                  onOpenActionUrl(emailPreview.actionUrl);
                } else {
                  window.location.href = emailPreview.actionUrl;
                }
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition shadow-xs cursor-pointer"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Abrir Link no Navegador</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
