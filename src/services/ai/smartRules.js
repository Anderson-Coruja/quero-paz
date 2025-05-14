/**
 * Sistema de Regras Inteligentes para o Quero Paz
 * 
 * Este serviço implementa regras contextuais avançadas para
 * bloqueio inteligente de chamadas baseado em diversos fatores.
 */

import storage from '../storage';

// Tipos de regras
export const RULE_TYPES = {
  TIME_BASED: 'time_based',     // Baseada em horário
  LOCATION_BASED: 'location',   // Baseada em localização
  WHITELIST: 'whitelist',       // Lista branca (sempre permitir)
  DURATION: 'duration',         // Baseada em duração de chamada
  PREFIX: 'prefix',             // Baseada em prefixo do número
  CALENDAR: 'calendar'          // Baseada em eventos do calendário
};

// Estados de regras
export const RULE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  AUTO: 'auto'  // Ativada automaticamente baseada em condições
};

/**
 * Serviço de regras inteligentes
 */
const smartRules = {
  /**
   * Obtém todas as regras configuradas
   * @returns {Promise<Array>} Lista de regras
   */
  async getRules() {
    const rules = await storage.getItem('smart_rules');
    return rules || [];
  },
  
  /**
   * Adiciona uma nova regra
   * @param {Object} rule - Configuração da regra
   * @returns {Promise<Object>} Regra adicionada com ID
   */
  async addRule(rule) {
    const rules = await this.getRules();
    
    // Gera ID único para a regra
    const newRule = {
      ...rule,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      status: rule.status || RULE_STATUS.ACTIVE
    };
    
    // Adiciona a nova regra
    await storage.setItem('smart_rules', [...rules, newRule]);
    return newRule;
  },
  
  /**
   * Atualiza uma regra existente
   * @param {string} ruleId - ID da regra
   * @param {Object} updates - Campos a atualizar
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async updateRule(ruleId, updates) {
    const rules = await this.getRules();
    const index = rules.findIndex(rule => rule.id === ruleId);
    
    if (index === -1) return false;
    
    // Atualiza a regra
    rules[index] = {
      ...rules[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await storage.setItem('smart_rules', rules);
    return true;
  },
  
  /**
   * Remove uma regra
   * @param {string} ruleId - ID da regra
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async deleteRule(ruleId) {
    const rules = await this.getRules();
    const newRules = rules.filter(rule => rule.id !== ruleId);
    
    if (newRules.length === rules.length) return false;
    
    await storage.setItem('smart_rules', newRules);
    return true;
  },
  
  /**
   * Cria uma regra baseada em horário
   * @param {number} startHour - Hora de início (0-23)
   * @param {number} endHour - Hora de fim (0-23)
   * @param {Array} daysOfWeek - Dias da semana (0-6, 0 = domingo)
   * @param {string} name - Nome da regra
   * @returns {Promise<Object>} Regra criada
   */
  async createTimeRule(startHour, endHour, daysOfWeek, name) {
    return this.addRule({
      type: RULE_TYPES.TIME_BASED,
      name: name || `Bloqueio das ${startHour}h às ${endHour}h`,
      config: {
        startHour,
        endHour,
        daysOfWeek: daysOfWeek || [0, 1, 2, 3, 4, 5, 6] // Todos os dias por padrão
      },
      action: 'block',
      status: RULE_STATUS.ACTIVE
    });
  },
  
  /**
   * Cria uma regra de lista branca (contatos sempre permitidos)
   * @param {Array} phoneNumbers - Lista de números a permitir sempre
   * @param {string} name - Nome da regra
   * @returns {Promise<Object>} Regra criada
   */
  async createWhitelistRule(phoneNumbers, name) {
    return this.addRule({
      type: RULE_TYPES.WHITELIST,
      name: name || `Lista de contatos prioritários`,
      config: {
        phoneNumbers: phoneNumbers || []
      },
      action: 'allow',
      status: RULE_STATUS.ACTIVE
    });
  },
  
  /**
   * Cria uma regra para bloquear chamadas curtas repetitivas
   * @param {number} maxDuration - Duração máxima (em segundos) para considerar uma chamada curta
   * @param {number} minFrequency - Frequência mínima para acionar o bloqueio
   * @param {string} name - Nome da regra
   * @returns {Promise<Object>} Regra criada
   */
  async createDurationRule(maxDuration, minFrequency, name) {
    return this.addRule({
      type: RULE_TYPES.DURATION,
      name: name || `Bloqueio de chamadas curtas repetitivas`,
      config: {
        maxDuration: maxDuration || 5, // 5 segundos por padrão
        minFrequency: minFrequency || 3, // 3 chamadas para acionar
        timeWindow: 60 * 60 * 1000 // 1 hora em milissegundos
      },
      action: 'block',
      status: RULE_STATUS.ACTIVE
    });
  },
  
  /**
   * Avalia se uma chamada deve ser bloqueada com base nas regras ativas
   * @param {Object} call - Dados da chamada (número, hora, etc)
   * @returns {Promise<Object>} Resultado da avaliação
   */
  async evaluateCall(call) {
    const rules = await this.getRules();
    const activeRules = rules.filter(rule => rule.status === RULE_STATUS.ACTIVE || rule.status === RULE_STATUS.AUTO);
    
    // Primeiro verifica lista branca - se estiver nela, sempre permite
    const whitelistRules = activeRules.filter(rule => rule.type === RULE_TYPES.WHITELIST);
    for (const rule of whitelistRules) {
      if (rule.config.phoneNumbers.includes(call.phoneNumber)) {
        return {
          action: 'allow',
          reason: 'Contato prioritário',
          rule: rule
        };
      }
    }
    
    // Em seguida, verifica regras de bloqueio
    for (const rule of activeRules) {
      if (rule.type === RULE_TYPES.WHITELIST) continue; // Já verificadas acima
      
      // Verifica regras baseadas em horário
      if (rule.type === RULE_TYPES.TIME_BASED) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay();
        
        if (rule.config.daysOfWeek.includes(currentDay)) {
          // Verifica se estamos no intervalo de horas especificado
          if (rule.config.startHour <= rule.config.endHour) {
            // Caso normal (ex: 9h às 17h)
            if (currentHour >= rule.config.startHour && currentHour < rule.config.endHour) {
              return {
                action: rule.action,
                reason: `Horário restrito: ${rule.name}`,
                rule: rule
              };
            }
          } else {
            // Caso de intervalo que passa da meia-noite (ex: 22h às 6h)
            if (currentHour >= rule.config.startHour || currentHour < rule.config.endHour) {
              return {
                action: rule.action,
                reason: `Horário restrito: ${rule.name}`,
                rule: rule
              };
            }
          }
        }
      }
      
      // Verifica regras baseadas em prefixo
      if (rule.type === RULE_TYPES.PREFIX && call.phoneNumber) {
        if (call.phoneNumber.startsWith(rule.config.prefix)) {
          return {
            action: rule.action,
            reason: `Prefixo bloqueado: ${rule.name}`,
            rule: rule
          };
        }
      }
      
      // Verifica regras baseadas em duração
      if (rule.type === RULE_TYPES.DURATION) {
        // Obter histórico recente desse número
        const recentCalls = await this.getRecentCallsByNumber(call.phoneNumber, rule.config.timeWindow);
        const shortCalls = recentCalls.filter(c => c.duration <= rule.config.maxDuration);
        
        if (shortCalls.length >= rule.config.minFrequency) {
          return {
            action: rule.action,
            reason: `Padrão detectado: ${shortCalls.length} chamadas curtas`,
            rule: rule
          };
        }
      }
    }
    
    // Nenhuma regra encontrada
    return {
      action: 'default',
      reason: 'Nenhuma regra aplicável'
    };
  },
  
  /**
   * Obtém chamadas recentes de um determinado número
   * @param {string} phoneNumber - Número de telefone
   * @param {number} timeWindow - Janela de tempo (ms)
   * @returns {Promise<Array>} Chamadas recentes
   */
  async getRecentCallsByNumber(phoneNumber, timeWindow) {
    const now = Date.now();
    const calls = await storage.getCallHistory();
    
    return calls.filter(call => {
      // Verifica se é do mesmo número
      if (call.phoneNumber !== phoneNumber) return false;
      
      // Verifica se está dentro da janela de tempo
      const callTime = new Date(call.time).getTime();
      return (now - callTime) <= timeWindow;
    });
  },
  
  /**
   * Gera recomendações para novas regras com base no histórico
   * @returns {Promise<Array>} Recomendações de regras
   */
  async generateRuleRecommendations() {
    // Esta função seria aprimorada com análise de padrões mais sofisticada
    // Por ora, retorna exemplos básicos
    return [
      {
        type: RULE_TYPES.TIME_BASED,
        name: 'Modo Noturno',
        description: 'Bloquear chamadas durante a noite',
        config: {
          startHour: 22,
          endHour: 7,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
        }
      },
      {
        type: RULE_TYPES.DURATION,
        name: 'Anti-Telemarketing',
        description: 'Bloquear números que fazem múltiplas chamadas curtas',
        config: {
          maxDuration: 5,
          minFrequency: 2,
          timeWindow: 60 * 60 * 1000
        }
      }
    ];
  }
};

export default smartRules;
