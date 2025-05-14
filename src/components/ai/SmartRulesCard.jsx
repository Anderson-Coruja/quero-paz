import React, { useState, useEffect, useCallback } from 'react';
import smartRules, { RULE_TYPES, RULE_STATUS } from '../../services/ai/smartRules';

/**
 * Componente que exibe e gerencia regras inteligentes
 */
const SmartRulesCard = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // Carrega regras existentes
  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const rulesList = await smartRules.getRules();
      setRules(rulesList);
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // Atualiza status de uma regra
  const handleToggleRule = async (ruleId, currentStatus) => {
    try {
      const newStatus = currentStatus === RULE_STATUS.ACTIVE 
        ? RULE_STATUS.INACTIVE 
        : RULE_STATUS.ACTIVE;
        
      await smartRules.updateRule(ruleId, { status: newStatus });
      loadRules(); // Recarrega a lista para refletir a mudança
    } catch (error) {
      console.error('Erro ao atualizar regra:', error);
    }
  };

  // Remove uma regra
  const handleDeleteRule = async (ruleId) => {
    try {
      await smartRules.deleteRule(ruleId);
      loadRules(); // Recarrega a lista para refletir a mudança
    } catch (error) {
      console.error('Erro ao excluir regra:', error);
    }
  };

  // Cria uma nova regra baseada em horário
  const handleCreateTimeRule = async () => {
    try {
      await smartRules.createTimeRule(22, 7, [0, 1, 2, 3, 4, 5, 6], 'Silêncio noturno');
      loadRules(); // Recarrega a lista para mostrar a nova regra
    } catch (error) {
      console.error('Erro ao criar regra de horário:', error);
    }
  };

  // Cria uma nova regra de lista branca
  const handleCreateWhitelistRule = async () => {
    try {
      await smartRules.createWhitelistRule([], 'Contatos prioritários');
      loadRules(); // Recarrega a lista para mostrar a nova regra
    } catch (error) {
      console.error('Erro ao criar regra de lista branca:', error);
    }
  };

  // Cria uma nova regra baseada em duração
  const handleCreateDurationRule = async () => {
    try {
      await smartRules.createDurationRule(5, 3, 'Bloqueio anti-telemarketing');
      loadRules(); // Recarrega a lista para mostrar a nova regra
    } catch (error) {
      console.error('Erro ao criar regra de duração:', error);
    }
  };

  // Renderiza ícone para o tipo de regra
  const renderRuleIcon = (type) => {
    switch (type) {
      case RULE_TYPES.TIME_BASED:
        return <span className="text-lg">🕒</span>;
      case RULE_TYPES.WHITELIST:
        return <span className="text-lg">✅</span>;
      case RULE_TYPES.DURATION:
        return <span className="text-lg">⏱️</span>;
      case RULE_TYPES.PREFIX:
        return <span className="text-lg">📞</span>;
      default:
        return <span className="text-lg">🛡️</span>;
    }
  };

  // Formata a descrição da regra para exibição
  const formatRuleDescription = (rule) => {
    switch (rule.type) {
      case RULE_TYPES.TIME_BASED:
        return `${rule.config.startHour}h às ${rule.config.endHour}h`;
      case RULE_TYPES.WHITELIST:
        const count = rule.config.phoneNumbers?.length || 0;
        return `${count} contatos permitidos`;
      case RULE_TYPES.DURATION:
        return `Chamadas < ${rule.config.maxDuration}s`;
      case RULE_TYPES.PREFIX:
        return `Prefixo: ${rule.config.prefix}`;
      default:
        return "";
    }
  };

  return (
    <div className="bg-white rounded-paz shadow-paz overflow-hidden transition-all mb-4">
      <div 
        className="bg-paz-blue-50 p-4 flex justify-between items-center cursor-pointer border-b border-paz-blue-100"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <div className="text-paz-blue-600 p-2 rounded-full bg-paz-blue-100 mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-lg text-paz-blue-800">Regras Inteligentes</h3>
            <p className="text-sm text-paz-blue-600">
              {rules.filter(r => r.status === RULE_STATUS.ACTIVE).length} regras ativas
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
          ) : (
            <div>
              {/* Lista de regras existentes */}
              {rules.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {rules.map((rule) => (
                    <div 
                      key={rule.id} 
                      className={`p-3 rounded-lg border ${
                        rule.status === RULE_STATUS.ACTIVE 
                          ? 'border-paz-blue-500 bg-paz-blue-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center">
                          {renderRuleIcon(rule.type)}
                          <div className="ml-2">
                            <h4 className="font-medium">{rule.name}</h4>
                            <p className="text-sm text-gray-600">{formatRuleDescription(rule)}</p>
                          </div>
                        </div>
                        
                        {/* Toggle Switch */}
                        <div className="relative inline-block w-10 align-middle select-none">
                          <input 
                            type="checkbox" 
                            name={`toggle-${rule.id}`} 
                            id={`toggle-${rule.id}`}
                            className="sr-only peer"
                            checked={rule.status === RULE_STATUS.ACTIVE}
                            onChange={() => handleToggleRule(rule.id, rule.status)}
                          />
                          <label 
                            htmlFor={`toggle-${rule.id}`}
                            className="block h-6 overflow-hidden rounded-full bg-gray-300 cursor-pointer peer-checked:bg-paz-blue-600"
                          >
                            <span className="absolute transform transition-transform duration-200 ease-in-out left-1 top-1 bg-white rounded-full h-4 w-4 peer-checked:translate-x-4"></span>
                          </label>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="mt-3 flex justify-end space-x-2">
                        <button 
                          onClick={() => setEditingRule(rule)}
                          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm rounded transition"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => handleDeleteRule(rule.id)}
                          className="px-3 py-1 bg-paz-red-100 hover:bg-paz-red-200 text-paz-red-800 text-sm rounded transition"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 mb-6">
                  <p className="text-gray-600">
                    Nenhuma regra inteligente configurada.
                    Crie uma regra para começar a personalizar o bloqueio.
                  </p>
                </div>
              )}

              {/* Add new rule section */}
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h4 className="font-medium text-paz-blue-800 mb-3">Adicionar Regra</h4>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={handleCreateTimeRule}
                    className="flex flex-col items-center justify-center p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded transition"
                  >
                    <span className="text-xl mb-1">🕒</span>
                    <span className="text-sm">Horário</span>
                  </button>
                  <button 
                    onClick={handleCreateWhitelistRule}
                    className="flex flex-col items-center justify-center p-3 bg-green-50 hover:bg-green-100 text-green-800 rounded transition"
                  >
                    <span className="text-xl mb-1">✅</span>
                    <span className="text-sm">Lista Branca</span>
                  </button>
                  <button 
                    onClick={handleCreateDurationRule}
                    className="flex flex-col items-center justify-center p-3 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded transition"
                  >
                    <span className="text-xl mb-1">⏱️</span>
                    <span className="text-sm">Duração</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartRulesCard;
