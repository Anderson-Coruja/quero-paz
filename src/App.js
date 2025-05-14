import React, { useState, useEffect } from 'react';
import './App.css';
import storage from './services/storage';
import notificationService from './services/notifications';
import callBlockerService from './services/callBlocker';

export default function App() {
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

  // Inicialização do aplicativo
  useEffect(() => {
    async function initializeApp() {
      // Inicializa o armazenamento
      await storage.initialize();
      
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
      
      // Solicita permissão para notificações
      notificationService.requestPermission();
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
  
  // Função para alterar o estado de bloqueio
  const toggleBlockingState = async () => {
    const newState = !isBlocking;
    setIsBlocking(newState);
    await storage.setBlockingState(newState);
  };
  
  // Função para atualizar configurações
  const updateSetting = async (key, value) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
    await storage.updateSettings({ [key]: value });
  };
  
  // Função para confirmar um número como confiável
  const confirmAsTrusted = async (index) => {
    const updatedConfirmations = await callBlockerService.confirmAsTrusted(index);
    setPendingConfirmations(updatedConfirmations);
  };
  
  // Função para rejeitar um número
  const rejectNumber = async (index) => {
    const updatedConfirmations = await callBlockerService.rejectNumber(index);
    const updatedCalls = await storage.getSilencedCalls();
    setPendingConfirmations(updatedConfirmations);
    setSilencedCalls(updatedCalls);
  };
  
  // Função para simular uma chamada recebida
  const simulateCall = async () => {
    // Só simulamos chamadas se o app estiver carregado
    if (isLoading) return;
    
    // Processa a chamada simulada
    const result = await callBlockerService.simulateIncomingCall();
    
    // Atualiza listas conforme resultado
    if (result.action === 'block' || result.action === 'silence') {
      const updatedCalls = await storage.getSilencedCalls();
      setSilencedCalls(updatedCalls);
    } else if (result.action === 'confirm') {
      const updatedConfirmations = await storage.getPendingConfirmations();
      setPendingConfirmations(updatedConfirmations);
    }
  };
  
  // Promove a instalação como app
  const installApp = () => {
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
  };

  const statusText = isBlocking ? '🛡️ Proteção Ativa' : '😌 Modo Zen';

  // Layout wrapper comum para todas as vistas
  const PageWrapper = ({ children, title, showBack = false }) => (
    <div className={`min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 text-gray-800 flex flex-col transition-opacity duration-300 ${isAnimating ? 'opacity-70' : 'opacity-100'}`}>
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
      
      <main className="flex-1 p-4 overflow-auto pb-20">
        {children}
      </main>
      
      {/* Barra inferior (visível apenas na tela principal) */}
      {!showBack && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-3 flex justify-around items-center">
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
            onClick={() => setView('settings')} 
            className={`flex flex-col items-center text-sm ${view === 'settings' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <span className="text-xl mb-1">⚙️</span>
            <span>Configurar</span>
          </button>
        </footer>
      )}
    </div>
  );

  // Página de configurações
  if (view === 'settings') {
    return (
      <PageWrapper title="Configurações" showBack={true}>
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
      </PageWrapper>
    );
  }

  // Página de confirmações
  if (view === 'confirma') {
    return (
      <PageWrapper title="Confirma pra Mim" showBack={true}>
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="text-lg font-medium mb-3 text-blue-700">Chamadas Pendentes</h2>
          <p className="text-sm text-gray-500 mb-4">Confirme se estas chamadas são confiáveis ou devem ser bloqueadas.</p>
          
          <div className="space-y-3">
            {pendingConfirmations.map((item, idx) => (
              <div key={idx} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{item.split(' - ')[0]}</div>
                    <div className="text-sm text-gray-500">{item.split(' - ')[1]}</div>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => rejectNumber(idx)}
                      className="p-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-sm hover:bg-red-600 transition"
                      aria-label="Rejeitar número"
                    >
                      ✕
                    </button>
                    <button 
                      onClick={() => confirmAsTrusted(idx)}
                      className="p-2 bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-sm hover:bg-green-600 transition"
                      aria-label="Confirmar número como confiável"
                    >
                      ✓
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Tela principal
  return (
    <PageWrapper title="Quero Paz ✌️">
      {/* Status e botão de toggle */}
      {/* Botão de instalação como app (PWA) - visível apenas quando disponível */}
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
              const info = parts[1];
              
              return (
                <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start">
                    <div className="mr-3 text-xl mt-1">
                      {info.includes('bloqueada') ? '🔴' : 
                       info.includes('silenciada') ? '🔕' : 
                       info.includes('DDI') ? '🌎' : '📱'}
                    </div>
                    <div>
                      <div className="font-medium">{number}</div>
                      <div className="text-sm text-gray-500">{info}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Botão para simular chamada */}
        <div className="mt-3 px-4 pb-4">
          <button 
            onClick={simulateCall} 
            className="w-full py-2 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
          >
            Simular Chamada Recebida
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}
