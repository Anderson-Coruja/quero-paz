/**
 * Sistema de Análise de Padrões para o Quero Paz
 * 
 * Este serviço implementa um sistema simples de aprendizado para identificar
 * padrões de chamadas indesejadas e sugerir regras de bloqueio automático.
 */

import storage from '../storage';

// Constantes para limites e configurações
const CALL_HISTORY_LIMIT = 100; // Limite de histórico para análise
const FREQUENCY_THRESHOLD = 3;  // Número mínimo de chamadas para identificar um padrão
const TIME_WINDOW = 24 * 60 * 60 * 1000; // 24 horas em milissegundos

/**
 * Serviço de análise de padrões de chamadas
 */
const patternAnalysis = {
  /**
   * Análise básica de frequência para identificar números repetitivos
   * @returns {Promise<Array>} Lista de números com alta frequência de chamadas
   */
  async analyzeFrequencyPatterns() {
    // Obtém histórico de chamadas silenciadas
    const silencedCalls = await storage.getSilencedCalls();
    
    // Extrai apenas os números de telefone
    const phoneNumbers = silencedCalls.map(call => {
      const parts = call.includes(' - ') ? call.split(' - ') : [call, ''];
      return parts[0].trim();
    });
    
    // Conta a frequência de cada número
    const frequency = {};
    phoneNumbers.forEach(number => {
      frequency[number] = (frequency[number] || 0) + 1;
    });
    
    // Filtra apenas os números que excedem o limite de frequência
    const frequentCallers = Object.keys(frequency)
      .filter(number => frequency[number] >= FREQUENCY_THRESHOLD)
      .map(number => ({
        phoneNumber: number,
        frequency: frequency[number],
        confidence: Math.min(frequency[number] / FREQUENCY_THRESHOLD * 100, 100),
        suggestedAction: 'block'
      }));
    
    return frequentCallers;
  },
  
  /**
   * Análise de padrões temporais (horários de chamadas)
   * @returns {Promise<Array>} Padrões temporais identificados
   */
  async analyzeTimePatterns() {
    const silencedCalls = await storage.getSilencedCalls();
    const timePatterns = [];
    
    // Mapa para armazenar contagens por hora do dia
    const hourlyDistribution = Array(24).fill(0);
    
    // Processa cada chamada para identificar padrões de hora
    silencedCalls.forEach(call => {
      // Extrai informações de tempo das chamadas (formato: "... às HH:MM")
      const timeMatch = call.match(/às (\d{2}):(\d{2})/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1], 10);
        hourlyDistribution[hour]++;
      }
    });
    
    // Identifica horas com alta frequência de chamadas
    for (let hour = 0; hour < 24; hour++) {
      if (hourlyDistribution[hour] >= FREQUENCY_THRESHOLD) {
        timePatterns.push({
          hour,
          frequency: hourlyDistribution[hour],
          confidence: Math.min(hourlyDistribution[hour] / FREQUENCY_THRESHOLD * 100, 100),
          suggestedAction: 'create_time_rule'
        });
      }
    }
    
    return timePatterns;
  },
  
  /**
   * Analisa padrões baseados em prefixos comuns (ex: mesmo DDD ou início do número)
   * @returns {Promise<Array>} Padrões de prefixo identificados
   */
  async analyzePrefixPatterns() {
    const silencedCalls = await storage.getSilencedCalls();
    const prefixPatterns = {};
    
    // Extrai números e agrupa por prefixos (2 e 3 dígitos)
    silencedCalls.forEach(call => {
      const parts = call.includes(' - ') ? call.split(' - ') : [call, ''];
      const phoneNumber = parts[0].trim().replace(/\D/g, ''); // Remove não-dígitos
      
      if (phoneNumber.length >= 2) {
        // Prefixo de 2 dígitos (geralmente DDD)
        const prefix2 = phoneNumber.substring(0, 2);
        prefixPatterns[prefix2] = (prefixPatterns[prefix2] || 0) + 1;
        
        // Prefixo de 3 dígitos (pode identificar operadoras ou tipos de serviço)
        if (phoneNumber.length >= 3) {
          const prefix3 = phoneNumber.substring(0, 3);
          prefixPatterns[prefix3] = (prefixPatterns[prefix3] || 0) + 1;
        }
      }
    });
    
    // Filtra os prefixos mais comuns
    const significantPrefixes = Object.keys(prefixPatterns)
      .filter(prefix => prefixPatterns[prefix] >= FREQUENCY_THRESHOLD)
      .map(prefix => ({
        prefix,
        length: prefix.length,
        frequency: prefixPatterns[prefix],
        confidence: Math.min(prefixPatterns[prefix] / FREQUENCY_THRESHOLD * 100, 100),
        suggestedAction: 'create_prefix_rule'
      }))
      .sort((a, b) => b.frequency - a.frequency); // Ordena por frequência
    
    return significantPrefixes;
  },
  
  /**
   * Gera recomendações de bloqueio com base nas análises
   * @returns {Promise<Array>} Recomendações de bloqueio
   */
  async generateBlockingRecommendations() {
    const [frequencyPatterns, timePatterns, prefixPatterns] = await Promise.all([
      this.analyzeFrequencyPatterns(),
      this.analyzeTimePatterns(),
      this.analyzePrefixPatterns()
    ]);
    
    // Combina todas as recomendações
    const recommendations = [
      // Recomendações específicas de número
      ...frequencyPatterns.map(pattern => ({
        type: 'number',
        value: pattern.phoneNumber,
        reason: `Ligou ${pattern.frequency} vezes`,
        confidence: pattern.confidence,
        action: 'block_number'
      })),
      
      // Recomendações baseadas em hora
      ...timePatterns.map(pattern => ({
        type: 'time',
        value: `${pattern.hour}:00`,
        reason: `${pattern.frequency} chamadas indesejadas neste horário`,
        confidence: pattern.confidence,
        action: 'block_time'
      })),
      
      // Recomendações baseadas em prefixo
      ...prefixPatterns.filter(p => p.confidence > 70).map(pattern => ({
        type: 'prefix',
        value: pattern.prefix,
        reason: `${pattern.frequency} chamadas com este prefixo`,
        confidence: pattern.confidence,
        action: 'block_prefix'
      }))
    ];
    
    // Ordena por confiança (mais confiável primeiro)
    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }
};

export default patternAnalysis;
