import React, { useState, useEffect, useCallback } from 'react';
import webhookService, { EVENT_TYPES } from '../../services/integration/webhookService';

/**
 * Painel de gerenciamento de webhooks e integrações
 */
const WebhookPanel = () => {
  const [webhooks, setWebhooks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [quickSetupUrl, setQuickSetupUrl] = useState('');
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    eventTypes: [],
    headers: {}
  });
  const [showLogs, setShowLogs] = useState(false);

  // Inicializa o componente
  useEffect(() => {
    const initialize = async () => {
      await webhookService.initialize();
      await loadData();
    };
    initialize();
  }, []);

  // Carrega dados de webhooks e logs
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [webhooksList, logsList] = await Promise.all([
        webhookService.getWebhooks(),
        webhookService.getLogs(25)
      ]);
      
      setWebhooks(webhooksList);
      setLogs(logsList);
    } catch (error) {
      console.error('Erro ao carregar dados de webhooks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Manipula adição de webhook
  const handleAddWebhook = async (e) => {
    e.preventDefault();
    
    if (!newWebhook.url || !newWebhook.name || newWebhook.eventTypes.length === 0) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    
    try {
      await webhookService.addWebhook(newWebhook);
      setNewWebhook({
        name: '',
        url: '',
        eventTypes: [],
        headers: {}
      });
      setShowAddForm(false);
      await loadData();
    } catch (error) {
      console.error('Erro ao adicionar webhook:', error);
      alert('Não foi possível adicionar o webhook.');
    }
  };

  // Configura webhook rápido
  const handleQuickSetup = async () => {
    if (!selectedService || !quickSetupUrl) {
      alert('Selecione um serviço e forneça a URL/token');
      return;
    }
    
    try {
      await webhookService.quickSetup(selectedService, quickSetupUrl);
      setSelectedService('');
      setQuickSetupUrl('');
      await loadData();
    } catch (error) {
      console.error('Erro na configuração rápida:', error);
      alert(`Erro: ${error.message || 'Não foi possível configurar a integração'}`);
    }
  };

  // Manipula alteração de status do webhook
  const handleToggleStatus = async (webhookId) => {
    const webhook = webhooks.find(wh => wh.id === webhookId);
    if (!webhook) return;
    
    const newStatus = webhook.status === 'active' ? 'inactive' : 'active';
    
    try {
      await webhookService.updateWebhook(webhookId, { status: newStatus });
      await loadData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  // Manipula exclusão de webhook
  const handleDeleteWebhook = async (webhookId) => {
    if (!confirm('Tem certeza que deseja excluir este webhook?')) return;
    
    try {
      await webhookService.deleteWebhook(webhookId);
      await loadData();
    } catch (error) {
      console.error('Erro ao excluir webhook:', error);
    }
  };

  // Testa um webhook
  const handleTestWebhook = async (webhookId) => {
    try {
      const result = await webhookService.testWebhook(webhookId);
      
      if (result.success) {
        alert('Teste enviado com sucesso!');
      } else {
        alert(`Erro no teste: ${result.error}`);
      }
      
      await loadData(); // Recarrega para mostrar o log do teste
    } catch (error) {
      console.error('Erro ao testar webhook:', error);
      alert('Não foi possível testar o webhook.');
    }
  };

  // Manipula alteração de valor dos campos do formulário
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewWebhook(prev => ({ ...prev, [name]: value }));
  };

  // Manipula alteração de tipos de eventos
  const handleEventTypeChange = (e) => {
    const { value, checked } = e.target;
    
    setNewWebhook(prev => {
      const eventTypes = checked
        ? [...prev.eventTypes, value]
        : prev.eventTypes.filter(type => type !== value);
      
      return { ...prev, eventTypes };
    });
  };

  // Dispara um evento (simulação para teste)
  const handleTriggerEvent = async (eventType) => {
    try {
      // Dados de exemplo para cada tipo de evento
      const payload = {
        [EVENT_TYPES.CALL_BLOCKED]: {
          phoneNumber: '(11) 98765-4321',
          reason: 'Número bloqueado por regra',
          timestamp: new Date().toISOString()
        },
        [EVENT_TYPES.CALL_SILENCED]: {
          phoneNumber: '(11) 98765-4321',
          timestamp: new Date().toISOString()
        },
        [EVENT_TYPES.RULE_TRIGGERED]: {
          ruleId: 'rule_123',
          ruleName: 'Bloqueio Noturno',
          timestamp: new Date().toISOString()
        },
        [EVENT_TYPES.PROFILE_ACTIVATED]: {
          profileId: 'profile_123',
          profileName: 'Modo Reunião',
          timestamp: new Date().toISOString()
        },
        [EVENT_TYPES.VOICEMAIL_RECEIVED]: {
          phoneNumber: '(11) 98765-4321',
          duration: 25,
          timestamp: new Date().toISOString()
        },
        [EVENT_TYPES.APP_STATUS_CHANGED]: {
          newStatus: 'active',
          previousStatus: 'inactive',
          timestamp: new Date().toISOString()
        },
        [EVENT_TYPES.CUSTOM]: {
          message: 'Evento personalizado',
          timestamp: new Date().toISOString()
        }
      }[eventType];
      
      const result = await webhookService.triggerEvent(eventType, payload);
      
      alert(`Evento disparado para ${result.length} webhook(s)`);
      await loadData(); // Recarrega logs
    } catch (error) {
      console.error('Erro ao disparar evento:', error);
      alert('Não foi possível disparar o evento.');
    }
  };

  // Renderiza o status do webhook como badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Ativo</span>;
      case 'inactive':
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Inativo</span>;
      default:
        return null;
    }
  };

  // Renderiza o tipo de evento
  const renderEventType = (type) => {
    const typeMap = {
      [EVENT_TYPES.CALL_BLOCKED]: 'Chamada Bloqueada',
      [EVENT_TYPES.CALL_SILENCED]: 'Chamada Silenciada',
      [EVENT_TYPES.RULE_TRIGGERED]: 'Regra Acionada',
      [EVENT_TYPES.PROFILE_ACTIVATED]: 'Perfil Ativado',
      [EVENT_TYPES.VOICEMAIL_RECEIVED]: 'Voicemail Recebido',
      [EVENT_TYPES.APP_STATUS_CHANGED]: 'Status do App Alterado',
      [EVENT_TYPES.CUSTOM]: 'Personalizado',
      'all': 'Todos',
      'test': 'Teste'
    };
    
    return typeMap[type] || type;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="bg-white rounded-paz shadow-paz p-6">
        <h2 className="text-2xl font-bold text-paz-blue-800 mb-2">Integrações e Webhooks</h2>
        <p className="text-gray-600 mb-6">
          Conecte o Quero Paz a outros serviços e plataformas para expandir suas funcionalidades.
        </p>
        
        {/* Configuração rápida */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="font-medium text-lg mb-3">Configuração Rápida</h3>
          
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <select 
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-paz-blue-500 focus:border-paz-blue-500"
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
              >
                <option value="">Selecione um serviço</option>
                <option value="slack">Slack</option>
                <option value="discord">Discord</option>
                <option value="ifttt">IFTTT</option>
                <option value="zapier">Zapier</option>
              </select>
              <input
                type="text"
                placeholder={selectedService === 'slack' ? 'URL do webhook do Slack' : 
                             selectedService === 'discord' ? 'URL do webhook do Discord' :
                             selectedService === 'ifttt' ? 'Chave do IFTTT' :
                             selectedService === 'zapier' ? 'URL do webhook do Zapier' :
                             'URL/Token do serviço'}
                value={quickSetupUrl}
                onChange={(e) => setQuickSetupUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-paz-blue-500 focus:border-paz-blue-500"
              />
              <button
                onClick={handleQuickSetup}
                disabled={!selectedService || !quickSetupUrl}
                className="px-4 py-2 bg-paz-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-paz-blue-700 transition-colors whitespace-nowrap"
              >
                Configurar
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {selectedService === 'slack' 
                ? 'Configure notificações para o Slack quando chamadas forem bloqueadas.' 
                : selectedService === 'discord'
                ? 'Receba notificações no Discord sobre chamadas bloqueadas e voicemails.'
                : selectedService === 'ifttt'
                ? 'Use o IFTTT para criar automações com outros serviços quando eventos ocorrerem.'
                : selectedService === 'zapier'
                ? 'Integre com o Zapier para conectar com milhares de apps e serviços.'
                : 'Selecione um serviço para realizar uma configuração rápida.'}
            </p>
          </div>
        </div>
        
        {/* Lista de webhooks */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-lg">Webhooks Configurados</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-2 bg-paz-blue-600 text-white rounded-lg hover:bg-paz-blue-700 transition-colors text-sm"
            >
              {showAddForm ? 'Cancelar' : 'Adicionar Webhook'}
            </button>
          </div>
          
          {/* Formulário de adição */}
          {showAddForm && (
            <form onSubmit={handleAddWebhook} className="mb-6 p-4 border border-gray-200 rounded-lg">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome*
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={newWebhook.name}
                    onChange={handleInputChange}
                    placeholder="Ex: Notificações do Slack"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-paz-blue-500 focus:border-paz-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL*
                  </label>
                  <input
                    type="url"
                    name="url"
                    value={newWebhook.url}
                    onChange={handleInputChange}
                    placeholder="Ex: https://hooks.slack.com/services/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-paz-blue-500 focus:border-paz-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipos de Evento*
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(EVENT_TYPES).map(type => (
                      <div key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`event-${type}`}
                          value={type}
                          checked={newWebhook.eventTypes.includes(type)}
                          onChange={handleEventTypeChange}
                          className="mr-2"
                        />
                        <label htmlFor={`event-${type}`} className="text-sm">
                          {renderEventType(type)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-paz-blue-600 text-white rounded-lg hover:bg-paz-blue-700 transition-colors"
                >
                  Adicionar Webhook
                </button>
              </div>
            </form>
          )}
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-paz-blue-600"></div>
            </div>
          ) : webhooks.length > 0 ? (
            <div className="space-y-4">
              {webhooks.map(webhook => (
                <div 
                  key={webhook.id}
                  className="p-4 bg-white rounded-lg border border-gray-200"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center">
                        <h4 className="font-medium">{webhook.name}</h4>
                        <div className="ml-2">
                          {renderStatusBadge(webhook.status)}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{webhook.url}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {webhook.eventTypes.map(type => (
                          <span key={type} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                            {renderEventType(type)}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <div className="relative inline-block w-10 align-middle select-none">
                        <input 
                          type="checkbox" 
                          id={`toggle-${webhook.id}`} 
                          checked={webhook.status === 'active'}
                          onChange={() => handleToggleStatus(webhook.id)}
                          className="sr-only peer"
                        />
                        <label 
                          htmlFor={`toggle-${webhook.id}`}
                          className="block h-6 overflow-hidden rounded-full bg-gray-300 cursor-pointer peer-checked:bg-paz-blue-600"
                        >
                          <span className="absolute transform transition-transform duration-200 ease-in-out left-1 top-1 bg-white rounded-full h-4 w-4 peer-checked:translate-x-4"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex justify-end space-x-2">
                    <button
                      onClick={() => handleTestWebhook(webhook.id)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors"
                    >
                      Testar
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Nenhum webhook configurado</p>
              <p className="text-sm text-gray-400 mt-1">
                Adicione webhooks para integrar com outros serviços
              </p>
            </div>
          )}
        </div>
        
        {/* Simulação de eventos */}
        <div className="mb-6">
          <h3 className="font-medium text-lg mb-3">Simular Evento</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.values(EVENT_TYPES).map(type => (
              <button
                key={type}
                onClick={() => handleTriggerEvent(type)}
                className="p-2 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors"
              >
                {renderEventType(type)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Logs */}
        <div>
          <div 
            className="flex justify-between items-center mb-2 cursor-pointer"
            onClick={() => setShowLogs(!showLogs)}
          >
            <h3 className="font-medium text-lg">Logs de Webhooks</h3>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-5 w-5 transition-transform ${showLogs ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          {showLogs && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {logs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Evento
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logs.map(log => (
                        <tr key={log.id}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {renderEventType(log.eventType)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {log.success ? (
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                Sucesso
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                                Falha
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Nenhum log disponível
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebhookPanel;
