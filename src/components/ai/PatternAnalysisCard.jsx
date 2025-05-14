import React, { useState, useEffect, useCallback } from 'react';
import patternAnalysis from '../../services/ai/patternAnalysis';

/**
 * Componente que exibe resultados da análise de padrões e recomendações
 */
const PatternAnalysisCard = ({ onApplyRecommendation }) => {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [expanded, setExpanded] = useState(false);

  // Carrega recomendações ao montar o componente
  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const results = await patternAnalysis.generateBlockingRecommendations();
      setRecommendations(results);
    } catch (error) {
      console.error('Erro ao carregar recomendações:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Formata a porcentagem de confiança para exibição
  const getConfidenceLabel = (confidence) => {
    if (confidence >= 80) return { text: 'Alta', class: 'bg-paz-green-100 text-paz-green-800' };
    if (confidence >= 50) return { text: 'Média', class: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Baixa', class: 'bg-gray-100 text-gray-800' };
  };

  // Formata o tipo de recomendação para exibição
  const getTypeLabel = (type) => {
    switch (type) {
      case 'number': return { text: 'Número', icon: '📱' };
      case 'time': return { text: 'Horário', icon: '🕒' };
      case 'prefix': return { text: 'Prefixo', icon: '🔢' };
      default: return { text: 'Outro', icon: '📋' };
    }
  };

  // Manipula a aplicação de uma recomendação
  const handleApply = (recommendation) => {
    if (onApplyRecommendation) {
      onApplyRecommendation(recommendation);
    }
  };

  return (
    <div className="bg-white rounded-paz shadow-paz overflow-hidden transition-all">
      <div 
        className="bg-paz-blue-50 p-4 flex justify-between items-center cursor-pointer border-b border-paz-blue-100"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <div className="text-paz-blue-600 p-2 rounded-full bg-paz-blue-100 mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-lg text-paz-blue-800">Análise Inteligente</h3>
            <p className="text-sm text-paz-blue-600">
              {loading ? 'Analisando padrões...' : 
                `${recommendations.length} recomendações encontradas`}
            </p>
          </div>
        </div>
        <div className="text-paz-blue-600">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-6 w-6 transition-transform ${expanded ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-paz-blue-600"></div>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Nossa análise identificou padrões em chamadas bloqueadas e sugere as seguintes ações:
              </p>
              
              {recommendations.slice(0, 5).map((rec, index) => {
                const confidenceLabel = getConfidenceLabel(rec.confidence);
                const typeLabel = getTypeLabel(rec.type);
                
                return (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        <span className="text-xl mr-2">{typeLabel.icon}</span>
                        <div>
                          <h4 className="font-medium">{rec.value}</h4>
                          <p className="text-sm text-gray-600">{rec.reason}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${confidenceLabel.class}`}>
                        {confidenceLabel.text}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button 
                        onClick={() => handleApply(rec)}
                        className="px-3 py-1 bg-paz-blue-600 hover:bg-paz-blue-700 text-white text-sm rounded transition"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {recommendations.length > 5 && (
                <div className="text-center pt-2">
                  <button className="text-sm text-paz-blue-600 hover:text-paz-blue-800">
                    Ver mais {recommendations.length - 5} recomendações
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-600">
                Nenhum padrão significativo identificado ainda.
                Continue bloqueando chamadas para melhorar as recomendações.
              </p>
              <button 
                onClick={loadRecommendations}
                className="mt-4 px-4 py-2 bg-paz-blue-100 text-paz-blue-700 rounded-lg hover:bg-paz-blue-200 transition"
              >
                Atualizar análise
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatternAnalysisCard;
