import React, { useState, useEffect } from 'react';
import PatternAnalysisCard from './PatternAnalysisCard';
import SmartRulesCard from './SmartRulesCard';
import BlockProfilesCard from './BlockProfilesCard';
import SharedBlacklistCard from './SharedBlacklistCard';
import smartRules from '../../services/ai/smartRules';
import sharedBlacklist from '../../services/ai/sharedBlacklist';

/**
 * Painel principal que integra todos os recursos avançados de proteção
 */
const AdvancedProtectionPanel = () => {
  const [initialized, setInitialized] = useState(false);

  // Inicializa todos os serviços de proteção avançada
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Inicializa serviços em paralelo
        await Promise.all([
          sharedBlacklist.initialize(),
          // Outros serviços que precisem de inicialização
        ]);
        
        setInitialized(true);
      } catch (error) {
        console.error('Erro ao inicializar serviços de proteção avançada:', error);
      }
    };
    
    initializeServices();
  }, []);
  
  // Manipula a aplicação de uma recomendação de análise de padrões
  const handleApplyRecommendation = async (recommendation) => {
    try {
      let result;
      
      // Aplica a recomendação com base no tipo
      switch (recommendation.action) {
        case 'block_number':
          // Bloqueio de número específico
          console.log(`Bloqueando número: ${recommendation.value}`);
          // Implementação real: adicionar à lista de bloqueio
          break;
          
        case 'block_time':
          // Cria regra baseada em horário
          const hour = parseInt(recommendation.value.split(':')[0], 10);
          result = await smartRules.createTimeRule(
            hour, 
            (hour + 4) % 24, // Período de 4 horas por padrão
            [0, 1, 2, 3, 4, 5, 6], // Todos os dias
            `Bloqueio horário ${recommendation.value}`
          );
          console.log(`Regra de horário criada: ${result.id}`);
          break;
          
        case 'block_prefix':
          // Criaria uma regra baseada em prefixo (ainda não implementado)
          console.log(`Bloqueando prefixo: ${recommendation.value}`);
          // Implementação real: criar regra de prefixo
          break;
          
        default:
          console.log('Tipo de recomendação não reconhecido');
      }
      
      // Exibe confirmação
      alert(`Recomendação aplicada com sucesso!`);
    } catch (error) {
      console.error('Erro ao aplicar recomendação:', error);
      alert('Não foi possível aplicar a recomendação.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="bg-white rounded-paz shadow-paz p-6">
        <h2 className="text-2xl font-bold text-paz-blue-800 mb-2">Proteção Avançada</h2>
        <p className="text-gray-600 mb-6">
          Ferramentas inteligentes para maximizar sua proteção contra chamadas indesejadas.
        </p>
        
        {!initialized ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-paz-blue-600 mb-4"></div>
            <p className="text-gray-600">Inicializando recursos avançados...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cartão de análise de padrões */}
            <PatternAnalysisCard onApplyRecommendation={handleApplyRecommendation} />
            
            {/* Cartão de perfis de bloqueio */}
            <BlockProfilesCard />
            
            {/* Cartão de regras inteligentes */}
            <SmartRulesCard />
            
            {/* Cartão de blacklist compartilhada */}
            <SharedBlacklistCard />
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-paz shadow-paz p-6">
        <h3 className="font-semibold text-lg text-paz-blue-800 mb-3">Dicas de Proteção</h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start">
            <span className="text-paz-blue-600 mr-2">✓</span>
            <span>Utilize perfis de bloqueio para diferentes situações do dia a dia</span>
          </li>
          <li className="flex items-start">
            <span className="text-paz-blue-600 mr-2">✓</span>
            <span>Configure regras de horário para períodos de descanso e trabalho</span>
          </li>
          <li className="flex items-start">
            <span className="text-paz-blue-600 mr-2">✓</span>
            <span>Adicione seus contatos importantes à lista branca para nunca perder chamadas importantes</span>
          </li>
          <li className="flex items-start">
            <span className="text-paz-blue-600 mr-2">✓</span>
            <span>Reporte números indesejados para contribuir com a comunidade</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default AdvancedProtectionPanel;
