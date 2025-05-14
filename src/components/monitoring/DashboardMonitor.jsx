import React, { useState, useEffect } from 'react';
import trackingService from '../../services/tracking';

/**
 * Componente de Monitoramento para o Quero Paz
 * Exibe estatísticas e métricas de uso da aplicação
 */
const DashboardMonitor = () => {
  const [stats, setStats] = useState({
    storage: {
      used: 0,
      quota: 0,
      percentage: 0
    },
    performance: {
      loadTime: 0,
      renderTime: 0
    },
    usage: {
      blockedCalls: 0,
      appStarts: 0,
      lastUsed: null
    },
    database: {
      status: 'checking',
      stores: []
    },
    system: {
      online: navigator.onLine,
      userAgent: navigator.userAgent,
      language: navigator.language
    },
    tests: {
      lastRun: null,
      status: null,
      results: null
    }
  });

  const [refreshInterval, setRefreshInterval] = useState(30);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Coleta estatísticas de uso do aplicativo
  const collectStats = async () => {
    try {
      // Registra evento de coleta de estatísticas
      trackingService.trackEvent(trackingService.EVENT_TYPES.APP, 'stats_collection', {
        timestamp: new Date().toISOString()
      });

      // Coleta informações sobre armazenamento
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        setStats(prevStats => ({
          ...prevStats,
          storage: {
            used: Math.round(estimate.usage / 1024 / 1024 * 100) / 100,
            quota: Math.round(estimate.quota / 1024 / 1024 * 100) / 100,
            percentage: Math.round(estimate.usage / estimate.quota * 100)
          }
        }));
      }

      // Coleta métricas de performance se disponíveis
      if (window.performance) {
        const perfEntries = window.performance.getEntriesByType('navigation');
        if (perfEntries.length > 0) {
          const navData = perfEntries[0];
          setStats(prevStats => ({
            ...prevStats,
            performance: {
              loadTime: Math.round(navData.loadEventEnd - navData.navigationStart),
              renderTime: Math.round(navData.domComplete - navData.domInteractive)
            }
          }));
        }
      }

      // Coleta informações de uso do aplicativo usando o serviço de rastreamento
      const usageStats = trackingService.getUsageStats();
      const silencedCalls = JSON.parse(localStorage.getItem('silencedCalls') || '[]');
      
      setStats(prevStats => ({
        ...prevStats,
        usage: {
          blockedCalls: usageStats.blockedCalls || silencedCalls.length,
          silencedCalls: usageStats.silencedCalls || 0,
          appStarts: usageStats.appStarts || 0,
          errors: usageStats.errorCount || 0,
          lastUsed: usageStats.lastUsed || null,
          totalEvents: usageStats.totalEvents || 0,
          eventsByType: usageStats.eventsByType || {}
        }
      }));

      // Verifica informações do banco de dados
      const dbStatus = localStorage.getItem('dbInitialized') === 'true' ? 'online' : 'offline';
      setStats(prevStats => ({
        ...prevStats,
        database: {
          status: dbStatus,
          stores: JSON.parse(localStorage.getItem('dbStores') || '[]')
        }
      }));

      // Verifica resultados de testes
      const testHistory = JSON.parse(localStorage.getItem('testHistory') || '[]');
      if (testHistory.length > 0) {
        const lastTest = testHistory[testHistory.length - 1];
        setStats(prevStats => ({
          ...prevStats,
          tests: {
            lastRun: lastTest.timestamp,
            status: lastTest.overall,
            results: lastTest.results
          }
        }));
      }

      // Atualiza o estado de conexão
      setStats(prevStats => ({
        ...prevStats,
        system: {
          ...prevStats.system,
          online: navigator.onLine
        }
      }));
      
      // Obter eventos recentes para exibir no painel
      const recentEvents = trackingService.getEvents(null, 20);
      setStats(prevStats => ({
        ...prevStats,
        events: recentEvents
      }));
    } catch (error) {
      console.error('Erro ao coletar estatísticas:', error);
      trackingService.trackError('stats_collection', error.message, { stack: error.stack });
    }
  };

  // Efeito para inicializar o monitoramento
  useEffect(() => {
    collectStats();

    // Registra eventos de conexão
    const handleOnline = () => {
      setStats(prevStats => ({
        ...prevStats,
        system: {
          ...prevStats.system,
          online: true
        }
      }));
    };

    const handleOffline = () => {
      setStats(prevStats => ({
        ...prevStats,
        system: {
          ...prevStats.system,
          online: false
        }
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Efeito para auto-refresh
  useEffect(() => {
    let interval;
    
    if (autoRefresh) {
      interval = setInterval(collectStats, refreshInterval * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Função para determinar a cor do evento baseado no tipo
  const getEventColor = (eventType) => {
    switch (eventType.toLowerCase()) {
      case 'app':
        return 'text-green-400';
      case 'call':
        return 'text-blue-400';
      case 'user':
        return 'text-purple-400';
      case 'error':
        return 'text-red-400';
      case 'performance':
        return 'text-yellow-400';
      case 'storage':
        return 'text-cyan-400';
      default:
        return 'text-white';
    }
  };

  const handleExportData = () => {
    // Obtém todos os eventos para exportação
    const allEvents = trackingService.getEvents(null, 1000);
    
    const dataToExport = {
      stats,
      events: allEvents,
      timestamp: new Date().toISOString(),
      appVersion: '1.0.0',
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `quero-paz-monitoring-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Registra evento de exportação
    trackingService.trackEvent(trackingService.EVENT_TYPES.USER, 'export_monitoring_data', {
      timestamp: new Date().toISOString(),
      eventsCount: allEvents.length
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Painel de Monitoramento</h1>
        <div className="flex space-x-2">
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={collectStats}
          >
            Atualizar Agora
          </button>
          <button 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={handleExportData}
          >
            Exportar Dados
          </button>
        </div>
      </div>

      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-medium">Auto-Atualização</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoRefresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="autoRefresh">Auto-Refresh</label>
            </div>
            <div className="flex items-center">
              <label htmlFor="refreshInterval" className="mr-2">Intervalo (s):</label>
              <input
                type="number"
                id="refreshInterval"
                min="5"
                max="300"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="w-16 p-1 border rounded"
              />
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Última atualização: {new Date().toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Armazenamento */}
        <div className="p-4 border rounded-lg shadow-sm">
          <h2 className="text-lg font-medium mb-2">Armazenamento</h2>
          <div className="mb-2">
            <div className="flex justify-between mb-1">
              <span>Utilização</span>
              <span>{stats.storage.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${
                  stats.storage.percentage > 80 ? 'bg-red-600' : 
                  stats.storage.percentage > 60 ? 'bg-yellow-400' : 'bg-green-600'
                }`}
                style={{ width: `${stats.storage.percentage}%` }}
              ></div>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span>Usado: {stats.storage.used} MB</span>
            <span>Total: {stats.storage.quota} MB</span>
          </div>
        </div>

        {/* Performance */}
        <div className="p-4 border rounded-lg shadow-sm">
          <h2 className="text-lg font-medium mb-2">Performance</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-sm text-gray-600">Tempo de Carregamento</div>
              <div className="font-medium">{stats.performance.loadTime} ms</div>
            </div>
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-sm text-gray-600">Tempo de Renderização</div>
              <div className="font-medium">{stats.performance.renderTime} ms</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Uso */}
        <div className="p-4 border rounded-lg shadow-sm">
          <h2 className="text-lg font-medium mb-2">Uso da Aplicação</h2>
          <ul className="space-y-2">
            <li className="flex justify-between">
              <span>Chamadas Bloqueadas:</span>
              <span className="font-medium">{stats.usage.blockedCalls}</span>
            </li>
            <li className="flex justify-between">
              <span>Chamadas Silenciadas:</span>
              <span className="font-medium">{stats.usage.silencedCalls}</span>
            </li>
            <li className="flex justify-between">
              <span>Inicializações:</span>
              <span className="font-medium">{stats.usage.appStarts}</span>
            </li>
            <li className="flex justify-between">
              <span>Erros:</span>
              <span className="font-medium">{stats.usage.errors}</span>
            </li>
            <li className="flex justify-between">
              <span>Total de Eventos:</span>
              <span className="font-medium">{stats.usage.totalEvents}</span>
            </li>
            <li className="flex justify-between">
              <span>Último Uso:</span>
              <span className="font-medium">{formatDate(stats.usage.lastUsed)}</span>
            </li>
            {stats.usage.eventsByType && (
              <li className="mt-3">
                <details>
                  <summary className="cursor-pointer font-medium">Eventos por tipo</summary>
                  <ul className="mt-2 space-y-1 ml-4 text-sm">
                    {Object.entries(stats.usage.eventsByType).map(([type, count]) => (
                      <li key={type} className="flex justify-between">
                        <span className="capitalize">{type}:</span>
                        <span>{count}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )}
          </ul>
        </div>

        {/* Banco de Dados */}
        <div className="p-4 border rounded-lg shadow-sm">
          <h2 className="text-lg font-medium mb-2">Banco de Dados</h2>
          <div className="mb-2 flex items-center">
            <span>Status:</span>
            <span className={`ml-2 px-2 py-0.5 rounded text-sm ${
              stats.database.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {stats.database.status}
            </span>
          </div>
          <div>
            <p className="text-sm mb-1">Stores:</p>
            {stats.database.stores.length > 0 ? (
              <ul className="text-sm list-disc list-inside">
                {stats.database.stores.map((store, index) => (
                  <li key={index}>{store}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Nenhum store detectado</p>
            )}
          </div>
        </div>

        {/* Sistema */}
        <div className="p-4 border rounded-lg shadow-sm">
          <h2 className="text-lg font-medium mb-2">Informações do Sistema</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Status de Rede:</span>
              <span className={`${stats.system.online ? 'text-green-600' : 'text-red-600'} font-medium`}>
                {stats.system.online ? 'Online' : 'Offline'}
              </span>
            </li>
            <li>
              <p className="mb-1">Navegador:</p>
              <p className="text-gray-600 break-words">{stats.system.userAgent}</p>
            </li>
            <li className="flex justify-between">
              <span>Idioma:</span>
              <span>{stats.system.language}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Resultados de Testes */}
      <div className="p-4 border rounded-lg shadow-sm mb-6">
        <h2 className="text-lg font-medium mb-2">Resultados de Testes</h2>
        {stats.tests.lastRun ? (
          <div>
            <div className="mb-2 flex items-center">
              <span>Último Teste:</span>
              <span className="ml-2">{formatDate(stats.tests.lastRun)}</span>
              <span className={`ml-2 px-2 py-0.5 rounded text-sm ${
                stats.tests.status === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {stats.tests.status === 'passed' ? 'PASSOU' : 'FALHOU'}
              </span>
            </div>
            {stats.tests.results && (
              <div className="mt-4">
                <h3 className="text-md font-medium mb-2">Detalhes por Teste:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(stats.tests.results).map(([testName, result]) => (
                    <div key={testName} className="bg-gray-50 p-3 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium capitalize">{testName}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {result.success ? 'OK' : 'ERRO'}
                        </span>
                      </div>
                      {result.error && (
                        <p className="text-xs text-red-600">{result.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500">Nenhum teste executado</p>
        )}
        <div className="mt-4">
          <button 
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
            onClick={() => {
              if (window.QueroTestes && typeof window.QueroTestes.runAllTests === 'function') {
                window.QueroTestes.runAllTests().then(collectStats);
              } else {
                alert('Scripts de teste não estão disponíveis. Carregue o arquivo de testes primeiro.');
              }
            }}
          >
            Executar Testes Agora
          </button>
        </div>
      </div>

      {/* Eventos recentes */}
      <div className="p-4 border rounded-lg shadow-sm mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-medium">Eventos Recentes</h2>
          <div className="flex space-x-2">
            <button 
              className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded hover:bg-gray-300"
              onClick={() => {
                trackingService.clearEvents();
                collectStats();
              }}
            >
              Limpar Eventos
            </button>
          </div>
        </div>
        <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm h-60 overflow-y-auto">
          {stats.events && stats.events.length > 0 ? (
            stats.events.map((event, index) => (
              <div key={index} className={`mb-1 ${getEventColor(event.type)}`}>
                [{new Date(event.timestamp).toLocaleTimeString()}] [{event.type.toUpperCase()}] {event.action}: 
                {Object.entries(event.data || {}).map(([key, value]) => 
                  key !== 'timestamp' ? ` ${key}=${typeof value === 'object' ? JSON.stringify(value) : value}` : ''
                )}
              </div>
            ))
          ) : (
            <div className="text-gray-400">Nenhum evento registrado</div>
          )}
        </div>
      </div>
      
      {/* Logs e Avisos */}
      <div className="p-4 border rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-medium">Logs do Sistema</h2>
          <button 
            className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded hover:bg-gray-300"
            onClick={() => {
              // Limpa logs do localStorage
              localStorage.removeItem('appLogs');
              setStats(prevStats => ({
                ...prevStats,
                logs: []
              }));
            }}
          >
            Limpar Logs
          </button>
        </div>
        <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm h-40 overflow-y-auto">
          <div className="text-green-400">[INFO] Sistema inicializado em {new Date().toLocaleString()}</div>
          <div className="text-blue-400">[STORAGE] IndexedDB inicializado</div>
          <div className="text-yellow-400">[WARN] Service Worker ainda não registrado</div>
          <div className="text-blue-400">[NETWORK] Status de rede: {stats.system.online ? 'Online' : 'Offline'}</div>
          <div className="text-green-400">[SECURITY] Criptografia inicializada</div>
          {stats.tests.lastRun && (
            <div className={`${stats.tests.status === 'passed' ? 'text-green-400' : 'text-red-400'}`}>
              [TEST] Testes executados em {formatDate(stats.tests.lastRun)} - Status: {stats.tests.status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardMonitor;
