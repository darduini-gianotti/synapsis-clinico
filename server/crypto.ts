import crypto from 'crypto';

// Secret key for AES-256-GCM (must be 32 bytes)
if (process.env.NODE_ENV === 'production' && !process.env.CLINICAL_ENCRYPTION_KEY) {
  console.warn('⚠️ [ALERTA DE SEGURANÇA]: A aplicação está executando em PRODUÇÃO sem CLINICAL_ENCRYPTION_KEY definida nas variáveis de ambiente!');
}

const ENCRYPTION_KEY = process.env.CLINICAL_ENCRYPTION_KEY
  ? Buffer.from(process.env.CLINICAL_ENCRYPTION_KEY.slice(0, 64), 'hex')
  : crypto.scryptSync('psico-saas-master-clinical-key-2026', 'salt-lgpd-brazil', 32);

export interface EncryptedPayload {
  encryptedContent: string; // hex
  iv: string;              // hex
  authTag: string;         // hex
}

/**
 * Encrypt sensitive clinical data with AES-256-GCM (At-Rest LGPD requirement)
 */
export function encryptClinicalText(plainText: string): EncryptedPayload {
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedContent: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypt sensitive clinical data with AES-256-GCM and verify integrity tag
 */
export function decryptClinicalText(payload: {
  encryptedContent: string;
  iv: string;
  authTag: string;
}): string {
  try {
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(payload.encryptedContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed or data was tampered:', err);
    return '[ERRO NA DECRIPTOGRAFIA: DADOS CORROMPIDOS OU CHAVE INVÁLIDA]';
  }
}

/**
 * Generate SHA-256 cryptographic hash for digital signature and immutability
 */
export function generateSHA256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
