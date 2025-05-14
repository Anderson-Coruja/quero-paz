import localforage from 'localforage';
import api from './api';

// Configuração inicial do localforage
localforage.config({
  name: 'QueroPaz',
  storeName: 'app_data',
  description: 'Dados locais do aplicativo Quero Paz'
});

// Chaves para armazenamento
const KEYS = {
  BLOCKING_STATE: 'blocking_state',
  SILENCED_CALLS: 'silenced_calls',
  PENDING_CONFIRMATIONS: 'pending_confirmations',
  SETTINGS: 'settings'
};

// Dados iniciais
const DEFAULT_DATA = {
  blockingState: true,
  silencedCalls: [
    '11 3030-1122 - Ligação bloqueada às 09:12',
    '85 4002-8922 - Ligação silenciada às 10:03',
    '31 3201-7766 - Mensagem enviada, aguardando retorno',
    '+1 332-555-8899 - DDI bloqueado automaticamente'
  ],
  pendingConfirmations: [
    '31 3201-7766 - Aguardando retorno',
    '27 3030-1122 - Enviada mensagem',
    '+351 234-567-890 - Bloqueado internacional'
  ],
  settings: {
    blockInternational: true,
    prioritizeLocal: true,
    autoConfirm: false,
    soundOnBlock: false
  }
};

// Estado da conexão com a API
let isOnline = navigator.onLine;
let hasSyncPending = false;

// Ouvintes de evento para online/offline
window.addEventListener('online', () => { isOnline = true; syncWithServer(); });
window.addEventListener('offline', () => { isOnline = false; });

// Fila de sincronização para operações offline
const syncQueue = [];

/**
 * Sincroniza dados com o servidor quando volta a ficar online
 */
async function syncWithServer() {
  if (!isOnline || syncQueue.length === 0) return;
  
  hasSyncPending = true;
  
  try {
    console.log(`Sincronizando ${syncQueue.length} operações pendentes`);
    
    // Processa a fila de sincronização
    for (const operation of [...syncQueue]) {
      try {
        await processOperation(operation);
        // Remove da fila se for bem-sucedido
        const index = syncQueue.indexOf(operation);
        if (index > -1) syncQueue.splice(index, 1);
      } catch (error) {
        console.error(`Erro ao sincronizar operação:`, error);
        // Mantém na fila para tentar novamente depois
      }
    }
    
    // Salva a fila atualizada no armazenamento local
    await localforage.setItem('sync_queue', syncQueue);
    
    hasSyncPending = syncQueue.length > 0;
    
    if (syncQueue.length === 0) {
      console.log('Sincronização concluída com sucesso');
    } else {
      console.log(`Ainda há ${syncQueue.length} operações pendentes de sincronização`);
    }
  } catch (error) {
    console.error('Erro durante a sincronização:', error);
    hasSyncPending = true;
  }
}

/**
 * Processa uma operação da fila de sincronização
 */
async function processOperation(operation) {
  const { type, endpoint, method, data } = operation;
  
  switch (type) {
    case 'blocked_call':
      await api.addBlockedCall(data);
      break;
    case 'setting':
      await api.updateSettings(data);
      break;
    case 'pending_confirmation':
      await api.addPendingConfirmation(data);
      break;
    case 'remove_confirmation':
      await api.removePendingConfirmation(data.id);
      break;
    default:
      console.warn(`Tipo de operação desconhecido: ${type}`);
  }
}

/**
 * Adiciona uma operação à fila de sincronização
 */
async function addToSyncQueue(type, data) {
  syncQueue.push({ type, data, timestamp: new Date().toISOString() });
  await localforage.setItem('sync_queue', syncQueue);
  hasSyncPending = true;
  
  // Tenta sincronizar imediatamente se estiver online
  if (isOnline) {
    syncWithServer();
  }
}

// Funções de acesso ao armazenamento
const storage = {
  // Inicializa o storage com dados padrão se não existirem
  async initialize() {
    try {
      // Carrega a fila de sincronização do armazenamento local
      const savedQueue = await localforage.getItem('sync_queue');
      if (savedQueue) {
        syncQueue.push(...savedQueue);
        hasSyncPending = syncQueue.length > 0;
      }
      
      if (isOnline) {
        try {
          // Verifica a conexão com a API
          await api.checkHealth();
          
          // Carrega configurações do servidor
          const serverSettings = await api.getSettings();
          await localforage.setItem(KEYS.SETTINGS, serverSettings);
          
          // Carrega chamadas bloqueadas do servidor
          const blockedCalls = await api.getBlockedCalls();
          const formattedCalls = blockedCalls.map(call => 
            `${call.phone_number} - ${call.description || 'Ligação bloqueada'}`
          );
          await localforage.setItem(KEYS.SILENCED_CALLS, formattedCalls);
          
          // Carrega confirmações pendentes do servidor
          const pendingConfirmations = await api.getPendingConfirmations();
          const formattedConfirmations = pendingConfirmations.map(conf => 
            `${conf.phone_number} - ${conf.description || 'Aguardando confirmação'}`
          );
          await localforage.setItem(KEYS.PENDING_CONFIRMATIONS, formattedConfirmations);
          
          // Inicia a sincronização se houver operações pendentes
          if (hasSyncPending) {
            syncWithServer();
          }
          
          console.log('Dados carregados do servidor com sucesso');
          return true;
        } catch (error) {
          console.warn('Erro ao conectar com o servidor, usando dados locais:', error);
          // Continua com inicialização local em caso de falha
        }
      }
      
      // Inicialização com dados locais (offline ou falha na API)
      const blockingState = await localforage.getItem(KEYS.BLOCKING_STATE);
      if (blockingState === null) {
        await localforage.setItem(KEYS.BLOCKING_STATE, DEFAULT_DATA.blockingState);
      }

      const silencedCalls = await localforage.getItem(KEYS.SILENCED_CALLS);
      if (silencedCalls === null) {
        await localforage.setItem(KEYS.SILENCED_CALLS, DEFAULT_DATA.silencedCalls);
      }

      const pendingConfirmations = await localforage.getItem(KEYS.PENDING_CONFIRMATIONS);
      if (pendingConfirmations === null) {
        await localforage.setItem(KEYS.PENDING_CONFIRMATIONS, DEFAULT_DATA.pendingConfirmations);
      }

      const settings = await localforage.getItem(KEYS.SETTINGS);
      if (settings === null) {
        await localforage.setItem(KEYS.SETTINGS, DEFAULT_DATA.settings);
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao inicializar armazenamento:', error);
      return false;
    }
  },

  // Obtém o estado de bloqueio
  async getBlockingState() {
    try {
      if (isOnline) {
        // Tenta obter do servidor
        const settings = await api.getSettings();
        await localforage.setItem(KEYS.BLOCKING_STATE, settings.blockingState);
        return settings.blockingState;
      }
    } catch (error) {
      console.warn('Erro ao obter estado de bloqueio do servidor:', error);
    }
    
    // Fallback para armazenamento local
    return await localforage.getItem(KEYS.BLOCKING_STATE) || DEFAULT_DATA.blockingState;
  },

  // Define o estado de bloqueio
  async setBlockingState(state) {
    await localforage.setItem(KEYS.BLOCKING_STATE, state);
    
    if (isOnline) {
      try {
        // Atualiza no servidor
        const currentSettings = await this.getSettings();
        await api.updateSettings({ ...currentSettings, blockingState: state });
      } catch (error) {
        console.warn('Erro ao atualizar estado de bloqueio no servidor:', error);
        // Adiciona à fila de sincronização para tentar mais tarde
        await addToSyncQueue('setting', { blockingState: state });
      }
    } else {
      // Offline - adiciona à fila de sincronização
      await addToSyncQueue('setting', { blockingState: state });
    }
    
    return state;
  },

  // Obtém as chamadas silenciadas
  async getSilencedCalls() {
    try {
      if (isOnline) {
        // Tenta obter do servidor
        const blockedCalls = await api.getBlockedCalls();
        const formattedCalls = blockedCalls.map(call => 
          `${call.phone_number} - ${call.description || 'Ligação bloqueada'}`
        );
        await localforage.setItem(KEYS.SILENCED_CALLS, formattedCalls);
        return formattedCalls;
      }
    } catch (error) {
      console.warn('Erro ao obter chamadas bloqueadas do servidor:', error);
    }
    
    // Fallback para armazenamento local
    return await localforage.getItem(KEYS.SILENCED_CALLS) || [];
  },

  // Adiciona uma nova chamada silenciada
  async addSilencedCall(call) {
    // Formata os dados para a API
    const callParts = call.split(' - ');
    const phoneNumber = callParts[0];
    const description = callParts.length > 1 ? callParts[1] : '';
    const reason = description.includes('bloqueada') ? 'manual' : 
                  description.includes('silenciada') ? 'silenced' :
                  description.includes('DDI') ? 'international' : 'other';
    
    // Adiciona localmente primeiro
    const calls = await this.getSilencedCalls();
    calls.unshift(call); // Adiciona no início do array
    await localforage.setItem(KEYS.SILENCED_CALLS, calls);
    
    // Tenta salvar no servidor
    if (isOnline) {
      try {
        await api.addBlockedCall({ phoneNumber, description, reason });
      } catch (error) {
        console.warn('Erro ao salvar chamada bloqueada no servidor:', error);
        // Adiciona à fila de sincronização
        await addToSyncQueue('blocked_call', { phoneNumber, description, reason });
      }
    } else {
      // Offline - adiciona à fila de sincronização
      await addToSyncQueue('blocked_call', { phoneNumber, description, reason });
    }
    
    return calls;
  },

  // Obtém confirmações pendentes
  async getPendingConfirmations() {
    try {
      if (isOnline) {
        // Tenta obter do servidor
        const pendingConfirmations = await api.getPendingConfirmations();
        const formattedConfirmations = pendingConfirmations.map(conf => {
          // Guarda o ID no formato que podemos recuperar depois
          const description = conf.description || 'Aguardando confirmação';
          return `${conf.phone_number} - ${description} [id:${conf.id}]`;
        });
        await localforage.setItem(KEYS.PENDING_CONFIRMATIONS, formattedConfirmations);
        return formattedConfirmations;
      }
    } catch (error) {
      console.warn('Erro ao obter confirmações pendentes do servidor:', error);
    }
    
    // Fallback para armazenamento local
    return await localforage.getItem(KEYS.PENDING_CONFIRMATIONS) || [];
  },

  // Adiciona uma nova confirmação pendente
  async addPendingConfirmation(confirmation) {
    // Formata os dados para a API
    const confirmationParts = confirmation.split(' - ');
    const phoneNumber = confirmationParts[0];
    const description = confirmationParts.length > 1 ? confirmationParts[1] : 'Aguardando confirmação';
    
    // Adiciona localmente primeiro
    const confirmations = await this.getPendingConfirmations();
    
    // Tenta salvar no servidor
    let serverConfirmationId = null;
    if (isOnline) {
      try {
        const result = await api.addPendingConfirmation({ phoneNumber, description });
        serverConfirmationId = result.id;
      } catch (error) {
        console.warn('Erro ao salvar confirmação pendente no servidor:', error);
        // Adiciona à fila de sincronização
        await addToSyncQueue('pending_confirmation', { phoneNumber, description });
      }
    } else {
      // Offline - adiciona à fila de sincronização
      await addToSyncQueue('pending_confirmation', { phoneNumber, description });
    }
    
    // Adiciona o ID do servidor, se disponível
    const confirmationWithId = serverConfirmationId ? 
      `${phoneNumber} - ${description} [id:${serverConfirmationId}]` : confirmation;
    
    confirmations.unshift(confirmationWithId); // Adiciona no início do array
    await localforage.setItem(KEYS.PENDING_CONFIRMATIONS, confirmations);
    
    return confirmations;
  },

  // Remove uma confirmação pendente
  async removePendingConfirmation(index) {
    const confirmations = await this.getPendingConfirmations();
    if (index >= 0 && index < confirmations.length) {
      const confirmation = confirmations[index];
      
      // Extrai o ID do servidor, se existir
      const idMatch = confirmation.match(/\[id:(\d+)\]$/);
      const serverId = idMatch ? idMatch[1] : null;
      
      // Remove localmente
      confirmations.splice(index, 1);
      await localforage.setItem(KEYS.PENDING_CONFIRMATIONS, confirmations);
      
      // Remove no servidor se tiver ID
      if (serverId && isOnline) {
        try {
          await api.removePendingConfirmation(serverId);
        } catch (error) {
          console.warn(`Erro ao remover confirmação pendente do servidor (ID ${serverId}):`, error);
          // Adiciona à fila de sincronização
          await addToSyncQueue('remove_confirmation', { id: serverId });
        }
      } else if (serverId) {
        // Offline com ID - adiciona à fila de sincronização
        await addToSyncQueue('remove_confirmation', { id: serverId });
      }
    }
    return confirmations;
  },

  // Obtém configurações
  async getSettings() {
    try {
      if (isOnline) {
        // Tenta obter do servidor
        const settings = await api.getSettings();
        await localforage.setItem(KEYS.SETTINGS, settings);
        return settings;
      }
    } catch (error) {
      console.warn('Erro ao obter configurações do servidor:', error);
    }
    
    // Fallback para armazenamento local
    return await localforage.getItem(KEYS.SETTINGS) || DEFAULT_DATA.settings;
  },

  // Atualiza configurações
  async updateSettings(newSettings) {
    // Atualiza localmente primeiro
    const settings = await this.getSettings();
    const updatedSettings = { ...settings, ...newSettings };
    await localforage.setItem(KEYS.SETTINGS, updatedSettings);
    
    // Tenta atualizar no servidor
    if (isOnline) {
      try {
        await api.updateSettings(updatedSettings);
      } catch (error) {
        console.warn('Erro ao atualizar configurações no servidor:', error);
        // Adiciona à fila de sincronização
        await addToSyncQueue('setting', updatedSettings);
      }
    } else {
      // Offline - adiciona à fila de sincronização
      await addToSyncQueue('setting', updatedSettings);
    }
    
    return updatedSettings;
  },
  
  // Verifica se há sincronização pendente
  hasPendingSynchronization() {
    return hasSyncPending;
  },
  
  // Força sincronização com o servidor
  async syncWithServer() {
    if (isOnline) {
      return await syncWithServer();
    }
    return false;
  },
};

// Métodos diretos para compatibilidade com outros módulos
storage.getItem = async (key) => {
  try {
    return await localforage.getItem(key);
  } catch (error) {
    console.error(`Erro ao obter item ${key}:`, error);
    return null;
  }
};

storage.setItem = async (key, value) => {
  try {
    await localforage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Erro ao armazenar item ${key}:`, error);
    return false;
  }
};

// Método para remover item
storage.removeItem = async (key) => {
  try {
    await localforage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Erro ao remover item ${key}:`, error);
    return false;
  }
};

// Exporta o objeto de armazenamento como padrão
export default storage;
