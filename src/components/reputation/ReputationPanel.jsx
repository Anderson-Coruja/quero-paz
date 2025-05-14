import React, { useState, useEffect, useCallback } from 'react';
import reputationManager, { EVENT_TYPES, REPORT_TYPES } from '../../services/reputation/reputationManager';
import { formatPhoneNumber, detectNumberType } from '../../services/reputation/reputationUtils';
import { REPUTATION_CATEGORIES } from '../../services/reputation/reputationScore';
import ReputationSyncSettings from './ReputationSyncSettings';
import ReputationSync from '../../services/reputation/reputationSync';

/**
 * Painel de Sistema de Reputação de Números
 */
const ReputationPanel = () => {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recentQueries, setRecentQueries] = useState([]);
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'settings'

  // Inicializa o sistema de reputação
  useEffect(() => {
    const initialize = async () => {
      await reputationManager.initialize();
      // Inicializa também o sistema de sincronização de reputação
      await ReputationSync.initialize();
      setInitialized(true);
      
      // Carrega estatísticas iniciais
      await loadStats();
      
      // Emula histórico de consultas recentes (em produção, seria persistido)
      setRecentQueries([
        { number: '11987654321', timestamp: new Date(Date.now() - 3600000).toISOString() },
        { number: '11912345678', timestamp: new Date(Date.now() - 86400000).toISOString() },
        { number: '2140042000', timestamp: new Date(Date.now() - 172800000).toISOString() }
      ]);
    };
    
    initialize();
  }, []);

  // Carrega estatísticas
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const reputationStats = await reputationManager.getStatistics();
      setStats(reputationStats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Pesquisa reputação de um número
  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 8) {
      alert('Digite um número válido com pelo menos 8 dígitos');
      return;
    }
    
    setIsSearching(true);
    try {
      // Obtém reputação do número
      const result = await reputationManager.getReputation(searchQuery);
      setSearchResult(result);
      
      // Adiciona à lista de consultas recentes (sem duplicados)
      setRecentQueries(prev => {
        const exists = prev.some(q => q.number === searchQuery);
        if (!exists) {
          const newQuery = { number: searchQuery, timestamp: new Date().toISOString() };
          return [newQuery, ...prev].slice(0, 5);
        }
        return prev;
      });
    } catch (error) {
      console.error('Erro ao pesquisar número:', error);
      setSearchResult({ error: error.message });
    } finally {
      setIsSearching(false);
    }
  };

  // Reporta um número
  const handleReport = async (type) => {
    if (!searchResult || !searchResult.phoneNumber) {
      alert('Pesquise um número primeiro');
      return;
    }
    
    try {
      const reportType = REPORT_TYPES[type] || REPORT_TYPES.SPAM;
      const result = await reputationManager.recordEvent(
        searchResult.phoneNumber,
        EVENT_TYPES.REPORT,
        {
          reportType: reportType.value,
          reportSeverity: reportType.severity,
          reportDetails: 'Reportado manualmente pelo usuário'
        }
      );
      
      if (result.success) {
        alert(`Número ${formatPhoneNumber(searchResult.phoneNumber)} reportado com sucesso!`);
        
        // Atualiza resultado da pesquisa e estatísticas
        const updatedResult = await reputationManager.getReputation(searchResult.phoneNumber, true);
        setSearchResult(updatedResult);
        await loadStats();
      } else {
        alert(`Erro ao reportar: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao reportar número:', error);
      alert('Ocorreu um erro ao reportar este número');
    }
  };

  // Bloqueia um número
  const handleBlock = async () => {
    if (!searchResult || !searchResult.phoneNumber) {
      alert('Pesquise um número primeiro');
      return;
    }
    
    try {
      const result = await reputationManager.recordEvent(
        searchResult.phoneNumber,
        EVENT_TYPES.BLOCK,
        {
          reason: 'Bloqueado manualmente pelo usuário',
          timestamp: new Date().toISOString()
        }
      );
      
      if (result.success) {
        alert(`Número ${formatPhoneNumber(searchResult.phoneNumber)} bloqueado com sucesso!`);
        
        // Atualiza resultado da pesquisa e estatísticas
        const updatedResult = await reputationManager.getReputation(searchResult.phoneNumber, true);
        setSearchResult(updatedResult);
        await loadStats();
      } else {
        alert(`Erro ao bloquear: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao bloquear número:', error);
      alert('Ocorreu um erro ao bloquear este número');
    }
  };

  // Aprova um número
  const handleApprove = async () => {
    if (!searchResult || !searchResult.phoneNumber) {
      alert('Pesquise um número primeiro');
      return;
    }
    
    try {
      const result = await reputationManager.recordEvent(
        searchResult.phoneNumber,
        EVENT_TYPES.ALLOW,
        {
          reason: 'Aprovado manualmente pelo usuário',
          timestamp: new Date().toISOString()
        }
      );
      
      if (result.success) {
        alert(`Número ${formatPhoneNumber(searchResult.phoneNumber)} adicionado à lista branca!`);
        
        // Atualiza resultado da pesquisa e estatísticas
        const updatedResult = await reputationManager.getReputation(searchResult.phoneNumber, true);
        setSearchResult(updatedResult);
        await loadStats();
      } else {
        alert(`Erro ao aprovar: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao aprovar número:', error);
      alert('Ocorreu um erro ao aprovar este número');
    }
  };

  // Renderiza badge de categoria
  const renderCategoryBadge = (category) => {
    const categoryMap = {
      [REPUTATION_CATEGORIES.TRUSTED]: { bg: 'bg-green-100', text: 'text-green-800', label: 'Confiável' },
      [REPUTATION_CATEGORIES.PROBABLY_SAFE]: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Provavelmente Seguro' },
      [REPUTATION_CATEGORIES.NEUTRAL]: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Neutro' },
      [REPUTATION_CATEGORIES.SUSPICIOUS]: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Suspeito' },
      [REPUTATION_CATEGORIES.DANGEROUS]: { bg: 'bg-red-100', text: 'text-red-800', label: 'Perigoso' },
      [REPUTATION_CATEGORIES.UNKNOWN]: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Desconhecido' }
    };
    
    const config = categoryMap[category] || categoryMap[REPUTATION_CATEGORIES.UNKNOWN];
    
    return (
      <span className={`${config.bg} ${config.text} text-xs font-medium px-2.5 py-0.5 rounded`}>
        {config.label}
      </span>
    );
  };

  // Renderiza ícone de confiança
  const renderConfidenceIcon = (confidence) => {
    if (confidence >= 80) {
      return <span title="Alta confiança">🟢</span>;
    } else if (confidence >= 50) {
      return <span title="Média confiança">🟡</span>;
    } else {
      return <span title="Baixa confiança">⚪</span>;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="bg-white rounded-paz shadow-paz p-6">
        <h2 className="text-2xl font-bold text-paz-blue-800 mb-2">Sistema de Reputação Distribuído</h2>
        <p className="text-gray-600 mb-4">
          Avalie a confiabilidade de números telefônicos com base em dados pessoais e comunitários.
        </p>
        
        {/* Abas de navegação */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 font-medium text-sm mr-2 ${activeTab === 'search' 
              ? 'text-paz-blue-600 border-b-2 border-paz-blue-600' 
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            Pesquisar Reputação
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'settings' 
              ? 'text-paz-blue-600 border-b-2 border-paz-blue-600' 
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            Configurações de Sincronização
          </button>
        </div>
        
        {!initialized ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-paz-blue-600"></div>
          </div>
        ) : activeTab === 'settings' ? (
          <ReputationSyncSettings />
        ) : (
          <>
            {/* Estatísticas */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="font-medium text-lg mb-3">Estatísticas do Sistema</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded shadow-sm">
                  <div className="text-sm text-gray-500">Números analisados</div>
                  <div className="text-xl font-semibold text-paz-blue-700">{stats?.totalNumbers || 0}</div>
                </div>
                <div className="bg-white p-3 rounded shadow-sm">
                  <div className="text-sm text-gray-500">Eventos registrados</div>
                  <div className="text-xl font-semibold text-paz-blue-700">{stats?.totalEvents || 0}</div>
                </div>
              </div>
              
              {/* Distribuição por categoria */}
              {stats && stats.categories && Object.keys(stats.categories).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Distribuição de categorias</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.categories).map(([category, count]) => (
                      <div key={category} className="flex items-center">
                        {renderCategoryBadge(category)}
                        <span className="ml-1 text-sm text-gray-600">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Pesquisa de número */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-lg mb-3">Verificar Reputação</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-paz-blue-500 focus:border-paz-blue-500"
                  placeholder="Digite um número de telefone"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyUp={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-4 py-2 bg-paz-blue-600 text-white rounded-lg hover:bg-paz-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSearching ? 'Verificando...' : 'Verificar'}
                </button>
              </div>
              
              {/* Consultas recentes */}
              {recentQueries.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500">Consultas recentes:</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {recentQueries.map((query, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSearchQuery(query.number);
                          handleSearch();
                        }}
                        className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition-colors"
                      >
                        {formatPhoneNumber(query.number)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Resultado da pesquisa */}
            {searchResult && !searchResult.error && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">
                      {formatPhoneNumber(searchResult.phoneNumber)}
                    </h3>
                    <div className="flex items-center space-x-2">
                      {renderCategoryBadge(searchResult.category)}
                      {renderConfidenceIcon(searchResult.confidence)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Tipo: {detectNumberType(searchResult.phoneNumber) === 'mobile' ? 'Celular' : 
                          detectNumberType(searchResult.phoneNumber) === 'landline' ? 'Fixo' : 
                          detectNumberType(searchResult.phoneNumber) === 'service' ? 'Serviço' : 
                          'Desconhecido'}
                  </div>
                </div>
                
                <div className="p-4">
                  {/* Score e recomendação */}
                  <div className="flex items-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gray-100 mr-4 flex items-center justify-center text-xl font-bold">
                      {searchResult.score !== null ? searchResult.score : '?'}
                    </div>
                    <div>
                      <div className="font-medium">
                        {searchResult.action === 'block' ? 'Recomendação: Bloquear' :
                         searchResult.action === 'allow' ? 'Recomendação: Permitir' :
                         'Recomendação: Perguntar'}
                      </div>
                      <div className="text-sm text-gray-600">
                        Confiança: {searchResult.confidence}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Fatores */}
                  {searchResult.factors && searchResult.factors.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-sm mb-2">Fatores de análise</h4>
                      <ul className="space-y-1 text-sm">
                        {searchResult.factors.map((factor, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className={`mr-2 ${factor.impact > 0 ? 'text-green-600' : factor.impact < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                              {factor.impact > 0 ? '▲' : factor.impact < 0 ? '▼' : '•'}
                            </span>
                            <span>{factor.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Ações */}
                  <div className="flex space-x-2 mt-4">
                    <button
                      onClick={handleBlock}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex-1"
                    >
                      Bloquear
                    </button>
                    <button
                      onClick={handleApprove}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-1"
                    >
                      Aprovar
                    </button>
                  </div>
                  
                  {/* Ações - Confiança */}
                  <div className="mt-3">
                    <button
                      onClick={handleApprove}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mr-2"
                    >
                      Confiar neste número
                    </button>
                    <button
                      onClick={handleBlock}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Bloquear este número
                    </button>
                  </div>
                  
                  {/* Botão para sincronizar evento */}
                  <div className="mt-3 text-right">
                    <button
                      onClick={() => {
                        if (searchResult && searchResult.phoneNumber) {
                          ReputationSync.syncPendingEvents();
                          alert('Sincronizando eventos de reputação...');
                        }
                      }}
                      className="px-3 py-1 bg-paz-blue-100 text-paz-blue-700 text-sm rounded-lg hover:bg-paz-blue-200 transition-colors"
                    >
                      Sincronizar esta reputação
                    </button>
                  </div>
                  
                  {/* Denunciar */}
                  <div className="mt-4">
                    <h4 className="font-medium text-sm mb-2">Denunciar como:</h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleReport('SPAM')}
                        className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm hover:bg-gray-200 transition-colors"
                      >
                        Spam
                      </button>
                      <button
                        onClick={() => handleReport('TELEMARKETING')}
                        className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm hover:bg-gray-200 transition-colors"
                      >
                        Telemarketing
                      </button>
                      <button
                        onClick={() => handleReport('SCAM')}
                        className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm hover:bg-gray-200 transition-colors"
                      >
                        Golpe
                      </button>
                      <button
                        onClick={() => handleReport('HARASSMENT')}
                        className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm hover:bg-gray-200 transition-colors"
                      >
                        Assédio
                      </button>
                    </div>
                  </div>
                  
                  {/* Origem dos dados */}
                  <div className="mt-6 text-xs text-gray-500">
                    Dados coletados de: 
                    {searchResult.hasLocalData ? ' Seus registros' : ''} 
                    {searchResult.hasLocalData && searchResult.hasCommunityData ? ' e ' : ''}
                    {searchResult.hasCommunityData ? ' Comunidade' : ''}
                    {!searchResult.hasLocalData && !searchResult.hasCommunityData ? ' Nenhuma fonte' : ''}
                  </div>
                </div>
              </div>
            )}
            
            {/* Erro na pesquisa */}
            {searchResult && searchResult.error && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">
                <div className="font-medium">Erro na verificação</div>
                <div className="text-sm mt-1">{searchResult.error}</div>
              </div>
            )}
            
            {/* Dicas */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-lg mb-3">Como funciona</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <span className="text-paz-blue-600 mr-2">✓</span>
                  <span>O sistema combina dados pessoais com informações anônimas da comunidade</span>
                </li>
                <li className="flex items-start">
                  <span className="text-paz-blue-600 mr-2">✓</span>
                  <span>Quanto maior a pontuação (0-100), mais confiável é o número</span>
                </li>
                <li className="flex items-start">
                  <span className="text-paz-blue-600 mr-2">✓</span>
                  <span>Seus dados pessoais têm mais peso que os dados da comunidade</span>
                </li>
                <li className="flex items-start">
                  <span className="text-paz-blue-600 mr-2">✓</span>
                  <span>Ao denunciar ou bloquear números, você ajuda toda a comunidade</span>
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReputationPanel;
