/**
 * Funções utilitárias para o sistema de reputação
 * 
 * Este módulo fornece funções de suporte para o sistema de reputação,
 * incluindo funções de hash, anonimização e validação.
 */

/**
 * Gera um hash para um número de telefone
 * Isso permite compartilhar dados sem revelar o número completo
 * @param {string} phoneNumber - Número a ser hasheado
 * @returns {string} Hash do número
 */
export function hashPhoneNumber(phoneNumber) {
  // Na implementação real, usaria uma função de hash criptográfica
  // como SHA-256 com um salt específico para o app
  
  // Para este protótipo, implementamos uma função simples que
  // preserva apenas os 4 primeiros e 2 últimos dígitos
  if (!phoneNumber || phoneNumber.length < 6) {
    return phoneNumber; // Número muito curto, não hash
  }
  
  // Simplificação para demonstração:
  // Em produção, usaria crypto.subtle.digest ou uma biblioteca dedicada
  let hash = '';
  let sum = 0;
  
  // Soma valores ASCII para gerar um valor determinístico
  for (let i = 0; i < phoneNumber.length; i++) {
    const charCode = phoneNumber.charCodeAt(i);
    sum += charCode;
    hash += ((sum * 31) % 16).toString(16);
  }
  
  // Mantém prefixo e sufixo do número original para melhor
  // análise regional e de operadora, mas protege os dígitos únicos do usuário
  const prefix = phoneNumber.substring(0, Math.min(4, phoneNumber.length - 2));
  const suffix = phoneNumber.substring(phoneNumber.length - 2);
  
  return `${prefix}${hash.substring(0, 10)}${suffix}`;
}

/**
 * Anonimiza dados antes de compartilhar com a comunidade
 * @param {Object} data - Dados a serem anonimizados
 * @returns {Object} Dados anonimizados
 */
export function anonymizeData(data) {
  if (!data) return null;
  
  // Cria uma cópia para não modificar o objeto original
  const result = { ...data };
  
  // Remove identificadores pessoais
  delete result.deviceId;
  delete result.userId;
  delete result.phoneNumber; // Usa apenas o hash
  delete result.ip;
  delete result.location;
  
  // Remove detalhes que possam identificar usuário
  if (result.details) {
    delete result.details.userMessage;
    delete result.details.userName;
    delete result.details.userContact;
  }
  
  // Arredonda timestamps para reduzir possibilidade de correlação
  // (ex: arredonda para a hora mais próxima)
  if (result.timestamp) {
    const date = new Date(result.timestamp);
    date.setMinutes(0, 0, 0);
    result.timestamp = date.toISOString();
  }
  
  // Adiciona identificador anônimo de sessão para permitir
  // detecção de spammers sem revelar identidade
  result.anonymousId = generateAnonymousId();
  
  return result;
}

/**
 * Gera um ID anônimo para rastreamento de sessão
 * @returns {string} ID anônimo
 * @private
 */
function generateAnonymousId() {
  // Gera um ID aleatório usando Math.random
  // Em produção, usaria uma técnica mais robusta
  return 'anon_' + 
    Math.random().toString(36).substring(2, 10) + 
    Math.random().toString(36).substring(2, 10);
}

/**
 * Verifica se um número está em um formato válido
 * @param {string} phoneNumber - Número a validar
 * @returns {boolean} Se o número é válido
 */
export function isValidPhoneNumber(phoneNumber) {
  if (!phoneNumber) return false;
  
  // Remove todos os caracteres não numéricos
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // Verifica se tem entre 8 e 15 dígitos (padrão internacional)
  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return false;
  }
  
  // Em uma implementação real, usaria validação mais sofisticada
  // com libphonenumber ou outra biblioteca especializada
  return true;
}

/**
 * Detecta o tipo de número (móvel, fixo, serviço, etc.)
 * @param {string} phoneNumber - Número a analisar
 * @returns {string} Tipo do número
 */
export function detectNumberType(phoneNumber) {
  if (!phoneNumber) return 'unknown';
  
  // Remove todos os caracteres não numéricos
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // Implementação simplificada para este protótipo
  // Apenas detecta se é provável que seja móvel ou fixo no Brasil
  
  // Assume DDD + número (10 ou 11 dígitos)
  if (digitsOnly.length === 11 && digitsOnly.charAt(2) === '9') {
    return 'mobile'; // Celular no Brasil
  } else if (digitsOnly.length === 10 && digitsOnly.charAt(2) !== '9') {
    return 'landline'; // Fixo no Brasil
  } else if (digitsOnly.length <= 5) {
    return 'service'; // Número curto (serviço)
  } else if (digitsOnly.length > 12) {
    return 'international'; // Internacional
  }
  
  return 'unknown';
}

/**
 * Formata um número para exibição amigável
 * @param {string} phoneNumber - Número a formatar
 * @returns {string} Número formatado
 */
export function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove todos os caracteres não numéricos
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // Formatação para Brasil (simplificada)
  if (digitsOnly.length === 11) { // Celular
    return `(${digitsOnly.substring(0, 2)}) ${digitsOnly.substring(2, 7)}-${digitsOnly.substring(7)}`;
  } else if (digitsOnly.length === 10) { // Fixo
    return `(${digitsOnly.substring(0, 2)}) ${digitsOnly.substring(2, 6)}-${digitsOnly.substring(6)}`;
  }
  
  // Retorna como está para outros formatos
  return phoneNumber;
}

/**
 * Obtém apenas o DDD de um número brasileiro
 * @param {string} phoneNumber - Número completo
 * @returns {string|null} DDD ou null se não for possível extrair
 */
export function extractAreaCode(phoneNumber) {
  if (!phoneNumber) return null;
  
  // Remove todos os caracteres não numéricos
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // Assume que 2 primeiros dígitos são DDD para números com 10 ou 11 dígitos
  if (digitsOnly.length >= 10 && digitsOnly.length <= 11) {
    return digitsOnly.substring(0, 2);
  }
  
  return null;
}

/**
 * Verifica se um número é provavelmente um número de telemarketing
 * baseado em padrões conhecidos
 * @param {string} phoneNumber - Número a verificar
 * @returns {boolean} Se é provável telemarketing
 */
export function isSuspectedTelemarketing(phoneNumber) {
  if (!phoneNumber) return false;
  
  // Remove todos os caracteres não numéricos
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // Padrões conhecidos de telemarketing
  const telemarketingPatterns = [
    /^0800/, // Número de 0800
    /^4003/, // SAC comercial comum
    /0300$/, // Terminação em 0300
    /0303/, // Prefixo de telemarketing
    /(\d)\1{4,}/ // Repetição do mesmo dígito 5+ vezes (ex: 99999)
  ];
  
  return telemarketingPatterns.some(pattern => pattern.test(digitsOnly));
}
