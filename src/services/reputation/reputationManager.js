/**
 * Sistema de Gerenciamento de Reputação para o Quero Paz
 * 
 * Este módulo gerencia a integração entre dados pessoais e da comunidade
 * para fornecer uma análise de reputação distribuída e robusta.
 */

import storage from '../storage';
import reputationScore, { REPUTATION_CATEGORIES } from './reputationScore';
import { hashPhoneNumber, anonymizeData } from './reputationUtils';

// Constantes para armazenamento
const REPUTATION_STORAGE_KEY = 'reputation_data';
const COMMUNITY_CACHE_KEY = 'community_reputation_cache';
const PERSONAL_EVENTS_KEY = 'reputation_events';

// Tipos de eventos
export const EVENT_TYPES = {
  BLOCK: 'block',                 // Bloqueio manual
  ALLOW: 'allow',                 // Permissão manual
  REPORT: 'report',               // Denúncia de spam/golpe
  CALL_RECEIVED: 'call_received', // Chamada recebida
  CALL_ANSWERED: 'call_answered', // Chamada atendida
  CALL_REJECTED: 'call_rejected', // Chamada rejeitada
  SMS_RECEIVED: 'sms_received',   // SMS recebido
  SMS_MARKED_SPAM: 'sms_spam'     // SMS marcado como spam
};

// Severidade de denúncias
export const REPORT_TYPES = {
  SPAM: { value: 'spam', severity: 2 },
  TELEMARKETING: { value: 'telemarketing', severity: 3 },
  SCAM: { value: 'scam', severity: 5 },
  HARASSMENT: { value: 'harassment', severity: 5 },
  ROBOCALL: { value: 'robocall', severity: 3 },
  SILENT_CALL: { value: 'silent_call', severity: 2 },
  WRONG_NUMBER: { value: 'wrong_number', severity: 1 }
};

/**
 * Gerenciador de reputação
 */
const reputationManager = {
  /**
   * Inicializa o sistema de reputação
   * @returns {Promise<void>}
   */
  async initialize() {
    // Verifica se já existe armazenamento de reputação
    const reputationData = await storage.getItem(REPUTATION_STORAGE_KEY);
    if (!reputationData) {
      await storage.setItem(REPUTATION_STORAGE_KEY, {
        numbers: {},
        lastUpdated: new Date().toISOString(),
        version: '1.0'
      });
    }
    
    // Verifica se já existe cache comunitário
    const communityCache = await storage.getItem(COMMUNITY_CACHE_KEY);
    if (!communityCache) {
      await storage.setItem(COMMUNITY_CACHE_KEY, {
        data: {},
        lastSynced: null,
        expiresAt: null
      });
    }
    
    // Verifica se já existe log de eventos
    const events = await storage.getItem(PERSONAL_EVENTS_KEY);
    if (!events) {
      await storage.setItem(PERSONAL_EVENTS_KEY, []);
    }
    
    console.log('Sistema de reputação inicializado');
  },
  
  /**
   * Registra um evento de reputação
   * @param {string} phoneNumber - Número de telefone
   * @param {string} eventType - Tipo de evento (EVENT_TYPES)
   * @param {Object} details - Detalhes adicionais do evento
   * @returns {Promise<Object>} Resultado com score atualizado
   */
  async recordEvent(phoneNumber, eventType, details = {}) {
    if (!phoneNumber || !eventType) {
      throw new Error('Número de telefone e tipo de evento são obrigatórios');
    }
    
    // Padroniza o formato do número
    const normalizedNumber = this._normalizePhoneNumber(phoneNumber);
    const hashedNumber = hashPhoneNumber(normalizedNumber);
    
    // Cria o objeto de evento
    const event = {
      id: Date.now().toString(),
      phoneNumber: normalizedNumber,
      phoneHash: hashedNumber,
      type: eventType,
      timestamp: new Date().toISOString(),
      details
    };
    
    try {
      // Adiciona ao log de eventos
      const events = await storage.getItem(PERSONAL_EVENTS_KEY) || [];
      await storage.setItem(PERSONAL_EVENTS_KEY, [event, ...events]);
      
      // Atualiza os dados de reputação
      const reputationData = await storage.getItem(REPUTATION_STORAGE_KEY) || { numbers: {} };
      
      // Extrai os dados atuais do número ou cria um novo registro
      const currentNumberData = reputationData.numbers[normalizedNumber] || {
        events: [],
        lastEvent: null,
        score: null,
        category: REPUTATION_CATEGORIES.UNKNOWN,
        firstSeen: new Date().toISOString(),
        personalData: {}
      };
      
      // Atualiza dados pessoais com base no tipo de evento
      switch (eventType) {
        case EVENT_TYPES.BLOCK:
          currentNumberData.personalData.blocked = true;
          currentNumberData.personalData.blockedAt = new Date().toISOString();
          currentNumberData.personalData.blockReason = details.reason;
          break;
          
        case EVENT_TYPES.ALLOW:
          currentNumberData.personalData.blocked = false;
          currentNumberData.personalData.accepted = true;
          currentNumberData.personalData.acceptedAt = new Date().toISOString();
          break;
          
        case EVENT_TYPES.REPORT:
          if (!currentNumberData.personalData.reports) {
            currentNumberData.personalData.reports = [];
          }
          currentNumberData.personalData.reports.push({
            type: details.reportType,
            timestamp: new Date().toISOString(),
            details: details.reportDetails
          });
          break;
          
        case EVENT_TYPES.CALL_ANSWERED:
          if (!currentNumberData.personalData.callHistory) {
            currentNumberData.personalData.callHistory = [];
          }
          currentNumberData.personalData.callHistory.push({
            type: 'answered',
            timestamp: new Date().toISOString(),
            duration: details.duration || 0
          });
          
          // Atualiza duração média
          const answeredCalls = currentNumberData.personalData.callHistory.filter(c => c.type === 'answered');
          const totalDuration = answeredCalls.reduce((sum, call) => sum + (call.duration || 0), 0);
          currentNumberData.personalData.avgDuration = totalDuration / answeredCalls.length;
          break;
          
        // Processar outros tipos de eventos...
      }
      
      // Adiciona evento ao histórico local
      currentNumberData.events.push({
        type: eventType,
        timestamp: new Date().toISOString(),
        details: details
      });
      
      // Mantém apenas os 20 eventos mais recentes para economizar espaço
      if (currentNumberData.events.length > 20) {
        currentNumberData.events = currentNumberData.events.slice(-20);
      }
      
      currentNumberData.lastEvent = {
        type: eventType,
        timestamp: new Date().toISOString()
      };
      
      // Recupera dados da comunidade para este número
      const communityData = await this.getCommunityData(normalizedNumber);
      
      // Recalcula pontuação
      const scoreResult = reputationScore.computeScore(
        normalizedNumber,
        currentNumberData.personalData,
        communityData
      );
      
      // Atualiza os dados de pontuação
      currentNumberData.score = scoreResult.score;
      currentNumberData.category = scoreResult.category;
      currentNumberData.confidence = scoreResult.confidence;
      currentNumberData.factors = scoreResult.factors;
      currentNumberData.updatedAt = new Date().toISOString();
      
      // Salva dados atualizados
      reputationData.numbers[normalizedNumber] = currentNumberData;
      reputationData.lastUpdated = new Date().toISOString();
      
      await storage.setItem(REPUTATION_STORAGE_KEY, reputationData);
      
      // Atualiza dados da comunidade em segundo plano, se apropriado
      if (eventType === EVENT_TYPES.BLOCK || eventType === EVENT_TYPES.REPORT) {
        this._contributeToCommunityData(normalizedNumber, eventType, details).catch(err => {
          console.error('Erro ao contribuir com dados da comunidade:', err);
        });
      }
      
      return {
        success: true,
        phoneNumber: normalizedNumber,
        event: eventType,
        score: scoreResult.score,
        category: scoreResult.category,
        action: reputationScore.getRecommendedAction(scoreResult)
      };
    } catch (error) {
      console.error('Erro ao registrar evento de reputação:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao registrar evento'
      };
    }
  },
  
  /**
   * Obtém a pontuação de reputação de um número
   * @param {string} phoneNumber - Número a verificar
   * @param {boolean} forceRefresh - Se deve forçar atualização com dados da comunidade
   * @returns {Promise<Object>} Dados de reputação
   */
  async getReputation(phoneNumber, forceRefresh = false) {
    if (!phoneNumber) {
      throw new Error('Número de telefone é obrigatório');
    }
    
    // Padroniza o formato do número
    const normalizedNumber = this._normalizePhoneNumber(phoneNumber);
    
    try {
      // Recupera dados de reputação
      const reputationData = await storage.getItem(REPUTATION_STORAGE_KEY) || { numbers: {} };
      const numberData = reputationData.numbers[normalizedNumber];
      
      // Se não há dados ou força atualização, recupera dados da comunidade
      if (!numberData || forceRefresh) {
        const communityData = await this.getCommunityData(normalizedNumber, forceRefresh);
        
        // Se não tem dados pessoais nem da comunidade, retorna desconhecido
        if (!numberData && Object.keys(communityData).length === 0) {
          return {
            phoneNumber: normalizedNumber,
            score: null,
            category: REPUTATION_CATEGORIES.UNKNOWN,
            confidence: 0,
            factors: [],
            action: 'ask',
            hasLocalData: false,
            hasCommunityData: false
          };
        }
        
        // Calcula pontuação com os dados disponíveis
        const personalData = numberData ? numberData.personalData : {};
        const scoreResult = reputationScore.computeScore(
          normalizedNumber,
          personalData,
          communityData
        );
        
        // Se não tinha dados locais, cria um novo registro
        if (!numberData) {
          reputationData.numbers[normalizedNumber] = {
            events: [],
            lastEvent: null,
            score: scoreResult.score,
            category: scoreResult.category,
            confidence: scoreResult.confidence,
            factors: scoreResult.factors,
            firstSeen: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            personalData: {}
          };
          
          await storage.setItem(REPUTATION_STORAGE_KEY, reputationData);
        }
        
        return {
          phoneNumber: normalizedNumber,
          score: scoreResult.score,
          category: scoreResult.category,
          confidence: scoreResult.confidence,
          factors: scoreResult.factors,
          action: reputationScore.getRecommendedAction(scoreResult),
          hasLocalData: numberData ? true : false,
          hasCommunityData: Object.keys(communityData).length > 0
        };
      }
      
      // Retorna dados existentes
      return {
        phoneNumber: normalizedNumber,
        score: numberData.score,
        category: numberData.category,
        confidence: numberData.confidence,
        factors: numberData.factors,
        action: reputationScore.getRecommendedAction(numberData),
        firstSeen: numberData.firstSeen,
        lastUpdated: numberData.updatedAt,
        hasLocalData: true,
        hasCommunityData: numberData.hasCommunityData || false
      };
    } catch (error) {
      console.error('Erro ao obter reputação:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao obter reputação'
      };
    }
  },
  
  /**
   * Obtém dados de reputação da comunidade para um número
   * @param {string} phoneNumber - Número a verificar
   * @param {boolean} forceRefresh - Se deve forçar atualização do cache
   * @returns {Promise<Object>} Dados da comunidade
   */
  async getCommunityData(phoneNumber, forceRefresh = false) {
    // Padroniza o formato do número
    const normalizedNumber = this._normalizePhoneNumber(phoneNumber);
    const hashedNumber = hashPhoneNumber(normalizedNumber);
    
    try {
      // Verifica cache
      const communityCache = await storage.getItem(COMMUNITY_CACHE_KEY) || { data: {} };
      
      // Se tem no cache e não expirou, usa o cache
      const now = new Date().getTime();
      const hasCache = communityCache.data[hashedNumber];
      const cacheValid = hasCache && communityCache.expiresAt && new Date(communityCache.expiresAt).getTime() > now;
      
      if (hasCache && cacheValid && !forceRefresh) {
        return communityCache.data[hashedNumber];
      }
      
      // Aqui, em uma implementação real, faria uma requisição a um servidor
      // Para este protótipo, vamos simular dados da comunidade
      
      // Tempo de resposta simulado para experiência realista
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Dados simulados baseados no hash do número (deterministicamente aleatório)
      const hashSum = hashedNumber.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      
      let communityData = {};
      
      // Números específicos para demonstração
      if (normalizedNumber.endsWith('99')) {
        // Número muito reportado (spam conhecido)
        communityData = {
          blockCount: 120 + (hashSum % 50),
          reportCount: 83 + (hashSum % 30),
          reportSeverity: 4.2,
          categories: ['spam', 'telemarketing'],
          firstReported: '2023-01-15T10:20:30Z',
          localMatch: false
        };
      } else if (normalizedNumber.endsWith('00')) {
        // Número de serviço legítimo
        communityData = {
          blockCount: 3 + (hashSum % 5),
          reportCount: 1,
          reportSeverity: 1.0,
          categories: ['service'],
          localMatch: true
        };
      } else {
        // Números aleatórios baseados no hash
        const isSpammy = (hashSum % 10) > 7; // 30% de chance de ser spam
        
        if (isSpammy) {
          communityData = {
            blockCount: 5 + (hashSum % 20),
            reportCount: 3 + (hashSum % 10),
            reportSeverity: 2.5 + (hashSum % 25) / 10,
            categories: ['spam'],
            localMatch: (hashSum % 2) === 0
          };
        } else if ((hashSum % 100) > 80) { // 20% de chance de ter algum dado
          communityData = {
            blockCount: 1 + (hashSum % 3),
            reportCount: (hashSum % 2),
            reportSeverity: 1.5,
            categories: [],
            localMatch: (hashSum % 2) === 0
          };
        } else {
          // Nenhum dado da comunidade para este número
          communityData = {};
        }
      }
      
      // Atualiza o cache
      communityCache.data[hashedNumber] = communityData;
      communityCache.lastSynced = new Date().toISOString();
      
      // Cache expira em 24 horas para números não relevantes, 6 horas para relevantes
      const relevantNumber = Object.keys(communityData).length > 0;
      const expiration = new Date();
      expiration.setHours(expiration.getHours() + (relevantNumber ? 6 : 24));
      communityCache.expiresAt = expiration.toISOString();
      
      await storage.setItem(COMMUNITY_CACHE_KEY, communityCache);
      
      return communityData;
    } catch (error) {
      console.error('Erro ao obter dados da comunidade:', error);
      return {};
    }
  },
  
  /**
   * Contribui com dados para o sistema comunitário
   * @param {string} phoneNumber - Número reportado
   * @param {string} eventType - Tipo de evento
   * @param {Object} details - Detalhes do evento
   * @returns {Promise<Object>} Resultado da contribuição
   * @private
   */
  async _contributeToCommunityData(phoneNumber, eventType, details) {
    // Padroniza o formato do número
    const normalizedNumber = this._normalizePhoneNumber(phoneNumber);
    
    // Anonimiza os dados antes de enviar
    const anonymousData = anonymizeData({
      phoneHash: hashPhoneNumber(normalizedNumber),
      eventType,
      timestamp: new Date().toISOString(),
      details: {
        reportType: details.reportType,
        // Não inclui detalhes pessoais
      }
    });
    
    // Em uma implementação real, enviaria para um servidor
    console.log('Contribuindo para dados da comunidade (simulado):', anonymousData);
    
    // Simulação de envio
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return { success: true };
  },
  
  /**
   * Limpa os dados de reputação de um número específico
   * @param {string} phoneNumber - Número a limpar
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async clearNumberData(phoneNumber) {
    if (!phoneNumber) return false;
    
    const normalizedNumber = this._normalizePhoneNumber(phoneNumber);
    
    try {
      const reputationData = await storage.getItem(REPUTATION_STORAGE_KEY);
      if (!reputationData || !reputationData.numbers) return false;
      
      // Remove o número dos dados
      if (reputationData.numbers[normalizedNumber]) {
        delete reputationData.numbers[normalizedNumber];
        await storage.setItem(REPUTATION_STORAGE_KEY, reputationData);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao limpar dados do número:', error);
      return false;
    }
  },
  
  /**
   * Sincroniza dados da comunidade para os números mais relevantes
   * @param {number} limit - Quantidade de números a sincronizar
   * @returns {Promise<Object>} Resultado da sincronização
   */
  async syncCommunityData(limit = 20) {
    try {
      // Recupera dados de reputação
      const reputationData = await storage.getItem(REPUTATION_STORAGE_KEY) || { numbers: {} };
      
      // Obtém os números mais relevantes (recentemente usados ou bloqueados)
      const relevantNumbers = Object.entries(reputationData.numbers)
        .map(([number, data]) => ({
          number,
          lastUpdate: new Date(data.updatedAt || data.firstSeen).getTime(),
          isBlocked: data.personalData && data.personalData.blocked
        }))
        .sort((a, b) => {
          // Prioriza números bloqueados
          if (a.isBlocked && !b.isBlocked) return -1;
          if (!a.isBlocked && b.isBlocked) return 1;
          // Depois por data de atualização
          return b.lastUpdate - a.lastUpdate;
        })
        .slice(0, limit)
        .map(item => item.number);
      
      // Atualiza cada número em paralelo
      const updatePromises = relevantNumbers.map(number => 
        this.getCommunityData(number, true)
          .then(communityData => ({ number, success: true, communityData }))
          .catch(error => ({ number, success: false, error }))
      );
      
      const results = await Promise.all(updatePromises);
      
      return {
        success: true,
        updated: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erro ao sincronizar dados da comunidade:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido na sincronização'
      };
    }
  },
  
  /**
   * Retorna estatísticas do sistema de reputação
   * @returns {Promise<Object>} Estatísticas
   */
  async getStatistics() {
    try {
      const reputationData = await storage.getItem(REPUTATION_STORAGE_KEY) || { numbers: {} };
      const events = await storage.getItem(PERSONAL_EVENTS_KEY) || [];
      
      // Conta por categoria
      const categoryCounts = {};
      Object.values(reputationData.numbers).forEach(data => {
        categoryCounts[data.category] = (categoryCounts[data.category] || 0) + 1;
      });
      
      // Conta eventos por tipo
      const eventCounts = {};
      events.forEach(event => {
        eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
      });
      
      return {
        totalNumbers: Object.keys(reputationData.numbers).length,
        totalEvents: events.length,
        categories: categoryCounts,
        events: eventCounts,
        lastUpdated: reputationData.lastUpdated || null
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao obter estatísticas'
      };
    }
  },
  
  /**
   * Normaliza um número de telefone para formato padrão
   * @param {string} phoneNumber - Número a normalizar
   * @returns {string} Número normalizado
   * @private
   */
  _normalizePhoneNumber(phoneNumber) {
    // Remove todos os caracteres não numéricos
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    
    // Implementação básica para este protótipo
    // Em uma implementação real, usaria uma biblioteca como libphonenumber
    return digitsOnly;
  }
};

export default reputationManager;
