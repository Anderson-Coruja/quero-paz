/**
 * Utilitário de monitoramento de performance
 * Sistema leve para rastrear o tempo de execução de operações críticas
 */

// Constante para definir limite de aviso em ms
const WARNING_THRESHOLD = 100;

// Objeto para rastrear performance
const perfTracker = {
  /**
   * Inicia a medição de tempo para uma operação
   * @param {string} label - Identificador único para a operação
   */
  start: (label) => {
    if (!window.performance) return;
    performance.mark(`${label}-start`);
  },
  
  /**
   * Finaliza a medição de tempo para uma operação
   * @param {string} label - Mesmo identificador usado em start()
   * @param {number} customThreshold - Limite personalizado em ms (opcional)
   */
  end: (label, customThreshold) => {
    if (!window.performance) return;
    
    const threshold = customThreshold || WARNING_THRESHOLD;
    
    try {
      // Cria uma marca de fim
      performance.mark(`${label}-end`);
      
      // Cria uma medida entre as marcas
      performance.measure(label, `${label}-start`, `${label}-end`);
      
      // Obtém a medição
      const measure = performance.getEntriesByName(label, 'measure')[0];
      
      // Se demorou mais do que o limite, emite aviso no console
      if (measure && measure.duration > threshold) {
        console.warn(`⚠️ Performance: ${label} levou ${measure.duration.toFixed(2)}ms (limite: ${threshold}ms)`);
        
        // Registra em logs para análise futura
        if (window.__perfLogs) {
          window.__perfLogs.push({
            label,
            duration: measure.duration,
            timestamp: Date.now()
          });
        } else {
          window.__perfLogs = [{
            label,
            duration: measure.duration,
            timestamp: Date.now()
          }];
        }
      }
      
      // Limpa as entradas para não sobrecarregar a memória
      performance.clearMarks(`${label}-start`);
      performance.clearMarks(`${label}-end`);
      performance.clearMeasures(label);
      
      return measure ? measure.duration : null;
    } catch (error) {
      console.error('Erro ao medir performance:', error);
      return null;
    }
  },
  
  /**
   * Mede o tempo de execução de uma função async
   * @param {string} label - Identificador para a operação
   * @param {Function} fn - Função assíncrona a ser executada
   * @returns {Promise<*>} - Resultado da função
   */
  async measure(label, fn) {
    this.start(label);
    try {
      const result = await fn();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  },
  
  /**
   * Obtém logs de performance
   * @returns {Array} - Array com os logs de performance
   */
  getLogs() {
    return window.__perfLogs || [];
  },
  
  /**
   * Limpa logs de performance
   */
  clearLogs() {
    window.__perfLogs = [];
  }
};

export default perfTracker;
