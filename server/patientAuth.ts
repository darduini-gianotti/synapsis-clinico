import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne, execute } from './db.js';

const DEFAULT_DEV_JWT_SECRET = 'psico-saas-ultra-secure-jwt-key-2026';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET;

export interface AuthenticatedPatient {
  patient_id: number;
  full_name: string;
  cpf: string;
  phone: string;
  is_guardian?: boolean;
  guardian_cpf?: string;
  active_patient_id: number;
  dependent_ids?: number[];
  role: 'patient';
}

export interface PatientAuthRequest extends Request {
  patient?: AuthenticatedPatient;
}

/**
 * Emite token JWT seguro exclusivo para a sessão do paciente
 */
export function generatePatientToken(payload: AuthenticatedPatient): string {
  return jwt.sign(
    {
      patient_id: payload.patient_id,
      full_name: payload.full_name,
      cpf: payload.cpf,
      phone: payload.phone,
      is_guardian: !!payload.is_guardian,
      guardian_cpf: payload.guardian_cpf,
      active_patient_id: payload.active_patient_id || payload.patient_id,
      dependent_ids: payload.dependent_ids || [payload.patient_id],
      role: 'patient',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Middleware de Autenticação Segregada para o Synapsis Paciente.
 * Bloqueia tokens com outras roles e impede acesso cruzado entre pacientes (Zero Trust).
 */
export function authenticatePatientToken(req: PatientAuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Sessão não encontrada. Por favor, acesse novamente.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err || !decoded || decoded.role !== 'patient') {
      res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login com seu código ou PIN.' });
      return;
    }

    // Verificar se o paciente ativo ainda existe no banco e não está desativado
    const patientRow = queryOne<any>(
      'SELECT id, full_name, cpf, phone, status FROM patients WHERE id = ?',
      [decoded.active_patient_id]
    );

    if (!patientRow) {
      res.status(401).json({ error: 'Cadastro do paciente não encontrado.' });
      return;
    }

    if (patientRow.status === 'INACTIVE') {
      res.status(403).json({ error: 'Seu cadastro encontra-se inativo no consultório. Entre em contato com a recepção.' });
      return;
    }

    req.patient = decoded as AuthenticatedPatient;
    next();
  });
}

/**
 * Trilha de Auditoria LGPD para o Paciente
 */
export function recordPatientAuditLog(req: PatientAuthRequest, action: string, resource: string, details?: string) {
  try {
    const patientId = req.patient ? req.patient.active_patient_id : null;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    execute(
      `INSERT INTO audit_logs (user_id, action, resource, ip_address, details) VALUES (?, ?, ?, ?, ?)`,
      [null, `PATIENT_${action}`, resource, clientIp, `[Patient #${patientId}] ${details || ''}`]
    );
  } catch (err) {
    console.error('Failed to record patient audit log:', err);
  }
}
