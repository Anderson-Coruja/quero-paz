import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import './App.css';
import storage from './services/storage';
import notificationService from './services/notifications';
import callBlockerService from './services/callBlocker';
import trackingService from './services/tracking';

// Importação dos painéis com lazy loading
const AdvancedProtectionPanel = lazy(() => import('./components/ai/AdvancedProtectionPanel'));
const IntegrationPanel = lazy(() => import('./components/integration/IntegrationPanel'));
const SyncPanel = lazy(() => import('./components/sync/SyncPanel'));
const SyncHistoryViewer = lazy(() => import('./components/sync/SyncHistoryViewer'));
const PrivacySettingsPanel = lazy(() => import('./components/security/PrivacySettingsPanel'));
const TestRunner = lazy(() => import('./components/testing/TestRunner'));
const DashboardMonitor = lazy(() => import('./components/monitoring/DashboardMonitor'));

export default function App() {
  // Estados do aplicativo
  const [isBlocking, setIsBlocking] = useState(true);
  const [view, setView] = useState('main');
  const [isAnimating, setIsAnimating] = useState(false);
  const [silencedCalls, setSilencedCalls] = useState([]);
  const [pendingConfirmations, setPendingConfirmations] = useState([]);
  const [settings, setSettings] = useState({
    blockInternational: true,
    prioritizeLocal: true,
    autoConfirm: false,
    soundOnBlock: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [settingsTab, setSettingsTab] = useState('general');
  const [showHistory, setShowHistory] = useState(false);

  // Inicialização do aplicativo
  useEffect(() => {
    async function initializeApp() {
      try {
        // Inicializa o serviço de rastreamento
        trackingService.initialize();
        trackingService.trackEvent(trackingService.EVENT_TYPES.APP, 'app_start', {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          language: navigator.language,
          online: navigator.onLine
        });
        
        // Inicializa o armazenamento
        await storage.initialize();
        trackingService.trackEvent(trackingService.EVENT_TYPES.STORAGE, 'storage_initialized');
        
        // Carrega dados salvos
        const storedIsBlocking = await storage.getBlockingState();
        const storedSilencedCalls = await storage.getSilencedCalls();
        const storedPendingConfirmations = await storage.getPendingConfirmations();
        const storedSettings = await storage.getSettings();
        
        // Atualiza estado
        setIsBlocking(storedIsBlocking);
        setSilencedCalls(storedSilencedCalls);
        setPendingConfirmations(storedPendingConfirmations);
        setSettings(storedSettings);
        setIsLoading(false);
        
        // Verifica o status atual de permissão (sem solicitar)
        const notificationStatus = notificationService.checkPermissionStatus();
        console.log('Status de permissão para notificações:', notificationStatus);
        trackingService.trackEvent(trackingService.EVENT_TYPES.APP, 'notification_permission', {
          status: notificationStatus
        });
        
        // Registra métrica de performance para inicialização
        if (window.performance) {
          const perfEntries = window.performance.getEntriesByType('navigation');
          if (perfEntries.length > 0) {
            const navData = perfEntries[0];
            trackingService.trackPerformance('load_time', navData.loadEventEnd - navData.navigationStart);
            trackingService.trackPerformance('dom_ready', navData.domComplete - navData.domInteractive);
          }
        }
      } catch (error) {
        console.error('Erro na inicialização do app:', error);
        trackingService.trackError('initialization', error.message, { stack: error.stack });
      }
    }
    
    initializeApp();
    
    // Captura evento 'beforeinstallprompt' para instalar como app
    window.addEventListener('beforeinstallprompt', (e) => {
      // Previne comportamento padrão
      e.preventDefault();
      // Guarda o evento para usar depois
      setInstallPrompt(e);
    });
    
    // Configuramos um intervalo para simular chamadas a cada 30 segundos
    const simulationInterval = setInterval(simulateCall, 30000);
    
    return () => {
      clearInterval(simulationInterval);
    };
  }, []);
  
  // Efeito para animação ao mudar de tela
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [view]);
  
  // Função para alterar o estado de bloqueio - otimizada com useCallback
  const toggleBlockingState = useCallback(async () => {
    const newState = !isBlocking;
    setIsBlocking(newState);
    await storage.setBlockingState(newState);
    
    // Registra evento de alteração do estado de bloqueio
    trackingService.trackEvent(trackingService.EVENT_TYPES.USER, 'toggle_blocking', {
      state: newState ? 'active' : 'inactive',
      timestamp: new Date().toISOString()
    });
  }, [isBlocking]);
  
  // Função para atualizar configurações - otimizada com useCallback
  const updateSetting = useCallback(async (key, value) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
    await storage.updateSettings({ [key]: value });
    
    // Registra evento de alteração de configuração
    trackingService.trackSettingChange(key, value);
  }, [settings]);
  
  // Função para confirmar um número como confiável - otimizada com useCallback
  const confirmAsTrusted = useCallback(async (index) => {
    // Captura o número antes da confirmação para poder registrar no evento
    const phoneNumber = pendingConfirmations[index]?.split(' - ')[0] || 'desconhecido';
    
    const updatedConfirmations = await callBlockerService.confirmAsTrusted(index);
    setPendingConfirmations(updatedConfirmations);
    
    // Registra evento de confirmação de número confiável
    trackingService.trackEvent(trackingService.EVENT_TYPES.USER, 'confirm_trusted', {
      phoneNumber,
      timestamp: new Date().toISOString()
    });
  }, [pendingConfirmations]);
  
  // Função para rejeitar um número - otimizada com useCallback
  const rejectNumber = useCallback(async (index) => {
    // Captura o número antes da rejeição para poder registrar no evento
    const phoneNumber = pendingConfirmations[index]?.split(' - ')[0] || 'desconhecido';
    
    const updatedConfirmations = await callBlockerService.rejectNumber(index);
    const updatedCalls = await storage.getSilencedCalls();
    setPendingConfirmations(updatedConfirmations);
    setSilencedCalls(updatedCalls);
    
    // Registra evento de rejeição de número
    trackingService.trackEvent(trackingService.EVENT_TYPES.USER, 'reject_number', {
      phoneNumber,
      timestamp: new Date().toISOString()
    });
  }, [pendingConfirmations]);
  
  // Função para simular uma chamada recebida - otimizada com useCallback
  const simulateCall = useCallback(async () => {
    // Só simulamos chamadas se o app estiver carregado
    if (isLoading) return;
    
    // Processa a chamada simulada
    const result = await callBlockerService.simulateIncomingCall();
    
    // Atualiza listas conforme resultado
    if (result.action === 'block' || result.action === 'silence') {
      const updatedCalls = await storage.getSilencedCalls();
      setSilencedCalls(updatedCalls);
      
      // Registra evento de chamada bloqueada ou silenciada
      if (result.action === 'block') {
        trackingService.trackBlockedCall(result.phoneNumber || 'desconhecido', result.reason || 'simulação');
      } else {
        trackingService.trackSilencedCall(result.phoneNumber || 'desconhecido');
      }
    } else if (result.action === 'confirm') {
      const updatedConfirmations = await storage.getPendingConfirmations();
      setPendingConfirmations(updatedConfirmations);
      
      // Registra evento de chamada enviada para confirmação
      trackingService.trackEvent(trackingService.EVENT_TYPES.CALL, 'pending_confirmation', {
        phoneNumber: result.phoneNumber || 'desconhecido',
        timestamp: new Date().toISOString()
      });
    }
  }, [isLoading]);
  
  // Promove a instalação como app - otimizada com useCallback
  const installApp = useCallback(() => {
    if (!installPrompt) return;
    
    // Mostra o prompt de instalação
    installPrompt.prompt();
    
    // Espera a escolha do usuário
    installPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('Usuário aceitou a instalação');
      } else {
        console.log('Usuário recusou a instalação');
      }
      // Reseta a variável prompt, pois só pode ser usada uma vez
      setInstallPrompt(null);
    });
  }, [installPrompt]);

  // Text status memoizado para evitar recálculos desnecessários
  const statusText = useMemo(() => 
    isBlocking ? '🛡️ Proteção Ativa' : '😌 Modo Zen'
  , [isBlocking]);

  // Componente de menu inferior persistente
  const BottomNavigation = useMemo(() => {
    return function BottomNav() {
      return (
        <footer className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-3 flex justify-around items-center z-20">
          <button 
            onClick={() => setView('main')} 
            className={`flex flex-col items-center text-sm ${view === 'main' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <span className="text-xl mb-1">🏠</span>
            <span>Início</span>
          </button>
          <button 
            onClick={() => setView('confirma')} 
            className={`flex flex-col items-center text-sm ${view === 'confirma' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <span className="text-xl mb-1">📩</span>
            <span>Confirmar</span>
          </button>
          <button 
            onClick={() => setView('advanced')} 
            className={`flex flex-col items-center text-sm ${view === 'advanced' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <span className="text-xl mb-1">🛡️</span>
            <span>Avançado</span>
          </button>
          <button 
            onClick={() => setView('integration')} 
            className={`flex flex-col items-center text-sm ${view === 'integration' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <span className="text-xl mb-1">🔗</span>
            <span>Integrar</span>
          </button>
          <button 
            onClick={() => setView('sync')} 
            className={`flex flex-col items-center text-sm ${view === 'sync' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <span className="text-xl mb-1">🔄</span>
            <span>Sincronizar</span>
          </button>
          <button 
            onClick={() => setView('monitor')} 
            className={`flex flex-col items-center text-sm ${view === 'monitor' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <span className="text-xl mb-1">📊</span>
            <span>Monitor</span>
          </button>
          <button 
            onClick={() => setView('settings')} 
            className={`flex flex-col items-center text-sm ${view === 'settings' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <span className="text-xl mb-1">⚙️</span>
            <span>Configurar</span>
          </button>
          <button 
            onClick={() => setView('tests')} 
            className={`flex flex-col items-center text-sm ${view === 'tests' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <span className="text-xl mb-1">🧪</span>
            <span>Testes</span>
          </button>
        </footer>
      );
    };
  }, [view, setView]);

  // Componente de cabeçalho da página
  const Header = useMemo(() => {
    return function PageHeader({ title, showBack = false }) {
      return (
        <header className="sticky top-0 bg-white shadow-md p-4 flex items-center justify-between z-10">
          {showBack ? (
            <button 
              onClick={() => setView('main')} 
              className="text-blue-600 flex items-center font-medium"
            >
              <span className="mr-1">←</span> Voltar
            </button>
          ) : (
            <div></div>
          )}
          <h1 className="text-xl font-bold text-center flex-1">{title}</h1>
          <div className="w-10"></div> {/* Espaçador para balancear o header */}
        </header>
      );
    };
  }, [setView]);

  // Função para renderizar o conteúdo da página atual
  function renderContent() {
    // Página principal
    if (view === 'main') {
      return (
        <div className="flex flex-col min-h-screen">
          <Header title="Quero Paz ✌️" />
          <main className="flex-1 p-4 pb-28">
            {/* Botão de instalação como app (PWA) */}
            {installPrompt && (
              <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Instalar como App</h3>
                  <p className="text-sm text-gray-500">Tenha o Quero Paz na tela inicial</p>
                </div>
                <button 
                  onClick={installApp}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg shadow-sm"
                >
                  Instalar
                </button>
              </div>
            )}
            
            {/* Painel de status */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-5 text-center">
              <div className={`text-xl font-bold mb-3 ${isBlocking ? 'text-green-600' : 'text-blue-500'}`}>
                {statusText}
              </div>
              
              <div className="mb-3 relative h-24 w-24 mx-auto">
                <div className={`absolute inset-0 rounded-full flex items-center justify-center transition-all duration-500 ${isBlocking ? 'bg-green-100' : 'bg-blue-100'}`}>
                  <span className="text-4xl">{isBlocking ? '🛡️' : '😌'}</span>
                </div>
              </div>
              
              <button 
                onClick={toggleBlockingState} 
                className={`w-full py-3 rounded-lg font-medium shadow-sm transition-colors ${isBlocking ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
              >
                {isBlocking ? 'Desativar Proteção' : 'Ativar Proteção'}
              </button>
            </div>
            
            {/* Painel de Silêncio */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 bg-blue-600 text-white">
                <h2 className="text-lg font-semibold">Painel de Silêncio</h2>
                <p className="text-sm opacity-80">Chamadas recentemente bloqueadas</p>
              </div>
              
              <div className="divide-y divide-gray-100">
                {silencedCalls.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <p>Nenhuma chamada bloqueada ainda</p>
                  </div>
                ) : (
                  silencedCalls.map((call, idx) => {
                    // Verificamos se a string contém o separador
                    const parts = call.includes(' - ') ? call.split(' - ') : [call, ''];
                    const number = parts[0];
                    const description = parts[1];
                    
                    return (
                      <div key={idx} className="p-4">
                        <div className="flex justify-between">
                          <div>
                            <div className="font-medium">{number}</div>
                            <div className="text-sm text-gray-500">{description}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </main>
        </div>
      );
    }
    
    // Página de configurações
    if (view === 'settings') {
      return (
        <div className="flex flex-col min-h-screen">
          <Header title="Configurações" showBack={true} />
          <main className="flex-1 p-4 pb-28">
            {/* Abas de navegação de configurações */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                onClick={() => setSettingsTab('general')}
                className={`px-4 py-2 font-medium text-sm mr-2 ${settingsTab === 'general' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'}`}
              >
                Geral
              </button>
              <button
                onClick={() => setSettingsTab('privacy')}
                className={`px-4 py-2 font-medium text-sm ${settingsTab === 'privacy' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'}`}
              >
                Privacidade & Segurança
              </button>
            </div>
            
            {/* Configurações gerais */}
            {settingsTab === 'general' && (
              <>
                <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
                  <h2 className="text-lg font-semibold mb-4">Opções de Bloqueio</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="mr-3 bg-blue-100 p-2 rounded-lg">
                          <span className="text-lg">🌎</span>
                        </div>
                        <span>Bloquear chamadas internacionais (DDI)</span>
                      </div>
                      <div className="relative inline-block w-10 align-middle select-none">
                        <input 
                          type="checkbox" 
                          name="toggle" 
                          id="toggle-1" 
                          checked={settings.blockInternational}
                          onChange={() => updateSetting('blockInternational', !settings.blockInternational)}
                          className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" 
                        />
                        <label htmlFor="toggle-1" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="mr-3 bg-green-100 p-2 rounded-lg">
                          <span className="text-lg">📍</span>
                        </div>
                        <span>Priorizar números com DDD local</span>
                      </div>
                      <div className="relative inline-block w-10 align-middle select-none">
                        <input 
                          type="checkbox" 
                          name="toggle" 
                          id="toggle-2" 
                          checked={settings.prioritizeLocal}
                          onChange={() => updateSetting('prioritizeLocal', !settings.prioritizeLocal)}
                          className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" 
                        />
                        <label htmlFor="toggle-2" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="mr-3 bg-yellow-100 p-2 rounded-lg">
                          <span className="text-lg">📱</span>
                        </div>
                        <span>Ativar modo Confirma pra Mim</span>
                      </div>
                      <div className="relative inline-block w-10 align-middle select-none">
                        <input 
                          type="checkbox" 
                          name="toggle" 
                          id="toggle-3" 
                          checked={settings.autoConfirm}
                          onChange={() => updateSetting('autoConfirm', !settings.autoConfirm)}
                          className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" 
                        />
                        <label htmlFor="toggle-3" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <h2 className="text-lg font-semibold mb-4">Notificações</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="mr-3 bg-red-100 p-2 rounded-lg">
                          <span className="text-lg">🔔</span>
                        </div>
                        <span>Som ao bloquear chamadas</span>
                      </div>
                      <div className="relative inline-block w-10 align-middle select-none">
                        <input 
                          type="checkbox" 
                          name="toggle" 
                          id="toggle-4" 
                          checked={settings.soundOnBlock}
                          onChange={() => updateSetting('soundOnBlock', !settings.soundOnBlock)}
                          className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" 
                        />
                        <label htmlFor="toggle-4" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Configurações de privacidade e segurança */}
            {settingsTab === 'privacy' && (
              <Suspense fallback={<div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
                <PrivacySettingsPanel />
              </Suspense>
            )}
          </main>
        </div>
      );
    }
    
    // Página de proteção avançada
    if (view === 'advanced') {
      return (
        <div className="flex flex-col min-h-screen">
          <Header title="Proteção Avançada" showBack={true} />
          <main className="flex-1 p-4 pb-28">
            <Suspense fallback={<div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
              <AdvancedProtectionPanel />
            </Suspense>
          </main>
        </div>
      );
    }
    
    // Página de integração com ecossistema
    if (view === 'integration') {
      return (
        <div className="flex flex-col min-h-screen">
          <Header title="Integração" showBack={true} />
          <main className="flex-1 p-4 pb-28">
            <Suspense fallback={<div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
              <IntegrationPanel />
            </Suspense>
          </main>
        </div>
      );
    }
    
    // Página de sincronização offline
    if (view === 'sync') {
      return (
        <div className="flex flex-col min-h-screen">
          <Header title="Sincronização Offline" showBack={true} />
          <main className="flex-1 p-4 pb-28">
            <Suspense fallback={<div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
              {showHistory ? (
                <>
                  <div className="mb-4">
                    <button 
                      onClick={() => setShowHistory(false)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-sm"
                    >
                      ← Voltar para Painel de Sincronização
                    </button>
                  </div>
                  <SyncHistoryViewer />
                </>
              ) : (
                <>
                  <div className="mb-4 text-right">
                    <button 
                      onClick={() => setShowHistory(true)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-sm"
                    >
                      Ver Histórico de Sincronização →
                    </button>
                  </div>
                  <SyncPanel />
                </>
              )}
            </Suspense>
          </main>
        </div>
      );
    }
    
    // Página de confirmações
    if (view === 'confirma') {
      return (
        <div className="flex flex-col min-h-screen">
          <Header title="Confirma pra Mim" showBack={true} />
          <main className="flex-1 p-4 pb-28">
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <h2 className="text-lg font-medium mb-3 text-blue-700">Chamadas Pendentes</h2>
              <p className="text-sm text-gray-500 mb-4">Confirme se estas chamadas são confiáveis ou devem ser bloqueadas.</p>
              
              <div className="space-y-3">
                {pendingConfirmations.map((item, idx) => (
                  <div key={idx} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{item.split(' - ')[0]}</div>
                        <div className="text-sm text-gray-500">{(item.split(' - ')[1] || 'Chamada desconhecida')}</div>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => confirmAsTrusted(idx)}
                          className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm"
                        >
                          Confiar
                        </button>
                        <button 
                          onClick={() => rejectNumber(idx)}
                          className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm"
                        >
                          Bloquear
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {pendingConfirmations.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <p>Nenhuma chamada pendente para confirmação</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      );
    }
    
    // Página de testes do sistema
    if (view === 'tests') {
      return (
        <div className="flex flex-col min-h-screen">
          <Header title="Testes do Sistema" showBack={true} />
          <main className="flex-1 p-4 pb-28">
            <Suspense fallback={<div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
              <TestRunner />
            </Suspense>
          </main>
        </div>
      );
    }
    
    // Página de monitoramento
    if (view === 'monitor') {
      return (
        <div className="flex flex-col min-h-screen">
          <Header title="Monitoramento" showBack={true} />
          <main className="flex-1 p-4 pb-28">
            <Suspense fallback={<div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
              <DashboardMonitor />
            </Suspense>
          </main>
        </div>
      );
    }
    
    // Página não encontrada (fallback)
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Quero Paz ✌️" />
        <main className="flex-1 p-4 pb-28">
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 text-center text-red-600">
            Página não encontrada
          </div>
        </main>
      </div>
    );
  }

  // Estrutura principal da aplicação
  return (
    <div className={`bg-gradient-to-b from-blue-50 to-purple-50 min-h-screen transition-opacity duration-300 ${isAnimating ? 'opacity-70' : 'opacity-100'}`}>
      {/* Conteúdo principal */}
      {renderContent()}
      
      {/* Menu inferior persistente */}
      <BottomNavigation />
    </div>
  );
}
