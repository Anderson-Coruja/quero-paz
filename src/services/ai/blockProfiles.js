/**
 * Perfis de Bloqueio Pré-configurados para o Quero Paz
 * 
 * Este serviço permite criar e gerenciar modos de bloqueio pré-configurados
 * como "Trabalho", "Sono", "Férias" com regras específicas para cada um.
 */

import storage from '../storage';
import smartRules, { RULE_TYPES, RULE_STATUS } from './smartRules';

// Tipos de perfis predefinidos
export const PROFILE_TYPES = {
  SLEEP: 'sleep',        // Modo sono/noturno
  WORK: 'work',          // Modo trabalho/foco
  VACATION: 'vacation',  // Modo férias/descanso
  MEETING: 'meeting',    // Modo reunião
  CUSTOM: 'custom'       // Perfil personalizado
};

// Estados de perfil
export const PROFILE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SCHEDULED: 'scheduled' // Ativação agendada
};

/**
 * Serviço de perfis de bloqueio
 */
const blockProfiles = {
  /**
   * Obtém todos os perfis configurados
   * @returns {Promise<Array>} Lista de perfis
   */
  async getProfiles() {
    const profiles = await storage.getItem('block_profiles');
    return profiles || [];
  },
  
  /**
   * Verifica se existe algum perfil ativo
   * @returns {Promise<Object|null>} Perfil ativo ou null
   */
  async getActiveProfile() {
    const profiles = await this.getProfiles();
    return profiles.find(profile => profile.status === PROFILE_STATUS.ACTIVE) || null;
  },
  
  /**
   * Cria um novo perfil de bloqueio
   * @param {Object} profile - Dados do perfil
   * @returns {Promise<Object>} Perfil criado
   */
  async createProfile(profile) {
    const profiles = await this.getProfiles();
    
    // Gera um ID único para o perfil
    const newProfile = {
      ...profile,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      status: profile.status || PROFILE_STATUS.INACTIVE,
      ruleIds: profile.ruleIds || []
    };
    
    await storage.setItem('block_profiles', [...profiles, newProfile]);
    return newProfile;
  },
  
  /**
   * Atualiza um perfil existente
   * @param {string} profileId - ID do perfil
   * @param {Object} updates - Dados a atualizar
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async updateProfile(profileId, updates) {
    const profiles = await this.getProfiles();
    const index = profiles.findIndex(p => p.id === profileId);
    
    if (index === -1) return false;
    
    profiles[index] = {
      ...profiles[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await storage.setItem('block_profiles', profiles);
    return true;
  },
  
  /**
   * Exclui um perfil
   * @param {string} profileId - ID do perfil
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async deleteProfile(profileId) {
    const profiles = await this.getProfiles();
    const newProfiles = profiles.filter(p => p.id !== profileId);
    
    if (newProfiles.length === profiles.length) return false;
    
    await storage.setItem('block_profiles', newProfiles);
    return true;
  },
  
  /**
   * Ativa um perfil específico
   * @param {string} profileId - ID do perfil
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async activateProfile(profileId) {
    const profiles = await this.getProfiles();
    
    // Desativa todos os perfis primeiro
    const updatedProfiles = profiles.map(p => ({
      ...p,
      status: p.id === profileId ? PROFILE_STATUS.ACTIVE : PROFILE_STATUS.INACTIVE
    }));
    
    await storage.setItem('block_profiles', updatedProfiles);
    
    // Ativa as regras associadas a este perfil
    const activeProfile = updatedProfiles.find(p => p.id === profileId);
    if (activeProfile && activeProfile.ruleIds) {
      for (const ruleId of activeProfile.ruleIds) {
        await smartRules.updateRule(ruleId, { status: RULE_STATUS.ACTIVE });
      }
    }
    
    return true;
  },
  
  /**
   * Desativa todos os perfis
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async deactivateAllProfiles() {
    const profiles = await this.getProfiles();
    
    // Marca todos os perfis como inativos
    const updatedProfiles = profiles.map(p => ({
      ...p,
      status: PROFILE_STATUS.INACTIVE
    }));
    
    await storage.setItem('block_profiles', updatedProfiles);
    return true;
  },
  
  /**
   * Cria o perfil "Modo Sono" com configurações padrão
   * @returns {Promise<Object>} Perfil criado
   */
  async createSleepProfile() {
    // Cria a regra de horário noturno
    const timeRule = await smartRules.createTimeRule(22, 7, [0, 1, 2, 3, 4, 5, 6], 'Horário de sono');
    
    // Cria a regra de lista branca para contatos de emergência
    const whitelistRule = await smartRules.createWhitelistRule([], 'Contatos de emergência');
    
    // Cria o perfil com as regras
    return this.createProfile({
      name: 'Modo Sono',
      type: PROFILE_TYPES.SLEEP,
      description: 'Bloqueia todas as chamadas durante a noite, exceto contatos de emergência',
      icon: 'moon',
      color: '#1e40af', // Azul escuro
      ruleIds: [timeRule.id, whitelistRule.id],
      status: PROFILE_STATUS.INACTIVE
    });
  },
  
  /**
   * Cria o perfil "Modo Trabalho" com configurações padrão
   * @returns {Promise<Object>} Perfil criado
   */
  async createWorkProfile() {
    // Cria regra para horário comercial (8h-18h, seg-sex)
    const timeRule = await smartRules.createTimeRule(8, 18, [1, 2, 3, 4, 5], 'Horário de trabalho');
    
    // Cria regra para lista branca (contatos importantes do trabalho)
    const whitelistRule = await smartRules.createWhitelistRule([], 'Contatos de trabalho');
    
    // Cria o perfil
    return this.createProfile({
      name: 'Modo Trabalho',
      type: PROFILE_TYPES.WORK,
      description: 'Filtra chamadas durante o horário de trabalho, permitindo apenas contatos importantes',
      icon: 'briefcase',
      color: '#15803d', // Verde escuro
      ruleIds: [timeRule.id, whitelistRule.id],
      status: PROFILE_STATUS.INACTIVE
    });
  },
  
  /**
   * Cria o perfil "Modo Férias" com configurações padrão
   * @returns {Promise<Object>} Perfil criado
   */
  async createVacationProfile() {
    // Cria regra para lista branca (apenas família e amigos próximos)
    const whitelistRule = await smartRules.createWhitelistRule([], 'Família e amigos próximos');
    
    // Cria regra para bloquear chamadas repetitivas (anti-spam)
    const durationRule = await smartRules.createDurationRule(5, 2, 'Anti-spam férias');
    
    // Cria o perfil
    return this.createProfile({
      name: 'Modo Férias',
      type: PROFILE_TYPES.VACATION,
      description: 'Bloqueio rigoroso de chamadas, permitindo apenas contatos mais próximos',
      icon: 'beach',
      color: '#b91c1c', // Vermelho
      ruleIds: [whitelistRule.id, durationRule.id],
      status: PROFILE_STATUS.INACTIVE
    });
  },
  
  /**
   * Cria o perfil "Modo Reunião" com configurações padrão
   * @returns {Promise<Object>} Perfil criado
   */
  async createMeetingProfile() {
    // Cria regra para lista branca (apenas contatos críticos)
    const whitelistRule = await smartRules.createWhitelistRule([], 'Contatos críticos');
    
    // Cria o perfil
    return this.createProfile({
      name: 'Modo Reunião',
      type: PROFILE_TYPES.MEETING,
      description: 'Bloqueio temporário para reuniões importantes',
      icon: 'users',
      color: '#7f1d1d', // Vermelho escuro
      ruleIds: [whitelistRule.id],
      status: PROFILE_STATUS.INACTIVE,
      duration: 60 // Duração padrão de 60 minutos
    });
  },
  
  /**
   * Programa a ativação e desativação automática de um perfil
   * @param {string} profileId - ID do perfil
   * @param {Date} startDate - Data/hora de início
   * @param {Date} endDate - Data/hora de fim
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async scheduleProfile(profileId, startDate, endDate) {
    const profiles = await this.getProfiles();
    const index = profiles.findIndex(p => p.id === profileId);
    
    if (index === -1) return false;
    
    // Atualiza o perfil com informações de agendamento
    profiles[index] = {
      ...profiles[index],
      status: PROFILE_STATUS.SCHEDULED,
      schedule: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        active: true
      },
      updatedAt: new Date().toISOString()
    };
    
    await storage.setItem('block_profiles', profiles);
    return true;
  },
  
  /**
   * Verifica e processa perfis agendados
   * Esta função seria chamada periodicamente ou no carregamento do app
   * @returns {Promise<void>}
   */
  async processScheduledProfiles() {
    const profiles = await this.getProfiles();
    const now = new Date();
    let updated = false;
    
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      
      if (profile.status === PROFILE_STATUS.SCHEDULED && profile.schedule && profile.schedule.active) {
        const startDate = new Date(profile.schedule.startDate);
        const endDate = new Date(profile.schedule.endDate);
        
        // Verifica se é hora de ativar
        if (now >= startDate && now < endDate && profile.status !== PROFILE_STATUS.ACTIVE) {
          profiles[i] = {
            ...profile,
            status: PROFILE_STATUS.ACTIVE
          };
          updated = true;
          
          // Ativa as regras associadas
          if (profile.ruleIds) {
            for (const ruleId of profile.ruleIds) {
              await smartRules.updateRule(ruleId, { status: RULE_STATUS.ACTIVE });
            }
          }
        }
        // Verifica se é hora de desativar
        else if (now >= endDate && profile.status !== PROFILE_STATUS.INACTIVE) {
          profiles[i] = {
            ...profile,
            status: PROFILE_STATUS.INACTIVE,
            schedule: {
              ...profile.schedule,
              active: false
            }
          };
          updated = true;
          
          // Desativa as regras, se necessário
          if (profile.ruleIds) {
            for (const ruleId of profile.ruleIds) {
              await smartRules.updateRule(ruleId, { status: RULE_STATUS.INACTIVE });
            }
          }
        }
      }
    }
    
    if (updated) {
      await storage.setItem('block_profiles', profiles);
    }
  }
};

export default blockProfiles;
