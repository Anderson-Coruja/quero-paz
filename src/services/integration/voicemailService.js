/**
 * Serviço de Voicemail para o Quero Paz
 * 
 * NOTA: FUNCIONALIDADE FUTURA
 * Este módulo será implementado em uma versão posterior e está desativado
 * para os testes iniciais. O serviço de voicemail permitirá o gerenciamento 
 * de mensagens de voz com funcionalidades como:
 * - Armazenamento seguro de mensagens
 * - Transcrição automática de áudio para texto
 * - Categorização e priorização de mensagens
 * - Notificações de novas mensagens
 */

// Status das mensagens para compatibilidade com componentes existentes
export const MESSAGE_TYPES = {
  NEW: 'new',
  READ: 'read',
  ARCHIVED: 'archived',
  DELETED: 'deleted'
};

// Níveis de urgência
export const URGENCY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  EMERGENCY: 'emergency'
};

// Categorias de sentimento
export const SENTIMENT_TYPES = {
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
  POSITIVE: 'positive'
};

/**
 * Serviço de gerenciamento de voicemail - Desativado para testes iniciais
 * V1.0 - Terá apenas funcionalidades básicas
 */
const voicemailService = {
  /**
   * Inicializa o serviço (atualmente desativado)
   * @returns {Promise<void>}
   */
  async initialize() {
    console.log('[INFO] Serviço de voicemail estará disponível em uma versão futura');
    return Promise.resolve();
  },
  
  /**
   * Obtém todas as mensagens de voicemail (atualmente retorna lista vazia)
   * @returns {Promise<Array>} Lista de mensagens
   */
  async getMessages() {
    return Promise.resolve([]);
  },
  
  /**
   * Obtém a configuração do voicemail
   * @returns {Promise<Object>} Configuração
   */
  async getConfig() {
    return Promise.resolve({
      transcriptionEnabled: false,
      sentimentAnalysisEnabled: false,
      autoDeleteAfterDays: 30,
      notifyOnTranscription: false,
      language: 'pt-BR'
    });
  },
  
  /**
   * Atualiza a configuração do voicemail (desativado)
   * @param {Object} newConfig - Nova configuração
   * @returns {Promise<Object>} Configuração
   */
  async updateConfig(newConfig) {
    console.log('[INFO] Atualização de configuração não disponível nesta versão');
    return this.getConfig();
  },
  
  /**
   * Adiciona uma nova mensagem (desativado)
   * @returns {Promise<Object>} Mensagem (vazia)
   */
  async addMessage() {
    console.log('[INFO] Adição de mensagens não disponível nesta versão');
    return Promise.resolve({});
  },
  
  /**
   * Marca uma mensagem como lida (desativado)
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async markAsRead() {
    console.log('[INFO] Marcação de mensagens não disponível nesta versão');
    return Promise.resolve(true);
  },
  
  /**
   * Arquiva uma mensagem (desativado)
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async archiveMessage() {
    console.log('[INFO] Arquivamento de mensagens não disponível nesta versão');
    return Promise.resolve(true);
  },
  
  /**
   * Deleta uma mensagem (desativado)
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async deleteMessage() {
    console.log('[INFO] Deleção de mensagens não disponível nesta versão');
    return Promise.resolve(true);
  }
};

export default voicemailService;
