import React, { useState, useEffect, useCallback } from 'react';
import sharedBlacklist from '../../services/ai/sharedBlacklist';

/**
 * Componente que exibe e gerencia a blacklist compartilhada
 */
const SharedBlacklistCard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [searchNumber, setSearchNumber] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [reportForm, setReportForm] = useState({
    phoneNumber: '',
    reason: '',
    category: 'spam'
  });
  const [isReporting, setIsReporting] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);

  // Inicializa o componente
  useEffect(() => {
    const initialize = async () => {
      await sharedBlacklist.initialize();
      loadStats();
    };
    initialize();
  }, []);

  // Carrega estatísticas da blacklist
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const blacklistStats = await sharedBlacklist.getStats();
      setStats(blacklistStats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Busca um número na blacklist
  const handleSearch = async () => {
    if (!searchNumber || searchNumber.length < 4) {
      setSearchResult({ error: 'Digite ao menos 4 dígitos do número' });
      return;
    }
    
    setLoading(true);
    try {
      const result = await sharedBlacklist.checkNumber(searchNumber);
      setSearchResult(result);
    } catch (error) {
      console.error('Erro ao verificar número:', error);
      setSearchResult({ error: 'Erro ao verificar número' });
    } finally {
      setLoading(false);
    }
  };

  // Reporta um número para a blacklist
  const handleReport = async (e) => {
    e.preventDefault();
    
    if (!reportForm.phoneNumber || !reportForm.reason) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    
    setIsReporting(true);
    try {
      await sharedBlacklist.reportNumber(
        reportForm.phoneNumber,
        reportForm.reason,
        reportForm.category
      );
      
      // Reseta o formulário e recarrega estatísticas
      setReportForm({
        phoneNumber: '',
        reason: '',
        category: 'spam'
      });
      setShowReportForm(false);
      loadStats();
      
      alert('Número reportado com sucesso!');
    } catch (error) {
      console.error('Erro ao reportar número:', error);
      alert('Erro ao reportar número');
    } finally {
      setIsReporting(false);
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
            <h3 className="font-semibold text-lg text-paz-blue-800">Blacklist Comunitária</h3>
            <p className="text-sm text-paz-blue-600">
              {stats ? `${stats.total} números bloqueados` : 'Carregando...'}
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
          {loading && !stats ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-paz-blue-600"></div>
            </div>
          ) : (
            <div>
              {/* Estatísticas */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-gray-700 mb-2">Resumo da Blacklist</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded shadow-sm">
                    <div className="text-sm text-gray-500">Números Bloqueados</div>
                    <div className="text-xl font-semibold text-paz-blue-700">{stats?.total || 0}</div>
                  </div>
                  <div className="bg-white p-3 rounded shadow-sm">
                    <div className="text-sm text-gray-500">Total de Denúncias</div>
                    <div className="text-xl font-semibold text-paz-red-700">{stats?.totalReportCount || 0}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 text-right">
                  Última atualização: {stats?.lastUpdated 
                    ? new Date(stats.lastUpdated).toLocaleString() 
                    : 'Desconhecida'}
                </div>
              </div>
              
              {/* Verificar número */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-2">Verificar Número</h4>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-paz-blue-500"
                    placeholder="Digite um número para verificar"
                    value={searchNumber}
                    onChange={(e) => setSearchNumber(e.target.value)}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-4 py-2 bg-paz-blue-600 hover:bg-paz-blue-700 text-white rounded disabled:opacity-50"
                  >
                    {loading ? 'Verificando...' : 'Verificar'}
                  </button>
                </div>
                
                {/* Resultado da busca */}
                {searchResult && (
                  <div className={`mt-3 p-3 rounded ${
                    searchResult.error ? 'bg-paz-red-50 text-paz-red-800' : 
                      searchResult.isBlocked ? 'bg-paz-red-50 text-paz-red-800' : 'bg-paz-green-50 text-paz-green-800'
                  }`}>
                    {searchResult.error ? (
                      <p>{searchResult.error}</p>
                    ) : searchResult.isBlocked ? (
                      <div>
                        <p className="font-medium">Número bloqueado na blacklist comunitária</p>
                        <p className="text-sm">{searchResult.reason}</p>
                        <div className="mt-1 flex space-x-2 text-xs">
                          <span className="bg-paz-red-200 px-2 py-1 rounded">
                            {searchResult.reportCount} denúncias
                          </span>
                          <span className="bg-paz-red-200 px-2 py-1 rounded">
                            Categoria: {searchResult.category}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p>Número não encontrado na blacklist comunitária</p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Denunciar número */}
              <div>
                {!showReportForm ? (
                  <button
                    onClick={() => setShowReportForm(true)}
                    className="w-full py-2 px-4 bg-paz-red-600 hover:bg-paz-red-700 text-white rounded"
                  >
                    Denunciar um número
                  </button>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-3">Denunciar Número</h4>
                    <form onSubmit={handleReport}>
                      <div className="mb-3">
                        <label className="block text-gray-700 text-sm font-medium mb-1">
                          Número de Telefone*
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-paz-blue-500"
                          placeholder="Ex: 11987654321"
                          value={reportForm.phoneNumber}
                          onChange={(e) => setReportForm({...reportForm, phoneNumber: e.target.value})}
                          required
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="block text-gray-700 text-sm font-medium mb-1">
                          Motivo da Denúncia*
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-paz-blue-500"
                          placeholder="Ex: Telemarketing insistente"
                          value={reportForm.reason}
                          onChange={(e) => setReportForm({...reportForm, reason: e.target.value})}
                          required
                        />
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-medium mb-1">
                          Categoria
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-paz-blue-500"
                          value={reportForm.category}
                          onChange={(e) => setReportForm({...reportForm, category: e.target.value})}
                        >
                          <option value="spam">Spam/Publicidade</option>
                          <option value="telemarketing">Telemarketing</option>
                          <option value="scam">Golpe/Fraude</option>
                          <option value="robocall">Ligação Automática</option>
                          <option value="harassment">Assédio</option>
                          <option value="other">Outro</option>
                        </select>
                      </div>
                      
                      <div className="flex space-x-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setShowReportForm(false)}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isReporting}
                          className="px-4 py-2 bg-paz-red-600 hover:bg-paz-red-700 text-white rounded disabled:opacity-50"
                        >
                          {isReporting ? 'Enviando...' : 'Denunciar'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SharedBlacklistCard;
