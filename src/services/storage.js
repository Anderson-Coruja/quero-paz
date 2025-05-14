import localforage from 'localforage';

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

// Funções de acesso ao armazenamento
export const storage = {
  // Inicializa o storage com dados padrão se não existirem
  async initialize() {
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
  },

  // Obtém o estado de bloqueio
  async getBlockingState() {
    return await localforage.getItem(KEYS.BLOCKING_STATE) || DEFAULT_DATA.blockingState;
  },

  // Define o estado de bloqueio
  async setBlockingState(state) {
    await localforage.setItem(KEYS.BLOCKING_STATE, state);
  },

  // Obtém as chamadas silenciadas
  async getSilencedCalls() {
    return await localforage.getItem(KEYS.SILENCED_CALLS) || DEFAULT_DATA.silencedCalls;
  },

  // Adiciona uma nova chamada silenciada
  async addSilencedCall(call) {
    const calls = await this.getSilencedCalls();
    const updatedCalls = [call, ...calls].slice(0, 20); // Limita a 20 chamadas
    await localforage.setItem(KEYS.SILENCED_CALLS, updatedCalls);
    return updatedCalls;
  },

  // Obtém confirmações pendentes
  async getPendingConfirmations() {
    return await localforage.getItem(KEYS.PENDING_CONFIRMATIONS) || DEFAULT_DATA.pendingConfirmations;
  },

  // Adiciona uma nova confirmação pendente
  async addPendingConfirmation(confirmation) {
    const confirmations = await this.getPendingConfirmations();
    const updatedConfirmations = [confirmation, ...confirmations];
    await localforage.setItem(KEYS.PENDING_CONFIRMATIONS, updatedConfirmations);
    return updatedConfirmations;
  },

  // Remove uma confirmação pendente
  async removePendingConfirmation(index) {
    const confirmations = await this.getPendingConfirmations();
    const updatedConfirmations = [...confirmations];
    updatedConfirmations.splice(index, 1);
    await localforage.setItem(KEYS.PENDING_CONFIRMATIONS, updatedConfirmations);
    return updatedConfirmations;
  },

  // Obtém configurações
  async getSettings() {
    return await localforage.getItem(KEYS.SETTINGS) || DEFAULT_DATA.settings;
  },

  // Atualiza configurações
  async updateSettings(newSettings) {
    const currentSettings = await this.getSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    await localforage.setItem(KEYS.SETTINGS, updatedSettings);
    return updatedSettings;
  }
};

export default storage;
