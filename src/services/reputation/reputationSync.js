/**
 * ReputationSync - Gerencia a sincronização dos dados de reputação entre dispositivos
 * 
 * Este módulo é responsável por:
 * - Sincronizar eventos de reputação quando o dispositivo está offline e depois fica online
 * - Garantir que os dados de reputação sejam consistentes entre dispositivos
 * - Implementar mecanismos de reconciliação para resolver conflitos
 */

import SyncManager from '../sync/syncManager';
import OfflineStorage from '../sync/offlineStorage';
import { compressData, decompressData } from '../sync/compression';
import ReputationManager from './reputationManager';
import { anonymizePhoneData, validatePhoneNumber, hashPhoneNumber } from './reputationUtils';

class ReputationSync {
  constructor() {
    this.pendingEvents = [];
    this.isInitialized = false;
    this.syncInProgress = false;
    this.eventListeners = {};
    this.STORAGE_KEYS = {
      PENDING_EVENTS: 'pendingReputationEvents',
      LAST_SYNC: 'lastReputationSync',
      SYNC_CONFIG: 'reputationSyncConfig'
    };
  }

  /**
   * Inicializa o sistema de sincronização de reputação
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Carrega eventos pendentes do armazenamento offline
      this.pendingEvents = await OfflineStorage.getItem('reputation', this.STORAGE_KEYS.PENDING_EVENTS) || [];
      
      // Registra os handlers de eventos com o SyncManager
      SyncManager.addEventListener('syncStart', this.handleSyncStart.bind(this));
      SyncManager.addEventListener('syncComplete', this.handleSyncComplete.bind(this));
      SyncManager.addEventListener('syncError', this.handleSyncError.bind(this));
      SyncManager.addEventListener('onlineStatusChanged', this.handleOnlineStatusChange.bind(this));
      
      // Configura temporizador para verificar periodicamente por eventos pendentes
      this.setupPendingEventsTimer();
      
      this.isInitialized = true;
      this.dispatchEvent('initialized', { success: true });
      
      console.log('ReputationSync initialized successfully');
    } catch (error) {
      console.error('Error initializing ReputationSync:', error);
      this.dispatchEvent('error', { error: 'Failed to initialize ReputationSync' });
    }
  }

  /**
   * Adiciona um evento de reputação para sincronização posterior
   * 
   * @param {string} phoneNumber - Número de telefone
   * @param {string} eventType - Tipo de evento (block, report, approve, etc)
   * @param {Object} details - Detalhes adicionais sobre o evento
   */
  async queueEvent(phoneNumber, eventType, details = {}) {
    if (!validatePhoneNumber(phoneNumber)) {
      console.error('Invalid phone number format for reputation sync event');
      return false;
    }

    try {
      // Cria o objeto de evento
      const event = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date().toISOString(),
        phoneHash: hashPhoneNumber(phoneNumber),
        eventType,
        details: anonymizePhoneData(details),
        synced: false,
        retryCount: 0
      };
      
      // Adiciona à lista de eventos pendentes
      this.pendingEvents.push(event);
      
      // Salva no armazenamento
      await OfflineStorage.setItem('reputation', this.STORAGE_KEYS.PENDING_EVENTS, this.pendingEvents);
      
      // Se estiver online, tenta sincronizar imediatamente
      if (navigator.onLine && !this.syncInProgress) {
        this.syncPendingEvents();
      }
      
      this.dispatchEvent('eventQueued', { event });
      return true;
    } catch (error) {
      console.error('Error queuing reputation event:', error);
      this.dispatchEvent('error', { error: 'Failed to queue reputation event' });
      return false;
    }
  }

  /**
   * Sincroniza todos os eventos pendentes com o servidor
   */
  async syncPendingEvents() {
    if (this.syncInProgress || !navigator.onLine || this.pendingEvents.length === 0) {
      return false;
    }

    this.syncInProgress = true;
    this.dispatchEvent('syncStart', { pendingCount: this.pendingEvents.length });

    try {
      const eventsToSync = [...this.pendingEvents];
      
      // Comprime os dados para economizar largura de banda
      const compressedData = await compressData(JSON.stringify(eventsToSync));
      
      // Sincroniza com o servidor via SyncManager
      await SyncManager.syncData('reputation_events', compressedData, {
        type: 'reputation',
        count: eventsToSync.length
      });
      
      // Marca eventos como sincronizados
      this.pendingEvents = this.pendingEvents.filter(event => {
        return !eventsToSync.some(e => e.id === event.id);
      });
      
      // Atualiza o armazenamento
      await OfflineStorage.setItem('reputation', this.STORAGE_KEYS.PENDING_EVENTS, this.pendingEvents);
      await OfflineStorage.setItem('reputation', this.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      
      this.syncInProgress = false;
      this.dispatchEvent('syncComplete', { 
        syncedCount: eventsToSync.length,
        pendingCount: this.pendingEvents.length
      });
      
      return true;
    } catch (error) {
      console.error('Error syncing reputation events:', error);
      
      // Incrementa o contador de retry para eventos que falharam
      this.pendingEvents = this.pendingEvents.map(event => ({
        ...event,
        retryCount: event.retryCount + 1
      }));
      
      // Eventos com muitas tentativas são removidos para evitar loops infinitos
      this.pendingEvents = this.pendingEvents.filter(event => event.retryCount < 5);
      
      // Atualiza o armazenamento
      await OfflineStorage.setItem('reputation', this.STORAGE_KEYS.PENDING_EVENTS, this.pendingEvents);
      
      this.syncInProgress = false;
      this.dispatchEvent('syncError', { 
        error: error.message || 'Unknown error during reputation sync',
        pendingCount: this.pendingEvents.length
      });
      
      return false;
    }
  }

  /**
   * Busca dados de reputação atualizados do servidor
   * 
   * @param {string} phoneNumber - Número de telefone para obter dados
   */
  async fetchReputationData(phoneNumber) {
    if (!validatePhoneNumber(phoneNumber)) {
      throw new Error('Invalid phone number format');
    }

    if (!navigator.onLine) {
      return await ReputationManager.getLocalReputationData(phoneNumber);
    }

    try {
      const phoneHash = hashPhoneNumber(phoneNumber);
      
      // Solicita dados de reputação do servidor via SyncManager
      const compressedData = await SyncManager.fetchData(`reputation_data/${phoneHash}`);
      
      if (!compressedData) {
        return null;
      }
      
      // Descomprime os dados
      const reputationData = JSON.parse(await decompressData(compressedData));
      
      // Armazena localmente para acesso offline
      await ReputationManager.updateLocalReputationData(phoneNumber, reputationData);
      
      return reputationData;
    } catch (error) {
      console.error('Error fetching reputation data:', error);
      
      // Em caso de erro, usa dados locais
      return await ReputationManager.getLocalReputationData(phoneNumber);
    }
  }

  /**
   * Reconcilia dados de reputação local com dados do servidor
   * 
   * @param {string} phoneNumber - Número de telefone para reconciliar dados
   */
  async reconcileReputationData(phoneNumber) {
    if (!validatePhoneNumber(phoneNumber)) {
      throw new Error('Invalid phone number format');
    }

    try {
      // Obtém dados locais e do servidor
      const localData = await ReputationManager.getLocalReputationData(phoneNumber);
      let serverData = null;
      
      if (navigator.onLine) {
        try {
          serverData = await this.fetchReputationData(phoneNumber);
        } catch (error) {
          console.warn('Could not fetch server data for reconciliation:', error);
        }
      }
      
      // Se não houver dados do servidor, não há nada para reconciliar
      if (!serverData) {
        return localData;
      }
      
      // Implementa estratégia de reconciliação
      const reconciledData = this.mergeReputationData(localData, serverData);
      
      // Atualiza dados locais
      await ReputationManager.updateLocalReputationData(phoneNumber, reconciledData);
      
      // Se tiver conexão, atualiza também no servidor
      if (navigator.onLine) {
        const phoneHash = hashPhoneNumber(phoneNumber);
        const compressedData = await compressData(JSON.stringify(reconciledData));
        
        await SyncManager.syncData(`reputation_data/${phoneHash}`, compressedData, {
          type: 'reputation_reconcile',
          phoneHash
        });
      }
      
      return reconciledData;
    } catch (error) {
      console.error('Error reconciling reputation data:', error);
      throw error;
    }
  }

  /**
   * Mescla dados de reputação local e do servidor usando estratégias de resolução de conflitos
   * 
   * @param {Object} localData - Dados de reputação locais
   * @param {Object} serverData - Dados de reputação do servidor
   * @returns {Object} Dados mesclados
   */
  mergeReputationData(localData, serverData) {
    if (!localData) return serverData;
    if (!serverData) return localData;
    
    // Estratégia de mesclagem:
    // 1. Para contadores (reports, blocks, etc): usa o valor maior
    // 2. Para timestamps: usa o mais recente
    // 3. Para listas de eventos: concatena e remove duplicados
    
    const mergedData = {
      // Usa o maior valor para contadores
      reportCount: Math.max(localData.reportCount || 0, serverData.reportCount || 0),
      blockCount: Math.max(localData.blockCount || 0, serverData.blockCount || 0),
      approveCount: Math.max(localData.approveCount || 0, serverData.approveCount || 0),
      
      // Usa o timestamp mais recente
      lastUpdated: this.getLatestTimestamp(localData.lastUpdated, serverData.lastUpdated),
      
      // Mescla categorias, priorizando a categoria mais severa
      category: this.mergeSeverityCategory(localData.category, serverData.category),
      
      // Mescla scores
      communityScore: this.mergeScores(localData.communityScore, serverData.communityScore),
      personalScore: this.mergeScores(localData.personalScore, serverData.personalScore),
      
      // Mescla eventos
      events: this.mergeEvents(localData.events || [], serverData.events || []),
      
      // Mescla metadados
      metadata: { ...(serverData.metadata || {}), ...(localData.metadata || {}) }
    };
    
    return mergedData;
  }

  /**
   * Obtém o timestamp mais recente entre dois
   */
  getLatestTimestamp(timestamp1, timestamp2) {
    if (!timestamp1) return timestamp2;
    if (!timestamp2) return timestamp1;
    
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    
    return date1 > date2 ? timestamp1 : timestamp2;
  }

  /**
   * Mescla categorias priorizando a mais severa
   */
  mergeSeverityCategory(category1, category2) {
    const severityOrder = {
      'safe': 1,
      'unknown': 2,
      'suspicious': 3,
      'spam': 4,
      'scam': 5,
      'dangerous': 6
    };
    
    if (!category1) return category2;
    if (!category2) return category1;
    
    return severityOrder[category1] >= severityOrder[category2] ? category1 : category2;
  }

  /**
   * Mescla scores de reputação
   */
  mergeScores(score1, score2) {
    if (score1 === undefined || score1 === null) return score2;
    if (score2 === undefined || score2 === null) return score1;
    
    // Se a diferença for menor que 10, faz uma média ponderada
    // Caso contrário, usa o valor mais baixo para ser conservador
    const diff = Math.abs(score1 - score2);
    
    if (diff < 10) {
      // Média ponderada, dando mais peso ao score mais baixo
      return (score1 * 0.6 + score2 * 0.4);
    } else {
      return Math.min(score1, score2);
    }
  }

  /**
   * Mescla listas de eventos, removendo duplicados
   */
  mergeEvents(events1, events2) {
    const allEvents = [...events1, ...events2];
    
    // Remove duplicados com base no ID do evento
    const uniqueEvents = [];
    const eventIds = new Set();
    
    for (const event of allEvents) {
      if (!event.id || eventIds.has(event.id)) continue;
      
      eventIds.add(event.id);
      uniqueEvents.push(event);
    }
    
    // Ordena por timestamp, mais recente primeiro
    return uniqueEvents.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0);
      const dateB = new Date(b.timestamp || 0);
      return dateB - dateA;
    });
  }

  /**
   * Configura um temporizador para verificar periodicamente eventos pendentes
   */
  setupPendingEventsTimer() {
    // Verifica a cada 5 minutos, ou quando o dispositivo ficar online
    setInterval(() => {
      if (navigator.onLine && !this.syncInProgress && this.pendingEvents.length > 0) {
        this.syncPendingEvents();
      }
    }, 5 * 60 * 1000); // 5 minutos
  }

  /**
   * Handler para quando a sincronização inicia
   */
  handleSyncStart() {
    // Podemos implementar alguma lógica adicional aqui se necessário
    console.log('Global sync started, preparing reputation data');
  }

  /**
   * Handler para quando a sincronização é concluída
   */
  handleSyncComplete() {
    // Se houver eventos pendentes, tenta sincronizá-los agora
    if (this.pendingEvents.length > 0 && !this.syncInProgress) {
      setTimeout(() => {
        this.syncPendingEvents();
      }, 1000); // Pequeno atraso para não sobrecarregar
    }
  }

  /**
   * Handler para erros de sincronização
   */
  handleSyncError(event) {
    console.error('Global sync error, reputation sync may be affected:', event.detail?.error);
  }

  /**
   * Handler para mudanças no status online/offline
   */
  handleOnlineStatusChange(event) {
    const isOnline = event.detail?.isOnline ?? navigator.onLine;
    
    if (isOnline && this.pendingEvents.length > 0 && !this.syncInProgress) {
      // Dispositivo acabou de ficar online, tenta sincronizar eventos pendentes
      setTimeout(() => {
        this.syncPendingEvents();
      }, 2000); // Pequeno atraso para garantir que a conexão está estável
    }
  }

  /**
   * Adiciona um event listener
   * 
   * @param {string} eventName - Nome do evento
   * @param {Function} callback - Função de callback
   */
  addEventListener(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    
    this.eventListeners[eventName].push(callback);
  }

  /**
   * Remove um event listener
   * 
   * @param {string} eventName - Nome do evento
   * @param {Function} callback - Função de callback
   */
  removeEventListener(eventName, callback) {
    if (!this.eventListeners[eventName]) return;
    
    this.eventListeners[eventName] = this.eventListeners[eventName]
      .filter(listener => listener !== callback);
  }

  /**
   * Dispara um evento para todos os listeners registrados
   * 
   * @param {string} eventName - Nome do evento
   * @param {Object} data - Dados do evento
   */
  dispatchEvent(eventName, data = {}) {
    if (!this.eventListeners[eventName]) return;
    
    for (const callback of this.eventListeners[eventName]) {
      callback({
        type: eventName,
        detail: data,
        timestamp: new Date()
      });
    }
  }
}

// Exporta como singleton
export default new ReputationSync();
