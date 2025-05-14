/**
 * Sistema de Armazenamento Offline Avançado para o Quero Paz
 * 
 * Este módulo implementa um sistema de armazenamento baseado em IndexedDB
 * com suporte a sincronização eficiente, compressão e fallback.
 * 
 * Atualizado para garantir compatibilidade com outros módulos e eliminar erros de recursividade.
 */

// Configuração do banco de dados
const DB_NAME = 'quero_paz_db';
const DB_VERSION = 6; // Versão aumentada significativamente para forçar atualização
const STORES = {
  SETTINGS: 'settings',
  CALLS: 'calls',
  REPUTATION: 'reputation',
  COMMUNITY_DATA: 'community_data',
  SYNC_QUEUE: 'sync_queue',
  PROFILES: 'profiles',
  RULES: 'rules',
  TEST: 'test', // Adicionado para testes
  STATISTICS: 'statistics', // Adicionado para estatísticas
  SYNC: 'sync' // Adicionado para dados de sincronização
};

// Função para excluir completamente o banco de dados
const deleteDatabase = () => {
  return new Promise((resolve, reject) => {
    console.log('Tentando excluir o banco de dados antigo...');
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    
    deleteRequest.onsuccess = () => {
      console.log('Banco de dados excluído com sucesso');
      resolve(true);
    };
    
    deleteRequest.onerror = (error) => {
      console.warn('Erro ao excluir banco de dados:', error);
      resolve(false); // Resolve mesmo com erro para continuar o fluxo
    };
    
    deleteRequest.onblocked = () => {
      console.warn('Exclusão do banco de dados bloqueada. Feche todas as outras abas.');
      resolve(false);
    };
  });
};

// Cache para acesso rápido
const memoryCache = new Map();

/**
 * Serviço de armazenamento offline
 */
const offlineStorage = {
  /**
   * Inicializa o sistema de armazenamento com recuperação robusta
   * @returns {Promise<IDBDatabase>} Instância do banco de dados
   */
  /**
   * Flag indicando se o armazenamento está inicializado
   */
  _initialized: false,
  
  /**
   * Flag indicando se o banco de dados está pronto
   */
  _isDBReady: false,
  
  /**
   * Inicializa o sistema de armazenamento com recuperação robusta
   * @returns {Promise<IDBDatabase>} Instância do banco de dados
   */
  async initialize() {
    // Resetar estado para inicialização
    this._initialized = false;
    this._isDBReady = false;
    
    try {
      console.log('Iniciando inicialização do OfflineStorage...');
      
      // Primeiro, tenta excluir o banco de dados antigo para evitar problemas com stores faltantes
      const forceReset = localStorage.getItem('force_db_reset');
      
      if (!forceReset) {
        console.log('Iniciando exclusão do banco de dados para nova versão...');
        await deleteDatabase();
        localStorage.setItem('force_db_reset', 'true');
      }
      
      // Agora abre o banco de dados com a nova versão
      this.db = await this._openDatabase();
      console.log('IndexedDB inicializado com sucesso com versão', DB_VERSION);
      
      // Verifica se todos os stores necessários existem
      const allStoresExist = this._verifyAllStoresExist();
      if (!allStoresExist) {
        console.warn('Alguns stores não foram encontrados. Recriando banco de dados...');
        await this._recreateDatabase();
        this.db = await this._openDatabase();
      }
      
      // Carrega dados críticos no cache
      await this._loadCriticalDataToCache();
      
      // Tudo pronto
      this._isDBReady = true;
      this._initialized = true;
      console.log('OfflineStorage inicializado com sucesso. Banco pronto:', this._isDBReady);
      console.log('Stores disponíveis:', Array.from(this.db.objectStoreNames).join(', '));
      
      // Marque no localStorage que o DB foi inicializado corretamente
      localStorage.setItem('db_initialized', 'true');
      
      return this.db;
    } catch (error) {
      console.error('Erro ao inicializar OfflineStorage:', error);
      this._initialized = false;
      this._isDBReady = false;
      // Configura armazenamento de fallback
      this._setupFallbackStorage();
      localStorage.setItem('db_initialized', 'false');
      console.log('Configurado armazenamento de fallback devido a falha no IndexedDB');
    }
  },
  
  /**
   * Verifica se todos os stores necessários existem no banco
   * @returns {boolean}
   * @private
   */
  _verifyAllStoresExist() {
    try {
      if (!this.db) return false;
      
      const requiredStores = [
        STORES.SETTINGS,
        STORES.CALLS,
        STORES.REPUTATION,
        STORES.COMMUNITY_DATA,
        STORES.SYNC_QUEUE,
        STORES.PROFILES,
        STORES.RULES,
        STORES.TEST,
        STORES.STATISTICS,
        STORES.SYNC
      ];
      
      const missingStores = requiredStores.filter(store => 
        !this.db.objectStoreNames.contains(store)
      );
      
      if (missingStores.length > 0) {
        console.warn('Stores faltando:', missingStores.join(', '));
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao verificar stores:', error);
      return false;
    }
  },
  
  /**
   * Força a recriação do banco de dados por completo
   * @returns {Promise<boolean>}
   * @private
   */
  async _recreateDatabase() {
    try {
      console.log('Recriando banco de dados por completo...');
      
      // Fecha conexão para evitar bloqueio
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      
      // Exclui o banco
      await deleteDatabase();
      
      // Limpa a flag
      localStorage.removeItem('force_db_reset');
      
      console.log('Banco de dados foi excluído e será recriado na próxima inicialização');
      return true;
    } catch (error) {
      console.error('Erro ao recriar banco de dados:', error);
      return false;
    }
  },
  
  /**
   * Obtém um item do armazenamento
   * @param {string} storeName - Nome do store
   * @param {string|number} key - Chave do item
   * @returns {Promise<any>} Valor armazenado
   */
  async getItem(storeName, key) {
    // Verifica se está no cache
    const cacheKey = `${storeName}:${key}`;
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey);
    }
    
    try {
      // Primeiro tenta IndexedDB
      if (this.db) {
        const transaction = this.db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const result = await this._promisifyRequest(store.get(key));
        
        // Adiciona ao cache para acesso rápido futuro
        if (result !== undefined) {
          memoryCache.set(cacheKey, result);
        }
        
        return result;
      }
      
      // Fallback para localStorage
      if (this.fallbackStorage) {
        return this.fallbackStorage.getItem(cacheKey);
      }
      
      return null;
    } catch (error) {
      console.error(`Erro ao obter item ${key} do store ${storeName}:`, error);
      
      // Tenta fallback
      if (this.fallbackStorage) {
        return this.fallbackStorage.getItem(cacheKey);
      }
      
      return null;
    }
  },
  
  /**
   * Armazena um item
   * @param {string} storeName - Nome do store
   * @param {string|number} key - Chave do item
   * @param {any} value - Valor a armazenar
   * @returns {Promise<void>}
   */
  async setItem(storeName, key, value) {
    try {
      // Adiciona ao cache
      memoryCache.set(`${storeName}:${key}`, value);
      
      // Se o banco não estiver disponível, usa fallback
      if (!this.db) {
        localStorage.setItem(`${storeName}:${key}`, JSON.stringify(value));
        return;
      }
      
      // Armazena no IndexedDB
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // Verificar se o store usa keyPath
      const hasKeyPath = store.keyPath !== null;
      
      // Utilizamos Promise para lidar com eventos de transação
      await new Promise((resolve, reject) => {
        let request;
        
        if (hasKeyPath) {
          // Se o store tem keyPath, precisamos incluir a chave no objeto
          const keyName = store.keyPath;
          // Clonar o valor para não modificar o original se for um objeto
          const valueWithKey = typeof value === 'object' && value !== null ? 
            { ...value, [keyName]: key } : 
            { [keyName]: key, data: value };
          
          // Usar put sem o segundo parâmetro de chave
          request = store.put(valueWithKey);
        } else {
          // Store sem keyPath - usar o método normal com chave externa
          request = store.put(value, key);
        }
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e.target.error);
      });
      
      // Se for um store sincronizável, adiciona à fila de sincronização
      if (this._isSyncableStore(storeName)) {
        await this._addToSyncQueue(storeName, key, value);
      }
    } catch (error) {
      console.error(`Erro ao armazenar item ${key} no store ${storeName}:`, error);
      // Tenta o fallback para localStorage como último recurso
      try {
        localStorage.setItem(`${storeName}:${key}`, JSON.stringify(value));
      } catch (e) {
        console.error('Falha no fallback para localStorage:', e);
        throw error;
      }
    }
  },
  
  /**
   * Remove um item do armazenamento
   * @param {string} storeName - Nome do store
   * @param {string|number} key - Chave do item
   * @returns {Promise<void>}
   */
  async removeItem(storeName, key) {
    // Remove do cache
    const cacheKey = `${storeName}:${key}`;
    memoryCache.delete(cacheKey);
    
    try {
      // Primeiro tenta IndexedDB
      if (this.db) {
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        await this._promisifyRequest(store.delete(key));
        
        // Adiciona operação de exclusão à fila de sincronização
        if (this._isSyncableStore(storeName)) {
          await this._addToSyncQueue(storeName, key, null, 'delete');
        }
        
        return;
      }
      
      // Fallback para localStorage
      if (this.fallbackStorage) {
        this.fallbackStorage.removeItem(cacheKey);
        return;
      }
    } catch (error) {
      console.error(`Erro ao remover item ${key} do store ${storeName}:`, error);
      
      // Tenta fallback
      if (this.fallbackStorage) {
        this.fallbackStorage.removeItem(cacheKey);
      }
    }
  },
  
  /**
   * Obtém todos os itens de um store
   * @param {string} storeName - Nome do store
   * @returns {Promise<Array>} Array de itens
   */
  async getAllItems(storeName) {
    try {
      // Primeiro tenta IndexedDB
      if (this.db) {
        const transaction = this.db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const result = await this._promisifyRequest(store.getAll());
        return result || [];
      }
      
      // Fallback para localStorage
      if (this.fallbackStorage) {
        return this.fallbackStorage.getAllItems(storeName);
      }
      
      return [];
    } catch (error) {
      console.error(`Erro ao obter todos os itens do store ${storeName}:`, error);
      
      // Tenta fallback
      if (this.fallbackStorage) {
        return this.fallbackStorage.getAllItems(storeName);
      }
      
      return [];
    }
  },
  
  /**
   * Limpa o cache em memória
   * @param {string} [storeName] - Nome do store (opcional, limpa todos se não especificado)
   * @returns {void}
   */
  clearCache(storeName) {
    if (storeName) {
      // Limpa apenas o cache do store especificado
      const prefix = `${storeName}:`;
      for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          memoryCache.delete(key);
        }
      }
    } else {
      // Limpa todo o cache
      memoryCache.clear();
    }
  },
  
  /**
   * Limpa um store inteiro
   * @param {string} storeName - Nome do store
   * @returns {Promise<void>}
   */
  async clearStore(storeName) {
    // Limpa o cache
    this.clearCache(storeName);
    
    try {
      // Primeiro tenta IndexedDB
      if (this.db) {
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        await this._promisifyRequest(store.clear());
        
        // Adiciona operação de limpeza à fila de sincronização
        if (this._isSyncableStore(storeName)) {
          await this._addToSyncQueue(storeName, null, null, 'clear');
        }
        
        return;
      }
      
      // Fallback para localStorage
      if (this.fallbackStorage) {
        this.fallbackStorage.clearStore(storeName);
        return;
      }
    } catch (error) {
      console.error(`Erro ao limpar store ${storeName}:`, error);
      
      // Tenta fallback
      if (this.fallbackStorage) {
        this.fallbackStorage.clearStore(storeName);
      }
    }
  },
  
  /**
   * Adiciona à fila de sincronização
   * @param {string} storeName - Nome do store
   * @param {string|number} key - Chave do item
   * @param {any} value - Valor a sincronizar
   * @param {string} [operation='update'] - Tipo de operação
   * @returns {Promise<void>}
   * @private
   */
  async _addToSyncQueue(storeName, key, value, operation = 'update') {
    try {
      const syncItem = {
        id: `${storeName}:${key}:${Date.now()}`,
        store: storeName,
        key,
        value,
        operation,
        timestamp: new Date().toISOString(),
        attempts: 0,
        synced: false
      };
      
      const transaction = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      await this._promisifyRequest(store.add(syncItem));
    } catch (error) {
      console.error('Erro ao adicionar à fila de sincronização:', error);
    }
  },
  
  /**
   * Obtém fila de sincronização pendente
   * @param {number} [limit=100] - Limite de itens
   * @returns {Promise<Array>} Itens não sincronizados
   */
  async getSyncQueue(limit = 100) {
    try {
      if (!this.db) return [];
      
      const transaction = this.db.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const index = store.index('synced');
      const request = index.getAll(0, limit); // 0 = false (não sincronizado)
      
      return await this._promisifyRequest(request);
    } catch (error) {
      console.error('Erro ao obter fila de sincronização:', error);
      return [];
    }
  },
  
  /**
   * Marca itens como sincronizados
   * @param {Array<string>} ids - IDs dos itens sincronizados
   * @returns {Promise<void>}
   */
  async markAsSynced(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    
    try {
      const transaction = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      
      const promises = ids.map(async (id) => {
        const item = await this._promisifyRequest(store.get(id));
        if (item) {
          item.synced = true;
          item.syncedAt = new Date().toISOString();
          return this._promisifyRequest(store.put(item));
        }
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Erro ao marcar itens como sincronizados:', error);
    }
  },
  
  /**
   * Verifica se um store deve ser sincronizado
   * @param {string} storeName - Nome do store
   * @returns {boolean} Se o store deve ser sincronizado
   * @private
   */
  _isSyncableStore(storeName) {
    // Lista de stores que devem ser sincronizados com o servidor
    const syncableStores = [
      STORES.CALLS,
      STORES.REPUTATION,
      STORES.PROFILES,
      STORES.RULES
    ];
    
    return syncableStores.includes(storeName);
  },
  
  /**
   * Pré-carrega dados críticos no cache
   * @returns {Promise<void>}
   * @private
   */
  async _loadCriticalDataToCache() {
    try {
      // Carrega configurações
      const settings = await this.getItem(STORES.SETTINGS, 'app_settings');
      if (settings) {
        memoryCache.set(`${STORES.SETTINGS}:app_settings`, settings);
      }
      
      // Carrega perfis ativos
      const activeProfiles = await this._getActiveProfiles();
      if (activeProfiles && activeProfiles.length > 0) {
        for (const profile of activeProfiles) {
          memoryCache.set(`${STORES.PROFILES}:${profile.id}`, profile);
        }
      }
      
      // Carrega regras ativas
      const activeRules = await this._getActiveRules();
      if (activeRules && activeRules.length > 0) {
        for (const rule of activeRules) {
          memoryCache.set(`${STORES.RULES}:${rule.id}`, rule);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados críticos para o cache:', error);
    }
  },
  
  /**
   * Obtém perfis ativos
   * @returns {Promise<Array>} Perfis ativos
   * @private
   */
  async _getActiveProfiles() {
    try {
      if (!this.db) return [];
      
      const transaction = this.db.transaction(STORES.PROFILES, 'readonly');
      const store = transaction.objectStore(STORES.PROFILES);
      const index = store.index('status');
      const request = index.getAll('active');
      
      return await this._promisifyRequest(request);
    } catch (error) {
      console.error('Erro ao obter perfis ativos:', error);
      return [];
    }
  },
  
  /**
   * Obtém regras ativas
   * @returns {Promise<Array>} Regras ativas
   * @private
   */
  async _getActiveRules() {
    try {
      if (!this.db) return [];
      
      const transaction = this.db.transaction(STORES.RULES, 'readonly');
      const store = transaction.objectStore(STORES.RULES);
      const index = store.index('status');
      const request = index.getAll('active');
      
      return await this._promisifyRequest(request);
    } catch (error) {
      console.error('Erro ao obter regras ativas:', error);
      return [];
    }
  },
  
  /**
   * Abre o banco de dados IndexedDB
   * @returns {Promise<IDBDatabase>} Instância do banco de dados
   * @private
   */
  async _openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB não suportado neste navegador'));
        return;
      }
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        console.error('Erro ao abrir IndexedDB:', event.target.error);
        reject(new Error('Erro ao abrir IndexedDB: ' + event.target.error));
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        console.log('IndexedDB aberto com sucesso. Versão:', db.version);
        console.log('Stores disponíveis:', Array.from(db.objectStoreNames).join(', '));
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        console.log('Atualizando estrutura do banco de dados para versão', DB_VERSION);
        const db = event.target.result;
        
        // Cria todos os stores necessários
        const createStore = (storeName, keyPath = null, indexes = []) => {
          try {
            if (db.objectStoreNames.contains(storeName)) {
              console.log(`Store ${storeName} já existe. Pulando criação.`);
              return db.transaction(storeName).objectStore(storeName);
            }
            
            console.log(`Criando store ${storeName}...`);
            const store = keyPath 
              ? db.createObjectStore(storeName, { keyPath }) 
              : db.createObjectStore(storeName);
            
            // Cria índices
            indexes.forEach(({ name, path, options }) => {
              store.createIndex(name, path, options || { unique: false });
            });
            
            return store;
          } catch (error) {
            console.error(`Erro ao criar store ${storeName}:`, error);
            throw error;
          }
        };
        
        // Settings store
        createStore(STORES.SETTINGS);
        
        // Calls store
        createStore(STORES.CALLS, 'id', [
          { name: 'timestamp', path: 'timestamp' },
          { name: 'phoneNumber', path: 'phoneNumber' },
          { name: 'status', path: 'status' }
        ]);
        
        // Reputation store
        createStore(STORES.REPUTATION, 'phoneNumber', [
          { name: 'category', path: 'category' },
          { name: 'score', path: 'score' }
        ]);
        
        // Community data store
        createStore(STORES.COMMUNITY_DATA, 'phoneHash', [
          { name: 'updatedAt', path: 'updatedAt' },
          { name: 'expiresAt', path: 'expiresAt' }
        ]);
        
        // Sync queue store
        createStore(STORES.SYNC_QUEUE, 'id', [
          { name: 'synced', path: 'synced' },
          { name: 'timestamp', path: 'timestamp' },
          { name: 'store', path: 'store' }
        ]);
        
        // Profiles store
        createStore(STORES.PROFILES, 'id', [
          { name: 'status', path: 'status' },
          { name: 'type', path: 'type' }
        ]);
        
        // Rules store
        createStore(STORES.RULES, 'id', [
          { name: 'status', path: 'status' },
          { name: 'type', path: 'type' }
        ]);
        
        // Test store (para testes do sistema)
        createStore(STORES.TEST, 'id');
        
        // Statistics store
        createStore(STORES.STATISTICS, 'id');
        
        // Sync store
        createStore(STORES.SYNC, 'id');
        
        console.log('Atualização da estrutura do banco de dados concluída.');
      };
    });
  },
  
  /**
   * Converte um IndexedDB request em uma Promise
   * @param {IDBRequest} request - Requisição IndexedDB
   * @returns {Promise<any>} Resultado da requisição
   * @private
   */
  _promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * Configura armazenamento de fallback usando localStorage
   * @private
   */
  _setupFallbackStorage() {
    console.warn('Usando fallback para localStorage');
    
    // Implementa interface compatível
    this.fallbackStorage = {
      getItem(key) {
        try {
          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : null;
        } catch (e) {
          console.error('Erro ao ler do localStorage:', e);
          return null;
        }
      },
      
      setItem(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
          console.error('Erro ao escrever no localStorage:', e);
        }
      },
      
      removeItem(key) {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.error('Erro ao remover do localStorage:', e);
        }
      },
      
      getAllItems(storeName) {
        try {
          const items = [];
          const prefix = `${storeName}:`;
          
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(prefix)) {
              items.push(this.getItem(key));
            }
          }
          
          return items;
        } catch (e) {
          console.error('Erro ao ler todos os itens do localStorage:', e);
          return [];
        }
      },
      
      clearStore(storeName) {
        try {
          const prefix = `${storeName}:`;
          const keysToRemove = [];
          
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(prefix)) {
              keysToRemove.push(key);
            }
          }
          
          keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (e) {
          console.error('Erro ao limpar store no localStorage:', e);
        }
      }
    };
  }
};

export { STORES };
export default offlineStorage;

// Métodos diretos para compatibilidade com outros módulos
offlineStorage.getItemDirect = async function(key) {
  try {
    // Extrair storeName do key se o formato for 'store:key'
    let storeName = STORES.SETTINGS; // Padrão para keys simples
    let storeKey = key;
    
    if (key.includes(':')) {
      const parts = key.split(':');
      storeName = parts[0];
      storeKey = parts.slice(1).join(':');
    }
    
    // Obter o item usando o método existente
    return await this.getItem(storeName, storeKey);
  } catch (error) {
    console.error(`Erro ao obter item ${key} diretamente:`, error);
    return null;
  }
};

// Salvamos a implementação original antes de sobrescrever
offlineStorage._originalGetItem = offlineStorage.getItem;

// Sobrescrever com implementação compatível
offlineStorage.getItem = function(storeNameOrKey, key) {
  // Se apenas um parâmetro for fornecido, usar método direto
  if (key === undefined) {
    return this.getItemDirect(storeNameOrKey);
  }
  // Caso contrário, usar método original
  return this._originalGetItem(storeNameOrKey, key);
};

offlineStorage.setItemDirect = async function(key, value) {
  try {
    // Extrair storeName do key se o formato for 'store:key'
    let storeName = STORES.SETTINGS; // Padrão para keys simples
    let storeKey = key;
    
    if (key.includes(':')) {
      const parts = key.split(':');
      storeName = parts[0];
      storeKey = parts.slice(1).join(':');
    }
    
    // Armazenar o item usando o método existente
    await this.setItem(storeName, storeKey, value);
    return true;
  } catch (error) {
    console.error(`Erro ao armazenar item ${key} diretamente:`, error);
    // Se falhar, tentar armazenar no fallback
    if (this.fallbackStorage) {
      this.fallbackStorage.setItem(key, value);
      return true;
    }
    return false;
  }
};

// Salvamos a implementação original antes de sobrescrever
offlineStorage._originalSetItem = offlineStorage.setItem;

// Sobrescrever com implementação compatível
offlineStorage.setItem = function(storeNameOrKey, keyOrValue, value) {
  // Se apenas dois parâmetros forem fornecidos, usar método direto
  if (value === undefined) {
    return this.setItemDirect(storeNameOrKey, keyOrValue);
  }
  // Caso contrário, usar método original
  return this._originalSetItem(storeNameOrKey, keyOrValue, value);
};

// Faz a mesma coisa para removeItem
offlineStorage.removeItemDirect = async function(key) {
  try {
    let storeName = STORES.SETTINGS;
    let storeKey = key;
    
    if (key.includes(':')) {
      const parts = key.split(':');
      storeName = parts[0];
      storeKey = parts.slice(1).join(':');
    }
    
    // Usar a função original diretamente para evitar recursividade
    const transaction = this.db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    await this._promisifyRequest(store.delete(storeKey));
    
    // Remover do cache
    const cacheKey = `${storeName}:${storeKey}`;
    memoryCache.delete(cacheKey);
    
    return true;
  } catch (error) {
    console.error(`Erro ao remover item ${key} diretamente:`, error);
    // Se falhar, tentar remover do fallback
    if (this.fallbackStorage) {
      this.fallbackStorage.removeItem(key);
      return true;
    }
    return false;
  }
};

// Salvamos a implementação original antes de sobrescrever
offlineStorage._originalRemoveItem = offlineStorage.removeItem;

// Sobrescrever com implementação compatível
offlineStorage.removeItem = function(storeNameOrKey, key) {
  // Se apenas um parâmetro for fornecido, usar método direto
  if (key === undefined) {
    return this.removeItemDirect(storeNameOrKey);
  }
  // Caso contrário, usar método original
  return this._originalRemoveItem(storeNameOrKey, key);
};
