/**
 * Sistema de pontuação de reputação para números de telefone
 * 
 * Este módulo implementa um algoritmo sofisticado para calcular a
 * pontuação de reputação de números de telefone com base em dados
 * pessoais e da comunidade.
 */

// Constantes de peso para o cálculo da pontuação
const WEIGHTS = {
  PERSONAL_BLOCK: 50,      // Peso para bloqueio pessoal
  PERSONAL_ACCEPT: 40,     // Peso para aceitação pessoal
  PERSONAL_HISTORY: 30,    // Peso para histórico pessoal
  COMMUNITY_BLOCK: 25,     // Peso para bloqueios da comunidade
  COMMUNITY_REPORTS: 20,   // Peso para denúncias da comunidade
  TIME_DECAY: 0.8,         // Fator de decaimento com o tempo (0-1)
  CALL_FREQUENCY: 15,      // Peso para frequência de chamadas
  CALL_DURATION: 10,       // Peso para duração média das chamadas
  GEOGRAPHIC_MATCH: 5      // Peso para correspondência geográfica
};

// Categorias de pontuação
export const REPUTATION_CATEGORIES = {
  TRUSTED: 'trusted',           // Números confiáveis (80-100)
  PROBABLY_SAFE: 'safe',        // Provavelmente seguros (60-79)
  NEUTRAL: 'neutral',           // Neutros (40-59)
  SUSPICIOUS: 'suspicious',     // Suspeitos (20-39)
  DANGEROUS: 'dangerous',       // Perigosos/spam (0-19)
  UNKNOWN: 'unknown'            // Pontuação desconhecida
};

/**
 * Serviço de cálculo de pontuação de reputação
 */
const reputationScore = {
  /**
   * Calcula a pontuação de reputação para um número de telefone
   * @param {string} phoneNumber - Número a avaliar
   * @param {Object} personalData - Dados pessoais do usuário sobre o número
   * @param {Object} communityData - Dados da comunidade sobre o número
   * @returns {Object} Pontuação e categoria de reputação
   */
  computeScore(phoneNumber, personalData = {}, communityData = {}) {
    // Se não houver dados suficientes, retorna pontuação desconhecida
    if (Object.keys(personalData).length === 0 && Object.keys(communityData).length === 0) {
      return {
        score: null,
        category: REPUTATION_CATEGORIES.UNKNOWN,
        confidence: 0,
        factors: []
      };
    }
    
    // Inicializa pontuação base e fatores
    let baseScore = 50; // Pontuação inicial neutra
    const factors = [];
    let personalInfluence = 0;
    let communityInfluence = 0;
    
    // ===== Processa dados pessoais =====
    if (personalData) {
      // Se o usuário bloqueou este número
      if (personalData.blocked) {
        baseScore -= WEIGHTS.PERSONAL_BLOCK;
        factors.push({
          factor: 'blocked_by_user',
          impact: -WEIGHTS.PERSONAL_BLOCK,
          description: 'Número bloqueado por você'
        });
        personalInfluence += WEIGHTS.PERSONAL_BLOCK;
      }
      
      // Se o usuário já aceitou chamadas deste número
      if (personalData.accepted) {
        baseScore += WEIGHTS.PERSONAL_ACCEPT;
        factors.push({
          factor: 'accepted_by_user',
          impact: WEIGHTS.PERSONAL_ACCEPT,
          description: 'Você aceitou chamadas deste número'
        });
        personalInfluence += WEIGHTS.PERSONAL_ACCEPT;
      }
      
      // Analisa histórico pessoal
      if (personalData.history && personalData.history.length > 0) {
        let historyImpact = 0;
        const historyEvents = personalData.history.length;
        const recentEvents = personalData.history.filter(h => 
          new Date().getTime() - new Date(h.date).getTime() < 30 * 24 * 60 * 60 * 1000 // 30 dias
        ).length;
        
        // Avalia impacto do histórico (mais eventos recentes = maior impacto)
        historyImpact = (WEIGHTS.PERSONAL_HISTORY * recentEvents) / Math.max(historyEvents, 1);
        
        if (historyImpact !== 0) {
          baseScore += historyImpact;
          factors.push({
            factor: 'call_history',
            impact: historyImpact,
            description: `Histórico de ${historyEvents} chamadas (${recentEvents} recentes)`
          });
          personalInfluence += Math.abs(historyImpact);
        }
      }
      
      // Analisa duração média das chamadas (chamadas longas geralmente são legítimas)
      if (personalData.avgDuration && personalData.avgDuration > 0) {
        // Normalize: 1min = +5, 5min+ = +10
        const durationImpact = Math.min(WEIGHTS.CALL_DURATION, 
          (personalData.avgDuration / 60) * (WEIGHTS.CALL_DURATION / 5));
        
        baseScore += durationImpact;
        factors.push({
          factor: 'call_duration',
          impact: durationImpact,
          description: `Duração média de chamada: ${Math.round(personalData.avgDuration / 60)} minutos`
        });
        personalInfluence += durationImpact;
      }
    }
    
    // ===== Processa dados da comunidade =====
    if (communityData) {
      // Impacto dos bloqueios da comunidade
      if (communityData.blockCount) {
        // Aplica uma curva logarítmica para evitar que poucos bloqueios tenham muito impacto
        const blockImpact = -Math.min(
          WEIGHTS.COMMUNITY_BLOCK,
          WEIGHTS.COMMUNITY_BLOCK * Math.log10(communityData.blockCount + 1) / 2
        );
        
        baseScore += blockImpact;
        factors.push({
          factor: 'community_blocks',
          impact: blockImpact,
          description: `Bloqueado por ${communityData.blockCount} pessoas`
        });
        communityInfluence += Math.abs(blockImpact);
      }
      
      // Impacto das denúncias da comunidade
      if (communityData.reportCount) {
        // Pondera por categoria/severidade da denúncia
        let reportImpact = -Math.min(
          WEIGHTS.COMMUNITY_REPORTS,
          WEIGHTS.COMMUNITY_REPORTS * Math.log10(communityData.reportCount + 1) / 2
        );
        
        // Ajusta por severidade das denúncias
        if (communityData.reportSeverity) {
          reportImpact *= (communityData.reportSeverity / 5); // Normalizado para escala 0-5
        }
        
        baseScore += reportImpact;
        factors.push({
          factor: 'community_reports',
          impact: reportImpact,
          description: `Denunciado por ${communityData.reportCount} pessoas`
        });
        communityInfluence += Math.abs(reportImpact);
      }
      
      // Correspondência geográfica (DDD local é geralmente mais confiável)
      if (communityData.localMatch) {
        baseScore += WEIGHTS.GEOGRAPHIC_MATCH;
        factors.push({
          factor: 'geographic_match',
          impact: WEIGHTS.GEOGRAPHIC_MATCH,
          description: 'Número de sua região'
        });
        communityInfluence += WEIGHTS.GEOGRAPHIC_MATCH;
      }
    }
    
    // Assegura que a pontuação esteja no intervalo 0-100
    const normalizedScore = Math.max(0, Math.min(100, Math.round(baseScore)));
    
    // Determina categoria com base na pontuação
    let category;
    if (normalizedScore >= 80) {
      category = REPUTATION_CATEGORIES.TRUSTED;
    } else if (normalizedScore >= 60) {
      category = REPUTATION_CATEGORIES.PROBABLY_SAFE;
    } else if (normalizedScore >= 40) {
      category = REPUTATION_CATEGORIES.NEUTRAL;
    } else if (normalizedScore >= 20) {
      category = REPUTATION_CATEGORIES.SUSPICIOUS;
    } else {
      category = REPUTATION_CATEGORIES.DANGEROUS;
    }
    
    // Calcula nível de confiança com base na quantidade de dados disponíveis
    // Mais dados = mais confiança na pontuação
    const totalInfluence = personalInfluence + communityInfluence;
    const confidence = Math.min(100, Math.round((totalInfluence / 100) * 100));
    
    return {
      score: normalizedScore,
      category,
      confidence,
      factors,
      meta: {
        personalInfluence,
        communityInfluence,
        phoneNumber,
        updatedAt: new Date().toISOString()
      }
    };
  },
  
  /**
   * Calcula a variação na pontuação com base em um novo evento
   * @param {Object} currentScore - Pontuação atual
   * @param {Object} newEvent - Novo evento a considerar
   * @returns {Object} Nova pontuação
   */
  updateScoreWithEvent(currentScore, newEvent) {
    // Implementação do ajuste de pontuação com base em novos eventos
    // ...
    
    return updatedScore;
  },
  
  /**
   * Determina a ação recomendada com base na pontuação
   * @param {Object} scoreData - Dados da pontuação
   * @param {Object} userPreferences - Preferências do usuário
   * @returns {string} Ação recomendada (block, allow, ask)
   */
  getRecommendedAction(scoreData, userPreferences = {}) {
    // Se não há pontuação, não pode recomendar
    if (!scoreData.score) {
      return 'ask';
    }
    
    // Ajusta os limiares com base nas preferências do usuário
    const thresholds = {
      trustThreshold: userPreferences.trustThreshold || 75,
      blockThreshold: userPreferences.blockThreshold || 30
    };
    
    // Determina ação baseada nos limiares
    if (scoreData.score >= thresholds.trustThreshold) {
      return 'allow';
    } else if (scoreData.score <= thresholds.blockThreshold) {
      return 'block';
    } else {
      return 'ask';
    }
  }
};

export default reputationScore;
