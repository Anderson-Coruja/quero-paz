import React, { useState, useEffect, useCallback } from 'react';
import voicemailService, { MESSAGE_TYPES, URGENCY_LEVELS, SENTIMENT_TYPES } from '../../services/integration/voicemailService';

/**
 * Painel de gerenciamento de voicemail e transcrição
 */
const VoicemailPanel = () => {
  const [messages, setMessages] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedMessage, setExpandedMessage] = useState(null);

  // Inicializa o componente
  useEffect(() => {
    const initialize = async () => {
      await voicemailService.initialize();
      await loadData();
    };
    initialize();
  }, []);

  // Carrega dados de mensagens e configuração
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [messagesList, configData] = await Promise.all([
        voicemailService.getMessages(),
        voicemailService.getConfig()
      ]);
      
      setMessages(messagesList);
      setConfig(configData);
    } catch (error) {
      console.error('Erro ao carregar dados de voicemail:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualiza configuração
  const updateConfiguration = async (key, value) => {
    try {
      const updatedConfig = await voicemailService.updateConfig({ [key]: value });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      alert('Não foi possível atualizar a configuração.');
    }
  };

  // Transcreve uma mensagem
  const handleTranscribe = async (messageId) => {
    setProcessing(true);
    try {
      const result = await voicemailService.transcribeVoicemail(messageId);
      
      if (result.success) {
        await loadData(); // Recarrega os dados
      } else {
        alert(`Erro na transcrição: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro durante transcrição:', error);
      alert('Ocorreu um erro durante a transcrição da mensagem.');
    } finally {
      setProcessing(false);
    }
  };

  // Marca mensagem como lida
  const handleMarkAsRead = async (messageId) => {
    try {
      await voicemailService.markAsRead(messageId);
      await loadData(); // Recarrega os dados
    } catch (error) {
      console.error('Erro ao marcar mensagem como lida:', error);
    }
  };

  // Exclui mensagem
  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Tem certeza que deseja excluir esta mensagem?')) return;
    
    try {
      await voicemailService.deleteMessage(messageId);
      await loadData(); // Recarrega os dados
    } catch (error) {
      console.error('Erro ao excluir mensagem:', error);
      alert('Não foi possível excluir a mensagem.');
    }
  };

  // Simula uma chamada perdida (apenas para demonstração)
  const handleSimulateMissedCall = async () => {
    try {
      await voicemailService.simulateMissedCall('(11) 98765-4321', 'João Silva');
      await loadData(); // Recarrega os dados
    } catch (error) {
      console.error('Erro ao simular chamada perdida:', error);
    }
  };

  // Simula recebimento de voicemail (apenas para demonstração)
  const handleSimulateVoicemail = async () => {
    try {
      await voicemailService.simulateVoicemail('(11) 98765-4321', 'João Silva', 25);
      await loadData(); // Recarrega os dados
    } catch (error) {
      console.error('Erro ao simular voicemail:', error);
    }
  };

  // Filtra mensagens baseado na aba ativa
  const filteredMessages = messages.filter(message => {
    if (activeTab === 'all') return true;
    if (activeTab === 'voicemail') return message.type === MESSAGE_TYPES.VOICEMAIL;
    if (activeTab === 'transcribed') return message.type === MESSAGE_TYPES.TRANSCRIBED;
    if (activeTab === 'missed') return message.type === MESSAGE_TYPES.MISSED_CALL;
    return true;
  });

  // Renderiza o nível de urgência
  const renderUrgencyBadge = (level) => {
    switch (level) {
      case URGENCY_LEVELS.LOW:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Baixa</span>;
      case URGENCY_LEVELS.MEDIUM:
        return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Média</span>;
      case URGENCY_LEVELS.HIGH:
        return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">Alta</span>;
      case URGENCY_LEVELS.EMERGENCY:
        return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Urgente</span>;
      default:
        return null;
    }
  };

  // Renderiza o sentimento
  const renderSentimentBadge = (sentiment) => {
    switch (sentiment) {
      case SENTIMENT_TYPES.POSITIVE:
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Positivo</span>;
      case SENTIMENT_TYPES.NEGATIVE:
        return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Negativo</span>;
      case SENTIMENT_TYPES.NEUTRAL:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Neutro</span>;
      default:
        return null;
    }
  };

  // Renderiza ícone para o tipo de mensagem
  const renderMessageIcon = (message) => {
    switch (message.type) {
      case MESSAGE_TYPES.MISSED_CALL:
        return <span className="text-lg">📞</span>;
      case MESSAGE_TYPES.VOICEMAIL:
        return <span className="text-lg">🔊</span>;
      case MESSAGE_TYPES.TRANSCRIBED:
        return <span className="text-lg">📝</span>;
      default:
        return <span className="text-lg">✉️</span>;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="bg-white rounded-paz shadow-paz p-6">
        <h2 className="text-2xl font-bold text-paz-blue-800 mb-2">Gerenciamento de Voicemail</h2>
        <p className="text-gray-600 mb-6">
          Transcreva seus voicemails para texto e gerencie mensagens de chamadas perdidas.
        </p>
        
        {/* Configurações */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="font-medium text-lg mb-3">Configurações</h3>
          
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-paz-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="mr-3 bg-paz-blue-100 p-2 rounded-lg">
                    <span className="text-lg">📝</span>
                  </div>
                  <span>Ativar transcrição automática</span>
                </div>
                <div className="relative inline-block w-10 align-middle select-none">
                  <input 
                    type="checkbox" 
                    id="toggle-transcription" 
                    checked={config?.transcriptionEnabled || false}
                    onChange={() => updateConfiguration('transcriptionEnabled', !config?.transcriptionEnabled)}
                    className="sr-only peer"
                  />
                  <label 
                    htmlFor="toggle-transcription"
                    className="block h-6 overflow-hidden rounded-full bg-gray-300 cursor-pointer peer-checked:bg-paz-blue-600"
                  >
                    <span className="absolute transform transition-transform duration-200 ease-in-out left-1 top-1 bg-white rounded-full h-4 w-4 peer-checked:translate-x-4"></span>
                  </label>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="mr-3 bg-green-100 p-2 rounded-lg">
                    <span className="text-lg">😀</span>
                  </div>
                  <span>Análise de sentimento</span>
                </div>
                <div className="relative inline-block w-10 align-middle select-none">
                  <input 
                    type="checkbox" 
                    id="toggle-sentiment" 
                    checked={config?.sentimentAnalysisEnabled || false}
                    onChange={() => updateConfiguration('sentimentAnalysisEnabled', !config?.sentimentAnalysisEnabled)}
                    className="sr-only peer"
                  />
                  <label 
                    htmlFor="toggle-sentiment"
                    className="block h-6 overflow-hidden rounded-full bg-gray-300 cursor-pointer peer-checked:bg-paz-blue-600"
                  >
                    <span className="absolute transform transition-transform duration-200 ease-in-out left-1 top-1 bg-white rounded-full h-4 w-4 peer-checked:translate-x-4"></span>
                  </label>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="mr-3 bg-yellow-100 p-2 rounded-lg">
                    <span className="text-lg">🔔</span>
                  </div>
                  <span>Notificar após transcrição</span>
                </div>
                <div className="relative inline-block w-10 align-middle select-none">
                  <input 
                    type="checkbox" 
                    id="toggle-notify" 
                    checked={config?.notifyOnTranscription || false}
                    onChange={() => updateConfiguration('notifyOnTranscription', !config?.notifyOnTranscription)}
                    className="sr-only peer"
                  />
                  <label 
                    htmlFor="toggle-notify"
                    className="block h-6 overflow-hidden rounded-full bg-gray-300 cursor-pointer peer-checked:bg-paz-blue-600"
                  >
                    <span className="absolute transform transition-transform duration-200 ease-in-out left-1 top-1 bg-white rounded-full h-4 w-4 peer-checked:translate-x-4"></span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Tabs de mensagens */}
        <div className="mb-4 border-b border-gray-200">
          <ul className="flex flex-wrap -mb-px">
            <li className="mr-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`inline-block py-2 px-4 text-sm font-medium ${
                  activeTab === 'all'
                    ? 'text-paz-blue-600 border-b-2 border-paz-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Todas ({messages.length})
              </button>
            </li>
            <li className="mr-2">
              <button
                onClick={() => setActiveTab('voicemail')}
                className={`inline-block py-2 px-4 text-sm font-medium ${
                  activeTab === 'voicemail'
                    ? 'text-paz-blue-600 border-b-2 border-paz-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Voicemail
              </button>
            </li>
            <li className="mr-2">
              <button
                onClick={() => setActiveTab('transcribed')}
                className={`inline-block py-2 px-4 text-sm font-medium ${
                  activeTab === 'transcribed'
                    ? 'text-paz-blue-600 border-b-2 border-paz-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Transcritas
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab('missed')}
                className={`inline-block py-2 px-4 text-sm font-medium ${
                  activeTab === 'missed'
                    ? 'text-paz-blue-600 border-b-2 border-paz-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Chamadas Perdidas
              </button>
            </li>
          </ul>
        </div>
        
        {/* Lista de mensagens */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-paz-blue-600"></div>
          </div>
        ) : filteredMessages.length > 0 ? (
          <div className="space-y-4">
            {filteredMessages.map(message => (
              <div 
                key={message.id}
                className={`p-4 rounded-lg border ${
                  message.status === 'new' 
                    ? 'border-paz-blue-200 bg-paz-blue-50' 
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start">
                    <div className="mr-3 mt-1">
                      {renderMessageIcon(message)}
                    </div>
                    <div>
                      <div className="font-medium">{message.callerName || message.phoneNumber}</div>
                      <div className="text-sm text-gray-500">
                        {message.phoneNumber}
                        {message.duration > 0 && ` • ${message.duration}s`}
                        {message.timestamp && ` • ${new Date(message.timestamp).toLocaleString()}`}
                      </div>
                      
                      {message.type === MESSAGE_TYPES.TRANSCRIBED && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.urgency && renderUrgencyBadge(message.urgency)}
                          {message.sentiment && renderSentimentBadge(message.sentiment)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    {message.type === MESSAGE_TYPES.VOICEMAIL && (
                      <button
                        onClick={() => handleTranscribe(message.id)}
                        disabled={processing}
                        className="text-sm text-paz-blue-600 hover:text-paz-blue-800 disabled:text-gray-400"
                      >
                        {processing ? 'Transcrevendo...' : 'Transcrever'}
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Transcrição expandida */}
                {message.type === MESSAGE_TYPES.TRANSCRIBED && (
                  <div className="mt-3">
                    <div 
                      className={`bg-white rounded-lg p-3 border border-gray-200 ${
                        expandedMessage === message.id ? '' : 'line-clamp-2'
                      }`}
                    >
                      {message.transcription}
                    </div>
                    <button
                      onClick={() => setExpandedMessage(expandedMessage === message.id ? null : message.id)}
                      className="text-sm text-gray-500 hover:text-gray-700 mt-1"
                    >
                      {expandedMessage === message.id ? 'Ver menos' : 'Ver mais'}
                    </button>
                  </div>
                )}
                
                {/* Ações */}
                <div className="mt-3 flex justify-end space-x-2">
                  {message.status === 'new' && (
                    <button
                      onClick={() => handleMarkAsRead(message.id)}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Marcar como lido
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteMessage(message.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Nenhuma mensagem encontrada</p>
            <div className="mt-4 flex justify-center space-x-3">
              <button
                onClick={handleSimulateMissedCall}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Simular Chamada Perdida
              </button>
              <button
                onClick={handleSimulateVoicemail}
                className="px-4 py-2 bg-paz-blue-600 text-white rounded-lg hover:bg-paz-blue-700 transition-colors"
              >
                Simular Voicemail
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoicemailPanel;
