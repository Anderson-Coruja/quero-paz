/**
 * Gerenciador de Privacidade para o Quero Paz
 * 
 * Este módulo gerencia configurações de privacidade, exclusão automática de dados,
 * e outras funcionalidades relacionadas à proteção dos dados do usuário.
 */

import offlineStorage from '../sync/offlineStorage';
import { storageEncryption, secureHashPhone } from './encryption';

// Constantes para configuração de privacidade
const DEFAULT_PRIVACY_SETTINGS = {
  // Configurações de retenção de dados
  dataRetention: {
    enabled: true,
    retentionDays: {
      calls: 30,        // Retenção de histórico de chamadas
      logs: 15,         // Retenção de logs
      reports: 90       // Retenção de denúncias
    },
    keepBlocked: true   // Manter histórico de números bloqueados permanentemente
  },
  
  // Configurações de compartilhamento
  sharing: {
    contributeToReputation: true,  // Compartilhar dados de reputação anonimizados
    privacyLevel: 'balanced',      // 'maximum', 'balanced', 'standard'
    anonymizeContacts: true        // Anonimizar informações de contatos
  },
  
  // Configurações de armazenamento
  storage: {
    storeCallHistory: true,        // Armazenar histórico de chamadas
    encryptSensitiveData: true     // Criptografar dados sensíveis
  }
};

/**
 * Gerenciador de Privacidade
 */
class PrivacyManager {
  constructor() {
    this.settings = { ...DEFAULT_PRIVACY_SETTINGS };
    this.initialized = false;
  }
  
  /**
   * Inicializa o gerenciador de privacidade
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Carrega configurações salvas
      const savedSettings = await offlineStorage.getItem('settings', 'privacySettings');
      
      if (savedSettings) {
        this.settings = { 
          ...DEFAULT_PRIVACY_SETTINGS,
          ...savedSettings
        };
      }
      
      // Agenda limpeza automática de dados
      this._scheduleDataCleanup();
      
      this.initialized = true;
      console.log('Gerenciador de privacidade inicializado');
    } catch (error) {
      console.error('Erro ao inicializar gerenciador de privacidade:', error);
      throw error;
    }
  }
  
  /**
   * Atualiza configurações de privacidade
   * 
   * @param {Object} newSettings - Novas configurações
   * @returns {Promise<Object>} - Configurações atualizadas
   */
  async updateSettings(newSettings) {
    try {
      // Mescla novas configurações com as existentes
      this.settings = {
        ...this.settings,
        ...newSettings
      };
      
      // Salva configurações atualizadas
      await offlineStorage.setItem('settings', 'privacySettings', this.settings);
      
      // Reconfigura limpeza de dados se necessário
      this._scheduleDataCleanup();
      
      return this.settings;
    } catch (error) {
      console.error('Erro ao atualizar configurações de privacidade:', error);
      throw error;
    }
  }
  
  /**
   * Obtém configurações de privacidade atuais
   * 
   * @returns {Object} - Configurações de privacidade
   */
  getSettings() {
    return { ...this.settings };
  }
  
  /**
   * Anonimiza dados para compartilhamento
   * 
   * @param {Object} data - Dados a serem anonimizados
   * @param {string} dataType - Tipo de dados (calls, contacts, reputation)
   * @returns {Object} - Dados anonimizados
   */
  anonymizeData(data, dataType) {
    // Se o nível de privacidade for máximo, não compartilha dados detalhados
    if (this.settings.sharing.privacyLevel === 'maximum') {
      // Retorna apenas dados estatísticos agregados
      return this._createAggregatedData(data, dataType);
    }
    
    // Clone os dados para não modificar o original
    const anonymized = JSON.parse(JSON.stringify(data));
    
    // Estratégias de anonimização por tipo de dados
    switch (dataType) {
      case 'calls':
        return this._anonymizeCalls(anonymized);
      
      case 'contacts':
        return this._anonymizeContacts(anonymized);
      
      case 'reputation':
        return this._anonymizeReputationData(anonymized);
      
      default:
        // Remove informações identificáveis genéricas
        return this._removeIdentifiableInfo(anonymized);
    }
  }
  
  /**
   * Realiza limpeza manual de dados antigos
   * 
   * @returns {Promise<Object>} - Estatísticas de limpeza
   */
  async performDataCleanup() {
    try {
      if (!this.settings.dataRetention.enabled) {
        return { cleaned: false, reason: 'Data retention disabled' };
      }
      
      const stats = {
        calls: 0,
        logs: 0,
        reports: 0,
        total: 0
      };
      
      // Limpa dados antigos de acordo com as configurações
      const now = new Date();
      
      // Limpa chamadas antigas
      if (this.settings.dataRetention.retentionDays.calls > 0) {
        stats.calls = await this._cleanupOldData(
          'calls',
          this.settings.dataRetention.retentionDays.calls,
          now,
          this.settings.dataRetention.keepBlocked
        );
      }
      
      // Limpa logs antigos
      if (this.settings.dataRetention.retentionDays.logs > 0) {
        stats.logs = await this._cleanupOldData(
          'logs',
          this.settings.dataRetention.retentionDays.logs,
          now
        );
      }
      
      // Limpa denúncias antigas
      if (this.settings.dataRetention.retentionDays.reports > 0) {
        stats.reports = await this._cleanupOldData(
          'reputation',
          this.settings.dataRetention.retentionDays.reports,
          now,
          true // Mantém reportes importantes
        );
      }
      
      stats.total = stats.calls + stats.logs + stats.reports;
      
      return {
        cleaned: true,
        timestamp: now.toISOString(),
        stats
      };
    } catch (error) {
      console.error('Erro durante limpeza de dados:', error);
      return {
        cleaned: false,
        error: error.message
      };
    }
  }
  
  /**
   * Exclui completamente todos os dados do usuário
   * 
   * @param {string} confirmationKey - Chave de confirmação para evitar exclusões acidentais
   * @returns {Promise<boolean>} - Resultado da operação
   */
  async purgeAllData(confirmationKey) {
    if (confirmationKey !== 'CONFIRM_PURGE_ALL_DATA') {
      throw new Error('Chave de confirmação inválida para exclusão de dados');
    }
    
    try {
      const stores = [
        'calls', 'reputation', 'logs', 'settings', 'sync_queue', 
        'profiles', 'community_data', 'rules'
      ];
      
      // Exclui dados de cada store
      for (const store of stores) {
        await offlineStorage.clearStore(store);
      }
      
      // Reinicia configurações de privacidade para o padrão
      this.settings = { ...DEFAULT_PRIVACY_SETTINGS };
      
      return true;
    } catch (error) {
      console.error('Erro durante exclusão completa de dados:', error);
      throw error;
    }
  }
  
  /**
   * Verifica se um armazenamento de dados está em conformidade com as configurações de privacidade
   * 
   * @param {string} storeName - Nome do store
   * @param {string} key - Chave do item
   * @param {any} value - Valor do item
   * @returns {boolean} - Se está em conformidade
   */
  isCompliant(storeName, key, value) {
    // Verificações específicas por tipo de store
    switch (storeName) {
      case 'calls':
        return this.settings.storage.storeCallHistory;
      
      case 'reputation':
        // Sempre permite armazenar dados de reputação, mas o compartilhamento é controlado
        return true;
      
      default:
        return true;
    }
  }
  
  // Métodos privados para operações internas
  
  /**
   * Agenda limpeza periódica de dados antigos
   * @private
   */
  _scheduleDataCleanup() {
    // Limpa o temporizador existente, se houver
    if (this._cleanupTimer) {
      clearTimeout(this._cleanupTimer);
    }
    
    // Se a retenção de dados estiver desativada, não agenda limpeza
    if (!this.settings.dataRetention.enabled) {
      return;
    }
    
    // Agenda para executar diariamente (86400000 ms = 24 horas)
    this._cleanupTimer = setTimeout(async () => {
      try {
        await this.performDataCleanup();
      } catch (error) {
        console.error('Erro durante limpeza agendada:', error);
      } finally {
        // Reagenda para o próximo dia
        this._scheduleDataCleanup();
      }
    }, 86400000);
  }
  
  /**
   * Limpa dados antigos de um store específico
   * 
   * @param {string} storeName - Nome do store a limpar
   * @param {number} maxAgeDays - Idade máxima em dias
   * @param {Date} now - Data atual
   * @param {boolean} keepImportant - Se deve manter itens importantes
   * @returns {Promise<number>} - Quantidade de itens removidos
   * @private
   */
  async _cleanupOldData(storeName, maxAgeDays, now, keepImportant = false) {
    try {
      const allItems = await offlineStorage.getAllItems(storeName);
      const cutoffDate = new Date(now.getTime() - (maxAgeDays * 86400000));
      let removedCount = 0;
      
      for (const item of allItems) {
        const { key, value } = item;
        
        // Verifica a data do item
        const itemDate = new Date(value.timestamp || value.date || value.createdAt || 0);
        
        // Pula itens sem data válida ou itens importantes que devem ser mantidos
        if (!itemDate || isNaN(itemDate.getTime())) continue;
        if (keepImportant && this._isImportantItem(value, storeName)) continue;
        
        // Remove itens mais antigos que a data de corte
        if (itemDate < cutoffDate) {
          await offlineStorage.removeItem(storeName, key);
          removedCount++;
        }
      }
      
      return removedCount;
    } catch (error) {
      console.error(`Erro ao limpar dados antigos de ${storeName}:`, error);
      return 0;
    }
  }
  
  /**
   * Verifica se um item é importante e deve ser preservado
   * 
   * @param {Object} item - Item a verificar
   * @param {string} storeName - Nome do store
   * @returns {boolean} - Se o item é importante
   * @private
   */
  _isImportantItem(item, storeName) {
    switch (storeName) {
      case 'calls':
        // Manter chamadas bloqueadas se configurado
        return this.settings.dataRetention.keepBlocked && item.blocked;
      
      case 'reputation':
        // Manter reportes de números perigosos
        return item.category === 'dangerous' || item.category === 'scam';
      
      default:
        return false;
    }
  }
  
  /**
   * Anonimiza dados de chamadas
   * 
   * @param {Object} callsData - Dados de chamadas
   * @returns {Object} - Dados anonimizados
   * @private
   */
  _anonymizeCalls(callsData) {
    if (Array.isArray(callsData)) {
      return callsData.map(call => {
        // Remove detalhes pessoais
        const anonymized = { ...call };
        
        // Substitui número real por hash
        if (anonymized.phoneNumber) {
          anonymized.phoneHash = secureHashPhone(anonymized.phoneNumber);
          delete anonymized.phoneNumber;
        }
        
        // Remove outros dados identificáveis
        delete anonymized.contactName;
        delete anonymized.notes;
        
        return anonymized;
      });
    }
    
    return callsData;
  }
  
  /**
   * Anonimiza dados de contatos
   * 
   * @param {Object} contactsData - Dados de contatos
   * @returns {Object} - Dados anonimizados
   * @private
   */
  _anonymizeContacts(contactsData) {
    if (this.settings.sharing.anonymizeContacts) {
      if (Array.isArray(contactsData)) {
        return contactsData.map(contact => {
          // Mantém apenas hashes dos números
          return {
            phoneHash: secureHashPhone(contact.phoneNumber || ''),
            isContact: true,
            // Mantém dados não identificáveis
            isTrusted: !!contact.isTrusted,
            isBlocked: !!contact.isBlocked
          };
        });
      }
    }
    
    // Não compartilha nenhum dado de contato se não estiver habilitado
    return [];
  }
  
  /**
   * Anonimiza dados de reputação
   * 
   * @param {Object} reputationData - Dados de reputação
   * @returns {Object} - Dados anonimizados
   * @private
   */
  _anonymizeReputationData(reputationData) {
    // Nível de privacidade afeta quais dados são compartilhados
    const privacyLevel = this.settings.sharing.privacyLevel;
    
    if (privacyLevel === 'maximum') {
      // Compartilha apenas categoria e score geral
      return {
        category: reputationData.category,
        score: reputationData.communityScore,
        reportCount: reputationData.reportCount,
        lastUpdated: new Date().toISOString()
      };
    } else if (privacyLevel === 'balanced') {
      // Compartilha mais dados mas remove detalhes específicos
      const anonymized = { ...reputationData };
      
      // Remove detalhes de eventos
      if (anonymized.events) {
        anonymized.events = anonymized.events.map(event => ({
          eventType: event.eventType,
          timestamp: event.timestamp,
          category: event.category
        }));
      }
      
      return anonymized;
    } else {
      // Nível padrão, compartilha mais dados
      return reputationData;
    }
  }
  
  /**
   * Cria dados agregados para compartilhamento com privacidade máxima
   * 
   * @param {Object} data - Dados originais
   * @param {string} dataType - Tipo de dados
   * @returns {Object} - Dados estatísticos agregados
   * @private
   */
  _createAggregatedData(data, dataType) {
    switch (dataType) {
      case 'calls':
        return {
          totalCalls: Array.isArray(data) ? data.length : 0,
          blockedCount: Array.isArray(data) ? data.filter(call => call.blocked).length : 0,
          timestamp: new Date().toISOString(),
          isAggregated: true
        };
      
      case 'reputation':
        return {
          category: data.category,
          isAggregated: true
        };
      
      default:
        return { isAggregated: true };
    }
  }
  
  /**
   * Remove informações identificáveis genéricas de um objeto
   * 
   * @param {Object} data - Dados a processar
   * @returns {Object} - Dados sem informações identificáveis
   * @private
   */
  _removeIdentifiableInfo(data) {
    // Campos comuns que podem conter informações identificáveis
    const identifiableFields = [
      'name', 'firstName', 'lastName', 'fullName', 'email', 'phone', 'phoneNumber',
      'address', 'city', 'state', 'zipCode', 'postalCode', 'birthDate', 'age',
      'ssn', 'socialSecurityNumber', 'passport', 'license', 'idNumber', 'notes'
    ];
    
    // Se for um array, processa cada item
    if (Array.isArray(data)) {
      return data.map(item => this._removeIdentifiableInfo(item));
    }
    
    // Se for um objeto, processa cada campo
    if (data && typeof data === 'object') {
      const result = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Pula campos identificáveis
        if (identifiableFields.includes(key)) {
          continue;
        }
        
        // Processa recursivamente objetos e arrays
        if (value && typeof value === 'object') {
          result[key] = this._removeIdentifiableInfo(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    }
    
    // Retorna primitivos sem alteração
    return data;
  }
}

// Exporta instância como singleton
const privacyManager = new PrivacyManager();
export default privacyManager;
