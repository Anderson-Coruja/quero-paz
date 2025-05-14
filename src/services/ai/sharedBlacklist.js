/**
 * Sistema de Blacklist Compartilhada para o Quero Paz
 * 
 * Este serviço permite integração com uma base de dados comunitária
 * de números indesejados, aumentando a proteção colaborativa.
 */

import storage from '../storage';

// URL base da API (simulada - em produção, seria um endpoint real)
const API_BASE_URL = 'https://api.queropaz.com.br/v1';

// Cache local de números bloqueados
let cachedBlacklist = null;
let lastFetchTime = 0;
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 horas em ms

/**
 * Serviço de blacklist compartilhada
 */
const sharedBlacklist = {
  /**
   * Inicializa o sistema de blacklist
   * @returns {Promise<void>}
   */
  async initialize() {
    // Carrega blacklist do armazenamento local para uso offline
    try {
      const savedList = await storage.getItem('shared_blacklist');
      if (savedList) {
        cachedBlacklist = savedList.data;
        lastFetchTime = savedList.timestamp;
      }
    } catch (error) {
      console.error('Erro ao carregar blacklist compartilhada:', error);
    }
  },
  
  /**
   * Verifica se um número está na blacklist compartilhada
   * @param {string} phoneNumber - Número a verificar
   * @returns {Promise<Object>} Resultado da verificação
   */
  async checkNumber(phoneNumber) {
    // Garante que a blacklist está atualizada
    await this.ensureUpdated();
    
    if (!cachedBlacklist) return { isBlocked: false };
    
    // Verifica coincidência exata
    const exactMatch = cachedBlacklist.find(item => 
      item.phoneNumber === phoneNumber || 
      item.phoneNumber === phoneNumber.replace(/\D/g, '')
    );
    
    if (exactMatch) {
      return {
        isBlocked: true,
        reason: exactMatch.reason || 'Número reportado pela comunidade',
        reportCount: exactMatch.reportCount || 1,
        category: exactMatch.category || 'desconhecido',
        confidence: exactMatch.confidence || 'medium'
      };
    }
    
    // Verifica coincidência por prefixo (para operadoras ou regiões conhecidas)
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const prefixMatch = cachedBlacklist.find(item => 
      item.type === 'prefix' && 
      cleanNumber.startsWith(item.prefix)
    );
    
    if (prefixMatch) {
      return {
        isBlocked: true,
        reason: prefixMatch.reason || 'Prefixo reportado pela comunidade',
        reportCount: prefixMatch.reportCount || 1,
        category: prefixMatch.category || 'desconhecido',
        confidence: 'low' // Confiança mais baixa para coincidências de prefixo
      };
    }
    
    return { isBlocked: false };
  },
  
  /**
   * Sincroniza a blacklist com o servidor (ou simula, neste caso)
   * @param {boolean} force - Força a atualização mesmo que o cache seja recente
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async syncWithServer(force = false) {
    const now = Date.now();
    
    // Só atualiza se o cache estiver vencido ou se for forçado
    if (!force && cachedBlacklist && (now - lastFetchTime) < CACHE_TTL) {
      return true;
    }
    
    try {
      // Em um app real, faríamos uma chamada API
      // Neste protótipo, simulamos com dados estáticos
      
      // Simula uma latência de rede
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Dados simulados de blacklist
      const mockData = [
        {
          phoneNumber: '551145678901',
          reason: 'Telemarketing agressivo',
          reportCount: 42,
          category: 'telemarketing',
          confidence: 'high',
          firstReported: '2023-01-15'
        },
        {
          phoneNumber: '11983745620',
          reason: 'Golpe financeiro',
          reportCount: 27,
          category: 'scam',
          confidence: 'high',
          firstReported: '2023-03-22'
        },
        {
          type: 'prefix',
          prefix: '11994',
          reason: 'Operadora associada a spam',
          reportCount: 89,
          category: 'spam',
          confidence: 'medium',
          firstReported: '2023-02-10'
        },
        // Mais exemplos seriam adicionados aqui...
      ];
      
      // Atualiza o cache
      cachedBlacklist = mockData;
      lastFetchTime = now;
      
      // Salva no armazenamento local para uso offline
      await storage.setItem('shared_blacklist', {
        data: mockData,
        timestamp: now,
        version: '1.0'
      });
      
      console.log('Blacklist compartilhada atualizada com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao sincronizar blacklist compartilhada:', error);
      return false;
    }
  },
  
  /**
   * Garante que a blacklist está atualizada
   * @returns {Promise<void>}
   */
  async ensureUpdated() {
    if (!cachedBlacklist || (Date.now() - lastFetchTime) > CACHE_TTL) {
      await this.syncWithServer();
    }
  },
  
  /**
   * Reporta um número para a blacklist comunitária
   * @param {string} phoneNumber - Número a reportar
   * @param {string} reason - Motivo do reporte
   * @param {string} category - Categoria (spam, scam, telemarketing, etc)
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async reportNumber(phoneNumber, reason, category) {
    try {
      // Em um app real, faríamos uma chamada POST para a API
      // Aqui apenas simulamos a operação
      
      console.log(`Número ${phoneNumber} reportado como ${category}: ${reason}`);
      
      // Simula latência de rede
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Atualiza o cache local para feedback imediato ao usuário
      if (cachedBlacklist) {
        const existing = cachedBlacklist.find(item => item.phoneNumber === phoneNumber);
        
        if (existing) {
          // Incrementa contagem de reports para número existente
          existing.reportCount = (existing.reportCount || 1) + 1;
          existing.reason = reason || existing.reason;
          existing.category = category || existing.category;
        } else {
          // Adiciona novo número à lista
          cachedBlacklist.push({
            phoneNumber,
            reason,
            category,
            reportCount: 1,
            confidence: 'low', // Começa com confiança baixa
            firstReported: new Date().toISOString().split('T')[0]
          });
        }
        
        // Salva a versão atualizada localmente
        await storage.setItem('shared_blacklist', {
          data: cachedBlacklist,
          timestamp: lastFetchTime,
          version: '1.0'
        });
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao reportar número:', error);
      return false;
    }
  },
  
  /**
   * Obtém estatísticas da blacklist
   * @returns {Promise<Object>} Estatísticas
   */
  async getStats() {
    await this.ensureUpdated();
    
    if (!cachedBlacklist) return { total: 0 };
    
    // Calcula estatísticas
    const categories = {};
    let totalReportCount = 0;
    
    cachedBlacklist.forEach(item => {
      // Contabiliza por categoria
      const category = item.category || 'unknown';
      categories[category] = (categories[category] || 0) + 1;
      
      // Soma relatórios totais
      totalReportCount += (item.reportCount || 1);
    });
    
    return {
      total: cachedBlacklist.length,
      lastUpdated: new Date(lastFetchTime).toISOString(),
      totalReportCount,
      categories,
      prefixRules: cachedBlacklist.filter(item => item.type === 'prefix').length
    };
  }
};

export default sharedBlacklist;
