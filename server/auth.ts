import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne, queryAll, execute } from './db.js';

const DEFAULT_DEV_JWT_SECRET = 'psico-saas-ultra-secure-jwt-key-2026';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET;

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_DEV_JWT_SECRET)) {
  console.warn('⚠️ [ALERTA DE SEGURANÇA]: A aplicação está executando em PRODUÇÃO sem uma chave JWT_SECRET personalizada definida nas variáveis de ambiente!');
}

export interface AuthenticatedUser {
  id: number;
  clinic_id: number;
  is_superadmin?: boolean;
  name: string;
  email: string;
  role: string;
  role_id: number;
  crp_number: string | null;
  permissions?: string[];
  status?: string;
  token_version?: number;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      clinic_id: user.clinic_id || 1,
      is_superadmin: Boolean(user.is_superadmin),
      name: user.name,
      email: user.email,
      role: user.role,
      role_id: user.role_id,
      crp_number: user.crp_number,
      token_version: user.token_version || 1,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação não fornecido' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err || !decoded) {
      res.status(401).json({ error: 'Sessão expirada ou token inválido. Faça login novamente.' });
      return;
    }

    const user = queryOne<any>(
      'SELECT id, clinic_id, is_superadmin, name, email, role, role_id, crp_number, status, token_version, locked_until FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      res.status(401).json({ error: 'Usuário não encontrado' });
      return;
    }

    user.clinic_id = user.clinic_id || 1;
    user.is_superadmin = Boolean(user.is_superadmin || user.email === 'admin@psicogestao.com.br' || user.email === 'sergio@psicogestao.com.br');

    if (user.status === 'BLOCKED') {
      res.status(401).json({ error: 'Acesso suspenso pelo Administrador. Sessão encerrada.' });
      return;
    }

    if (decoded.token_version !== undefined && user.token_version !== undefined && decoded.token_version < user.token_version) {
      res.status(401).json({ error: 'Suas credenciais foram revogadas pelo Administrador. Faça login novamente.' });
      return;
    }

    // Fetch permissions
    if (user.role_id) {
      const perms = queryAll<{name: string}>(
        `SELECT p.name FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id = ?`,
        [user.role_id]
      );
      user.permissions = perms.map(p => p.name);
    } else {
      user.permissions = [];
    }

    req.user = user;
    next();
  });
}

/**
 * RBAC Guard: Restricts access by user role
 */
export function requireRole(allowedRoles: Array<'ADMIN' | 'PSYCHOLOGIST' | 'SECRETARY'>) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    if (!allowedRoles.includes(req.user.role as any)) {
      // Audit log attempt to access restricted clinical resource
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      execute(
        `INSERT INTO audit_logs (user_id, action, resource, ip_address, details) VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.id,
          'UNAUTHORIZED_ACCESS_ATTEMPT',
          req.originalUrl,
          clientIp,
          `Acesso negado para role ${req.user.role} (Restrição CFP/LGPD)`,
        ]
      );

      res.status(403).json({
        error: 'Acesso Proibido: Seu perfil não possui permissão para acessar este recurso clínico (Normativas CFP 01/2009 e LGPD).',
      });
      return;
    }

    next();
  };
}

/**
 * SuperAdmin Guard: Restricts access to Platform Administrators (Sergio D'Arduini)
 */
export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  const isSuper = req.user.is_superadmin ||
    req.user.role === 'SUPERADMIN' ||
    req.user.email === 'admin@psicogestao.com.br' ||
    req.user.email === 'sergio@psicogestao.com.br';

  if (!isSuper) {
    res.status(403).json({
      error: 'Acesso Proibido: Este módulo é restrito ao SuperAdmin da plataforma PsicoGestão.',
    });
    return;
  }

  next();
}

/**
 * Register action in Audit Log (LGPD compliance)
 */
export function recordAuditLog(req: AuthRequest, action: string, resource: string, details?: string) {
  try {
    const userId = req.user ? req.user.id : null;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    execute(
      `INSERT INTO audit_logs (user_id, action, resource, ip_address, details) VALUES (?, ?, ?, ?, ?)`,
      [userId, action, resource, clientIp, details || '']
    );
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}
