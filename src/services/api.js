/**
 * Serviço API para comunicação com o backend
 * Permite que o aplicativo Quero Paz se comunique com o servidor para
 * persistir dados no banco de dados MySQL
 */

// URL base da API - deve ser configurada no .env em produção
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

/**
 * Função genérica para fazer requisições à API
 * @param {string} endpoint - Endpoint da API (sem a base URL)
 * @param {string} method - Método HTTP (GET, POST, PUT, DELETE)
 * @param {object} data - Dados para enviar no corpo da requisição (para POST, PUT)
 * @returns {Promise<any>} - Promessa com os dados da resposta
 */
async function request(endpoint, method = 'GET', data = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    
    if (response.ok) {
      return response.json();
    }
    
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro na requisição');
  } catch (error) {
    console.error(`Erro na requisição para ${endpoint}:`, error);
    
    // Verifica se é um erro de rede (offline)
    if (error.message === 'Failed to fetch' || !navigator.onLine) {
      console.warn('Dispositivo offline, armazenando requisição para sincronização posterior');
      // Aqui poderia implementar uma fila de sincronização para quando voltar online
      throw new Error('Dispositivo offline. A operação será concluída quando a conexão for restaurada.');
    }
    
    throw error;
  }
}

/**
 * Serviço de API para o aplicativo Quero Paz
 */
const api = {
  // Verifica status da API
  checkHealth: () => request('/health'),
  
  // Chamadas bloqueadas
  getBlockedCalls: () => request('/blocked-calls'),
  addBlockedCall: (data) => request('/blocked-calls', 'POST', data),
  
  // Configurações
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', 'POST', data),
  
  // Eventos
  logEvent: (data) => request('/events', 'POST', data),
  getEvents: (type, limit) => {
    const queryParams = new URLSearchParams();
    if (type) queryParams.append('type', type);
    if (limit) queryParams.append('limit', limit);
    return request(`/events?${queryParams.toString()}`);
  },
  
  // Confirmações pendentes
  getPendingConfirmations: () => request('/pending-confirmations'),
  addPendingConfirmation: (data) => request('/pending-confirmations', 'POST', data),
  removePendingConfirmation: (id) => request(`/pending-confirmations/${id}`, 'DELETE')
};

export default api;
