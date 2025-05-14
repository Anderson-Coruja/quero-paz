/**
 * Serviço de Rastreamento para o Quero Paz
 * Responsável por registrar eventos, interações e erros do aplicativo
 * Implementa sincronização com o servidor através da API
 */

import api from './api';

// Constantes para tipos de eventos
const EVENT_TYPES = {
  APP: 'app',
  CALL: 'call',
  USER: 'user',
  ERROR: 'error',
  PERFORMANCE: 'performance',
  STORAGE: 'storage'
};

// Armazenamento local de eventos
let events = [];
const MAX_STORED_EVENTS = 1000;

// Estado da conexão com a API
let isOnline = navigator.onLine;
let hasSyncPending = false;

// Fila de eventos para sincronização
const syncQueue = [];

// Ouvintes de evento para online/offline
window.addEventListener('online', () => { 
  isOnline = true; 
  syncEvents(); 
});
window.addEventListener('offline', () => { 
  isOnline = false; 
});

/**
 * Sincroniza eventos com o servidor
 */
async function syncEvents() {
  if (!isOnline || syncQueue.length === 0) return;
  
  console.log(`Sincronizando ${syncQueue.length} eventos`);
  hasSyncPending = true;
  
  const queueCopy = [...syncQueue];
  for (const eventData of queueCopy) {
    try {
      await api.logEvent(eventData);
      // Remove da fila se for bem-sucedido
      const index = syncQueue.indexOf(eventData);
      if (index > -1) syncQueue.splice(index, 1);
    } catch (error) {
      console.error('Erro ao sincronizar evento:', error);
      // Mantém na fila para tentar novamente depois
    }
  }
  
  // Salva a fila atualizada no armazenamento local
  localStorage.setItem('eventSyncQueue', JSON.stringify(syncQueue));
  hasSyncPending = syncQueue.length > 0;
}

/**
 * Inicializa o serviço de rastreamento
 */
const initialize = () => {
  console.log('Inicializando serviço de rastreamento');
  
  try {
    // Carrega eventos salvos anteriormente
    const savedEvents = localStorage.getItem('appEvents');
    if (savedEvents) {
      events = JSON.parse(savedEvents);
    }
    
    // Carrega fila de sincronização do armazenamento local
    const savedQueue = localStorage.getItem('eventSyncQueue');
    if (savedQueue) {
      const parsedQueue = JSON.parse(savedQueue);
      syncQueue.push(...parsedQueue);
      hasSyncPending = syncQueue.length > 0;
    }

    // Registra inicialização do app
    trackEvent(EVENT_TYPES.APP, 'initialize', { timestamp: new Date().toISOString() });
    
    // Incrementa contador de inicializações do app
    const appUsage = JSON.parse(localStorage.getItem('appUsage') || '{"appStarts": 0, "blockedCalls": 0}');
    appUsage.appStarts += 1;
    localStorage.setItem('appUsage', JSON.stringify(appUsage));
    localStorage.setItem('lastUsed', new Date().toISOString());
    
    // Tenta sincronizar eventos pendentes
    if (isOnline && hasSyncPending) {
      syncEvents();
    }
  } catch (error) {
    console.error('Erro ao inicializar o rastreamento:', error);
  }
  
  // Registra quando o aplicativo for fechado/minimizado
  window.addEventListener('beforeunload', () => {
    trackEvent(EVENT_TYPES.APP, 'close', { timestamp: new Date().toISOString() });
    saveEvents();
  });
};

/**
 * Registra um evento no sistema
 * @param {string} type - Tipo do evento (app, call, user, error, etc)
 * @param {string} action - Ação realizada
 * @param {Object} data - Dados adicionais do evento
 */
const trackEvent = (type, action, data = {}) => {
  const event = {
    type,
    action,
    data,
    timestamp: new Date().toISOString()
  };
  
  // Adiciona ao armazenamento local
  events.push(event);
  
  // Limita o número de eventos armazenados
  if (events.length > MAX_STORED_EVENTS) {
    events = events.slice(-MAX_STORED_EVENTS);
  }
  
  // A cada 10 eventos, salva no armazenamento local
  if (events.length % 10 === 0) {
    saveEvents();
  }
  
  // Tenta enviar para o servidor se estiver online
  if (isOnline) {
    try {
      api.logEvent({ type, action, data })
        .catch(error => {
          console.warn('Erro ao salvar evento no servidor:', error);
          // Adiciona à fila de sincronização
          syncQueue.push({ type, action, data, timestamp: new Date().toISOString() });
          localStorage.setItem('eventSyncQueue', JSON.stringify(syncQueue));
          hasSyncPending = true;
        });
    } catch (error) {
      console.warn('Erro ao enviar evento para o servidor:', error);
      // Adiciona à fila de sincronização
      syncQueue.push({ type, action, data, timestamp: new Date().toISOString() });
      localStorage.setItem('eventSyncQueue', JSON.stringify(syncQueue));
      hasSyncPending = true;
    }
  } else {
    // Offline - adiciona à fila de sincronização
    syncQueue.push({ type, action, data, timestamp: new Date().toISOString() });
    localStorage.setItem('eventSyncQueue', JSON.stringify(syncQueue));
    hasSyncPending = true;
  }
  
  return event;
};

/**
 * Salva os eventos no armazenamento local
 */
const saveEvents = () => {
  try {
    localStorage.setItem('appEvents', JSON.stringify(events));
  } catch (error) {
    console.error('Erro ao salvar eventos:', error);
  }
};

/**
 * Registra uma chamada bloqueada
 * @param {string} phoneNumber - Número do telefone bloqueado
 * @param {string} reason - Motivo do bloqueio
 */
const trackBlockedCall = (phoneNumber, reason = 'desconhecido') => {
  return trackEvent(EVENT_TYPES.CALL, 'blocked', { 
    phoneNumber, 
    reason,
    timestamp: new Date().toISOString()
  });
};

/**
 * Registra uma chamada silenciada
 * @param {string} phoneNumber - Número do telefone silenciado
 */
const trackSilencedCall = (phoneNumber) => {
  return trackEvent(EVENT_TYPES.CALL, 'silenced', { 
    phoneNumber,
    timestamp: new Date().toISOString()
  });
};

/**
 * Registra uma mudança de configuração
 * @param {string} setting - Configuração alterada
 * @param {any} value - Novo valor
 */
const trackSettingChange = (setting, value) => {
  return trackEvent(EVENT_TYPES.USER, 'settings_change', { 
    setting, 
    value,
    timestamp: new Date().toISOString()
  });
};

/**
 * Registra um erro na aplicação
 * @param {string} source - Origem do erro
 * @param {string} message - Mensagem de erro
 * @param {Object} details - Detalhes adicionais
 */
const trackError = (source, message, details = {}) => {
  return trackEvent(EVENT_TYPES.ERROR, 'error', { 
    source, 
    message, 
    details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Registra métrica de performance
 * @param {string} name - Nome da métrica
 * @param {number} value - Valor da métrica (geralmente em ms)
 */
const trackPerformance = (name, value) => {
  return trackEvent(EVENT_TYPES.PERFORMANCE, name, { 
    value,
    timestamp: new Date().toISOString()
  });
};

/**
 * Recupera eventos registrados
 * @param {string} type - Opcional, tipo do evento para filtrar
 * @param {number} limit - Opcional, limite de eventos a retornar
 * @returns {Array} - Lista de eventos
 */
const getEvents = async (type = null, limit = 100) => {
  // Tenta obter eventos do servidor se estiver online
  if (isOnline) {
    try {
      const serverEvents = await api.getEvents(type, limit);
      // Mescla eventos do servidor com eventos locais
      const allEvents = [...events, ...serverEvents];
      
      // Deduplica por timestamp e ordena por data (mais recentes primeiro)
      const uniqueEvents = Array.from(new Map(allEvents.map(event => 
        [event.timestamp, event]
      )).values());
      
      uniqueEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return uniqueEvents.slice(0, limit);
    } catch (error) {
      console.warn('Erro ao obter eventos do servidor:', error);
      // Fallback para eventos locais
    }
  }
  
  // Se offline ou houver erro ao obter do servidor
  let filteredEvents = events;
  
  if (type) {
    filteredEvents = events.filter(event => event.type === type);
  }
  
  return filteredEvents.slice(-limit);
};

/**
 * Limpa todos os eventos armazenados
 */
const clearEvents = () => {
  events = [];
  localStorage.removeItem('appEvents');
};

/**
 * Coleta estatísticas básicas de uso
 * @returns {Object} - Estatísticas de uso
 */
const getUsageStats = () => {
  try {
    const appUsage = JSON.parse(localStorage.getItem('appUsage') || '{"appStarts": 0, "blockedCalls": 0}');
    const callEvents = events.filter(event => event.type === EVENT_TYPES.CALL);
    const blockedCalls = callEvents.filter(event => event.action === 'blocked').length;
    const silencedCalls = callEvents.filter(event => event.action === 'silenced').length;
    const errorCount = events.filter(event => event.type === EVENT_TYPES.ERROR).length;
    
    return {
      appStarts: appUsage.appStarts || 0,
      totalEvents: events.length,
      blockedCalls,
      silencedCalls,
      errorCount,
      lastUsed: localStorage.getItem('lastUsed') || null,
      eventsByType: {
        app: events.filter(event => event.type === EVENT_TYPES.APP).length,
        call: callEvents.length,
        user: events.filter(event => event.type === EVENT_TYPES.USER).length,
        error: errorCount,
        performance: events.filter(event => event.type === EVENT_TYPES.PERFORMANCE).length,
        storage: events.filter(event => event.type === EVENT_TYPES.STORAGE).length
      }
    };
  } catch (error) {
    console.error('Erro ao coletar estatísticas de uso:', error);
    return {
      error: 'Falha ao coletar estatísticas',
      details: error.message
    };
  }
};

/**
 * Força a sincronização de eventos com o servidor
 */
const syncWithServer = async () => {
  if (isOnline) {
    return await syncEvents();
  }
  return false;
};

/**
 * Verifica se há eventos pendentes de sincronização
 */
const hasPendingSynchronization = () => {
  return hasSyncPending;
};

// Exporta funções do serviço
export default {
  initialize,
  trackEvent,
  trackBlockedCall,
  trackSilencedCall,
  trackSettingChange,
  trackError,
  trackPerformance,
  getEvents,
  clearEvents,
  getUsageStats,
  syncWithServer,
  hasPendingSynchronization,
  EVENT_TYPES
};
