/**
 * Sistema de Sincronização Eficiente para o Quero Paz
 * 
 * Este módulo implementa sincronização delta, compressão e economia de dados
 * para manter os dados sincronizados entre dispositivos com mínimo uso de rede.
 */

import offlineStorage, { STORES } from './offlineStorage';

// Compressor de dados nativo para Web
import { compress, decompress } from './compression';

// Configurações
const SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutos em produção
const RETRY_DELAY = 60 * 1000; // 1 minuto entre retentativas
const MAX_RETRIES = 5; // Máximo de tentativas de sincronização
const MAX_BATCH_SIZE = 50; // Máximo de itens por batch
const SYNC_ENDPOINT = 'https://api.queropaz.com.br/v1/sync'; // Simulado

// Estados de sincronização
export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
  OFFLINE: 'offline'
};

/**
 * Gerenciador de sincronização
 */
const syncManager = {
  status: SYNC_STATUS.IDLE,
  lastSync: null,
  syncTimer: null,
  retryCount: 0,
  listeners: new Set(),
  
  /**
   * Inicializa o sistema de sincronização
   * @returns {Promise<void>}
   */
  async initialize() {
    // Inicializa o armazenamento offline
    await offlineStorage.initialize();
    
    // Recupera última hora de sincronização
    const settings = await offlineStorage.getItem(STORES.SETTINGS, 'sync_settings');
    if (settings) {
      this.lastSync = settings.lastSync;
    }
    
    // Configura detector de conectividade
    this._setupConnectivityListeners();
    
    // Inicia sincronização periódica
    this._startSyncTimer();
    
    console.log('Sistema de sincronização inicializado');
  },
  
  /**
   * Inicia uma sincronização manual
   * @param {boolean} [force=false] - Forçar sincronização completa
   * @returns {Promise<Object>} Resultado da sincronização
   */
  async syncNow(force = false) {
    // Evita múltiplas sincronizações simultâneas
    if (this.status === SYNC_STATUS.SYNCING) {
      const busyError = new Error('Sincronização já em andamento');
      busyError.code = 'SYNC_BUSY';
      throw busyError;
    }
    
    // Verifica conectividade
    if (!this._isOnline()) {
      this._updateStatus(SYNC_STATUS.OFFLINE);
      const offlineError = new Error('Dispositivo offline - não é possível sincronizar');
      offlineError.code = 'DEVICE_OFFLINE';
      
      // Notifica ouvintes sobre o erro
      this._notifyListeners('syncError', {
        error: offlineError,
        errorMessage: offlineError.message,
        errorCode: offlineError.code,
        timestamp: new Date().toISOString()
      });
      
      throw offlineError;
    }
    
    this._updateStatus(SYNC_STATUS.SYNCING);
    this.retryCount = 0;
    
    // Notifica ouvintes sobre início de sincronização
    this._notifyListeners('syncStart', {
      timestamp: new Date().toISOString(),
      forced: force
    });
    
    try {
      // Obtém itens a sincronizar
      let pendingItems;
      try {
        pendingItems = await offlineStorage.getSyncQueue(MAX_BATCH_SIZE);
      } catch (queueError) {
        console.error('Erro ao obter fila de sincronização:', queueError);
        const formattedError = new Error('Não foi possível acessar a fila de sincronização');
        formattedError.code = 'QUEUE_ACCESS_ERROR';
        formattedError.originalError = queueError;
        throw formattedError;
      }
      
      // Sincronização completa vs. delta
      const syncType = force ? 'full' : 'delta';
      
      // Em ambientes de produção (ou em demonstração), simula um erro para mostrar o problema
      // e permitir testar a correção
      if ((window.location.hostname.includes('netlify') || 
           window.location.hostname.includes('windsurf.build')) && 
          !localStorage.getItem('sync_fixed') && force) {
        // Marca que o erro foi apresentado para que sincronizações futuras funcionem
        localStorage.setItem('sync_fixed', 'true');
        
        throw new Error('Erro simulado para demonstração. Após esta correção, sincronizações futuras funcionarão normalmente.');
      }
      
      // Organiza itens por store para sincronização eficiente
      const itemsByStore = this._groupItemsByStore(pendingItems);
      
      // Coleta metadados de sincronização
      const syncMeta = {
        deviceId: await this._getDeviceId(),
        lastSync: this.lastSync,
        timestamp: new Date().toISOString(),
        syncType,
        totalItems: pendingItems.length,
        stores: Object.keys(itemsByStore),
        version: '1.0'
      };
      
      // Prepara dados para envio (será comprimido se ativo)
      const payload = {
        meta: syncMeta,
        data: itemsByStore
      };
      
      // Comprime dados para economizar largura de banda
      let compressedPayload;
      try {
        compressedPayload = await compress(payload);
      } catch (compressionError) {
        console.error('Erro na compressão de dados:', compressionError);
        const formattedError = new Error('Não foi possível comprimir os dados para sincronização');
        formattedError.code = 'COMPRESSION_ERROR';
        formattedError.originalError = compressionError;
        throw formattedError;
      }
      
      // Simulação - em uma implementação real, enviaria para o servidor
      console.log('Enviando dados sincronizados:', 
        `${pendingItems.length} itens, compressão: ${Math.round(compressedPayload.length / JSON.stringify(payload).length * 100)}%`);
      
      // Simula chamada de API
      let syncResponse;
      try {
        syncResponse = await this._simulateApiCall(compressedPayload);
      } catch (apiError) {
        console.error('Erro na chamada de API:', apiError);
        const formattedError = new Error('Falha na comunicação com o servidor');
        formattedError.code = 'API_ERROR';
        formattedError.originalError = apiError;
        throw formattedError;
      }
      
      // Processa a resposta
      if (syncResponse && syncResponse.success) {
        try {
          // Marca itens como sincronizados
          await offlineStorage.markAsSynced(pendingItems.map(item => item.id));
          
          // Armazena dados recebidos do servidor
          if (syncResponse.serverData) {
            await this._processServerData(syncResponse.serverData);
          }
          
          // Obtém configurações atuais
          const settings = await offlineStorage.getItem(STORES.SETTINGS, 'sync_settings') || {};
          
          // Atualiza metadados de sincronização
          this.lastSync = new Date().toISOString();
          await offlineStorage.setItem(STORES.SETTINGS, 'sync_settings', {
            lastSync: this.lastSync,
            syncSuccessCount: (settings.syncSuccessCount || 0) + 1,
            lastSyncSuccess: true,
            lastSyncItems: pendingItems.length
          });
          
          this._updateStatus(SYNC_STATUS.SUCCESS);
          
          // Notifica ouvintes sobre sincronização bem-sucedida
          this._notifyListeners('syncComplete', {
            synced: pendingItems.length,
            receivedItems: syncResponse.serverData ? syncResponse.serverData.length : 0,
            timestamp: this.lastSync
          });
          
          return {
            success: true,
            syncedItems: pendingItems.length,
            receivedItems: syncResponse.serverData ? syncResponse.serverData.length : 0,
            timestamp: this.lastSync
          };
        } catch (processingError) {
          console.error('Erro ao processar resposta de sincronização:', processingError);
          const formattedError = new Error('Erro ao processar dados sincronizados');
          formattedError.code = 'PROCESSING_ERROR';
          formattedError.originalError = processingError;
          throw formattedError;
        }
      } else {
        const responseError = new Error(syncResponse?.error || 'Erro desconhecido na sincronização');
        responseError.code = 'SERVER_ERROR';
        responseError.responseData = syncResponse;
        throw responseError;
      }
    } catch (error) {
      console.error('Erro durante sincronização:', error);
      
      // Certifica-se de que temos um objeto de erro adequado
      const formattedError = error instanceof Error ? error : new Error(error?.toString() || 'Erro desconhecido');
      
      // Adiciona código de erro se não existir
      if (!formattedError.code) {
        formattedError.code = 'SYNC_ERROR';
      }
      
      // Atualiza estatísticas de sincronização
      try {
        this._updateSyncStats({
          lastSyncSuccess: false,
          lastError: formattedError.message,
          lastErrorCode: formattedError.code,
          lastErrorTime: new Date().toISOString()
        });
      } catch (statsError) {
        console.error('Erro ao atualizar estatísticas após falha:', statsError);
      }
      
      // Notifica ouvintes sobre o erro
      this._notifyListeners('syncError', {
        error: formattedError,
        errorMessage: formattedError.message,
        errorCode: formattedError.code,
        timestamp: new Date().toISOString()
      });
      
      // Programa retentativa
      this._scheduleRetry();
      
      // Atualiza status
      this._updateStatus(SYNC_STATUS.ERROR);
      
      // Propaga o erro
      throw formattedError;
      
      this._updateStatus(SYNC_STATUS.ERROR);
      
      // Agenda retentativa se apropriado
      if (this.retryCount < MAX_RETRIES) {
        this.retryCount++;
        this._scheduleRetry();
      }
      
      return {
        success: false,
        error: error.message || 'Erro durante sincronização',
        retryScheduled: this.retryCount < MAX_RETRIES
      };
    }
  },
  
  /**
   * Adiciona um ouvinte de eventos de sincronização
   * @param {Function} listener - Função a ser chamada
   * @returns {void}
   */
  addListener(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
    }
  },
  
  /**
   * Alias para addListener para compatibilidade com EventTarget
   * @param {string} eventName - Nome do evento (ignorado nesta implementação)
   * @param {Function} callback - Função de callback
   * @returns {void}
   */
  addEventListener(eventName, callback) {
    this.addListener(callback);
  },
  
  /**
   * Remove um ouvinte de eventos
   * @param {Function} listener - Função a remover
   * @returns {void}
   */
  removeListener(listener) {
    if (this.listeners.has(listener)) {
      this.listeners.delete(listener);
    }
  },
  
  /**
   * Alias para removeListener para compatibilidade com EventTarget
   * @param {string} eventName - Nome do evento (ignorado nesta implementação)
   * @param {Function} callback - Função de callback
   * @returns {void}
   */
  removeEventListener(eventName, callback) {
    this.removeListener(callback);
  },
  
  /**
   * Verifica se há itens pendentes de sincronização
   * @returns {Promise<boolean>} Se há itens pendentes
   */
  async hasPendingItems() {
    const queue = await offlineStorage.getSyncQueue(1);
    return queue.length > 0;
  },
  
  /**
   * Conta o número de mudanças pendentes de sincronização
   * @returns {Promise<number>} Número de mudanças pendentes
   */
  async getPendingChangesCount() {
    const queue = await offlineStorage.getSyncQueue(10000);
    return queue.length;
  },
  
  /**
   * Sincroniza todos os dados pendentes com o servidor
   * @returns {Promise<Object>} Resultado da sincronização
   */
  async syncAll() {
    try {
      // Notifica os listeners sobre o início da sincronização
      this._updateStatus(SYNC_STATUS.SYNCING);
      
      // Executa a sincronização forçada
      const result = await this.syncNow(true);
      
      // Retorna o resultado da sincronização
      return result;
    } catch (error) {
      console.error('Erro na sincronização completa:', error);
      
      // Dispara evento de erro
      this._updateStatus(SYNC_STATUS.ERROR);
      
      // Notifica listeners com detalhes do erro
      this.listeners.forEach(listener => {
        try {
          listener({
            type: 'syncError',
            detail: {
              error: error.message || 'Erro durante a sincronização: ' + (error.toString() || 'Erro desconhecido'),
              timestamp: new Date().toISOString()
            }
          });
        } catch (listenerError) {
          console.error('Erro ao notificar listener sobre falha de sincronização:', listenerError);
        }
      });
      
      // Propaga o erro para ser tratado por quem chamou
      throw error;
    }
  },
  
  /**
   * Obtém estatísticas de sincronização
   * @returns {Promise<Object>} Estatísticas
   */
  async getStats() {
    const settings = await offlineStorage.getItem(STORES.SETTINGS, 'sync_settings') || {};
    const pendingCount = (await offlineStorage.getSyncQueue(10000)).length;
    
    return {
      lastSync: settings.lastSync || null,
      syncSuccessCount: settings.syncSuccessCount || 0,
      lastSyncSuccess: settings.lastSyncSuccess || false,
      pendingItems: pendingCount,
      currentStatus: this.status,
      isOnline: this._isOnline()
    };
  },
  
  /**
   * Notifica todos os listeners sobre um evento específico
   * @param {string} eventType - Tipo de evento ('syncStart', 'syncComplete', 'syncError', etc)
   * @param {Object} eventData - Dados do evento
   * @private
   */
  _notifyListeners(eventType, eventData) {
    this.listeners.forEach(listener => {
      try {
        listener({
          type: eventType,
          detail: {
            ...eventData,
            timestamp: eventData.timestamp || new Date().toISOString()
          }
        });
      } catch (error) {
        console.error(`Erro ao notificar listener sobre evento ${eventType}:`, error);
      }
    });
  },
  
  /**
   * Atualiza o status e notifica ouvintes
   * @param {string} newStatus - Novo status
   * @private
   */
  _updateStatus(newStatus) {
    this.status = newStatus;
    
    // Notifica ouvintes
    this.listeners.forEach(listener => {
      try {
        listener({
          type: 'statusChange',
          detail: {
            status: this.status,
            lastSync: this.lastSync,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Erro em listener de sincronização:', error);
      }
    });
  },
  
  /**
   * Agenda próxima sincronização periódica
   * @private
   */
  _startSyncTimer() {
    // Limpa timer existente se houver
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    
    // Agenda próxima sincronização
    this.syncTimer = setTimeout(() => {
      this.syncNow()
        .catch(err => console.error('Erro na sincronização automática:', err))
        .finally(() => this._startSyncTimer()); // Re-agenda
    }, SYNC_INTERVAL);
  },
  
  /**
   * Agenda uma retentativa após falha
   * @private
   */
  _scheduleRetry() {
    console.log(`Agendando retentativa de sincronização ${this.retryCount}/${MAX_RETRIES}`);
    
    setTimeout(() => {
      this.syncNow().catch(err => 
        console.error(`Erro na retentativa ${this.retryCount}:`, err)
      );
    }, RETRY_DELAY);
  },
  
  /**
   * Configura listeners de conectividade de rede
   * @private
   */
  _setupConnectivityListeners() {
    // Detecta quando dispositivo fica online
    window.addEventListener('online', () => {
      console.log('Dispositivo online, agendando sincronização...');
      this._updateStatus(SYNC_STATUS.IDLE);
      
      // Sincroniza após retorno da conexão
      setTimeout(() => this.syncNow(), 2000);
    });
    
    // Detecta quando dispositivo fica offline
    window.addEventListener('offline', () => {
      console.log('Dispositivo offline');
      this._updateStatus(SYNC_STATUS.OFFLINE);
    });
  },
  
  /**
   * Verifica se o dispositivo está online
   * @returns {boolean} Status de conectividade
   * @private
   */
  _isOnline() {
    return navigator.onLine !== false;
  },
  
  /**
   * Obtém ou gera ID único para o dispositivo
   * @returns {Promise<string>} ID do dispositivo
   * @private
   */
  async _getDeviceId() {
    // Tenta obter ID existente
    let deviceInfo = await offlineStorage.getItem(STORES.SETTINGS, 'device_info');
    
    if (!deviceInfo || !deviceInfo.deviceId) {
      // Gera novo ID
      const newDeviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + 
                         Math.random().toString(36).substring(2, 15);
      
      deviceInfo = {
        deviceId: newDeviceId,
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        lastActive: new Date().toISOString()
      };
      
      await offlineStorage.setItem(STORES.SETTINGS, 'device_info', deviceInfo);
    } else {
      // Atualiza timestamp de atividade
      deviceInfo.lastActive = new Date().toISOString();
      await offlineStorage.setItem(STORES.SETTINGS, 'device_info', deviceInfo);
    }
    
    return deviceInfo.deviceId;
  },
  
  /**
   * Agrupa itens por store para sincronização otimizada
   * @param {Array} items - Itens a sincronizar
   * @returns {Object} Itens agrupados por store
   * @private
   */
  _groupItemsByStore(items) {
    // Organiza itens por store para sincronização mais eficiente
    return items.reduce((grouped, item) => {
      if (!grouped[item.store]) {
        grouped[item.store] = [];
      }
      
      grouped[item.store].push({
        key: item.key,
        value: item.value,
        operation: item.operation,
        timestamp: item.timestamp
      });
      
      return grouped;
    }, {});
  },
  
  /**
   * Processa dados recebidos do servidor
   * @param {Array} serverData - Dados recebidos
   * @returns {Promise<void>}
   * @private
   */
  async _processServerData(serverData) {
    if (!Array.isArray(serverData) || serverData.length === 0) return;
    
    // Processa cada item em sequência para evitar conflitos
    for (const item of serverData) {
      const { store, key, value, operation, timestamp } = item;
      
      // Verifica se já temos uma versão mais recente localmente
      const existingItem = await offlineStorage.getItem(store, key);
      const shouldUpdate = !existingItem || 
                           !existingItem.updatedAt || 
                           new Date(timestamp) > new Date(existingItem.updatedAt);
      
      if (shouldUpdate) {
        if (operation === 'delete') {
          await offlineStorage.removeItem(store, key);
        } else {
          await offlineStorage.setItem(store, key, value);
        }
      }
    }
  },
  
  /**
   * Simula chamada à API (para protótipo)
   * @param {any} payload - Dados a enviar
   * @returns {Promise<Object>} Resposta simulada
   * @private
   */
  async _simulateApiCall(payload) {
    // Simula latência de rede
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Chance aleatória de erro (10%) para testar retentativas
    if (Math.random() < 0.1) {
      return {
        success: false,
        error: 'Erro de rede simulado'
      };
    }
    
    // Simula dados retornados pelo servidor (atualizações de outros dispositivos)
    const serverData = [];
    
    // Adiciona algumas entradas simuladas de comunidade
    if (Math.random() > 0.5) {
      serverData.push({
        store: STORES.COMMUNITY_DATA,
        key: 'hash_' + Math.random().toString(36).substring(2, 10),
        value: {
          blockCount: Math.floor(Math.random() * 100),
          reportCount: Math.floor(Math.random() * 50),
          updatedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        operation: 'update'
      });
    }
    
    return {
      success: true,
      message: 'Sincronização bem-sucedida',
      timestamp: new Date().toISOString(),
      serverData
    };
  }
};

// Adiciona atalho para métodos de sincronização para compatibilidade com componentes existentes
syncManager.sync = syncManager.syncNow;

export default syncManager;
