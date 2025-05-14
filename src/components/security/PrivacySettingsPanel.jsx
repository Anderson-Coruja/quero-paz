import React, { useState, useEffect } from 'react';
import privacyManager from '../../services/security/privacyManager';

/**
 * Painel de Configurações de Privacidade
 * 
 * Permite ao usuário configurar opções de privacidade e segurança
 * como retenção de dados, criptografia e compartilhamento.
 */
const PrivacySettingsPanel = () => {
  // Estado para armazenar configurações
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');
  
  // Carrega configurações ao inicializar
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Inicializa o gerenciador de privacidade
        await privacyManager.initialize();
        
        // Obtém configurações atuais
        const currentSettings = privacyManager.getSettings();
        setSettings(currentSettings);
        setLoading(false);
      } catch (error) {
        console.error('Erro ao carregar configurações de privacidade:', error);
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  // Atualiza uma configuração
  const updateSetting = (section, key, value) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value
      }
    });
  };
  
  // Atualiza uma configuração aninhada (para retenção de dados)
  const updateNestedSetting = (section, subSection, key, value) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [subSection]: {
          ...settings[section][subSection],
          [key]: value
        }
      }
    });
  };
  
  // Salva as configurações
  const saveSettings = async () => {
    try {
      setSaveStatus('saving');
      await privacyManager.updateSettings(settings);
      setSaveStatus('saved');
      
      // Limpa a mensagem após alguns segundos
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setSaveStatus('error');
    }
  };
  
  // Limpa dados antigos manualmente
  const cleanupData = async () => {
    try {
      setSaveStatus('cleaning');
      const result = await privacyManager.performDataCleanup();
      console.log('Resultado da limpeza:', result);
      setSaveStatus('cleaned');
      
      // Limpa a mensagem após alguns segundos
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      setSaveStatus('error');
    }
  };
  
  // Renderiza carregando
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-paz-blue-600"></div>
      </div>
    );
  }
  
  // Renderiza mensagem de erro se não há configurações
  if (!settings) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <h3 className="text-red-800 font-medium">Erro ao carregar configurações</h3>
        <p className="text-red-600">Não foi possível carregar suas configurações de privacidade.</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="bg-white rounded-paz shadow-paz p-6">
        <h2 className="text-2xl font-bold text-paz-blue-800 mb-4">Configurações de Privacidade</h2>
        <p className="text-gray-600 mb-6">
          Configure como seus dados são armazenados, processados e compartilhados.
        </p>
        
        {/* Seção: Retenção de dados */}
        <div className="mb-8 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-3 flex items-center">
            <span className="mr-2">📅</span> Retenção de dados
          </h3>
          
          <div className="ml-2 space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.dataRetention.enabled}
                  onChange={(e) => updateSetting('dataRetention', 'enabled', e.target.checked)}
                  className="mr-2 h-4 w-4 text-paz-blue-600"
                />
                <span>Limpar dados antigos automaticamente</span>
              </label>
            </div>
            
            {settings.dataRetention.enabled && (
              <div className="space-y-3 mt-2 pl-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manter histórico de chamadas por:
                  </label>
                  <select
                    value={settings.dataRetention.retentionDays.calls}
                    onChange={(e) => updateNestedSetting('dataRetention', 'retentionDays', 'calls', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-paz-blue-500 focus:border-paz-blue-500"
                  >
                    <option value={7}>7 dias</option>
                    <option value={15}>15 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={90}>90 dias</option>
                    <option value={180}>6 meses</option>
                    <option value={365}>1 ano</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manter logs por:
                  </label>
                  <select
                    value={settings.dataRetention.retentionDays.logs}
                    onChange={(e) => updateNestedSetting('dataRetention', 'retentionDays', 'logs', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-paz-blue-500 focus:border-paz-blue-500"
                  >
                    <option value={7}>7 dias</option>
                    <option value={15}>15 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={90}>90 dias</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.dataRetention.keepBlocked}
                      onChange={(e) => updateSetting('dataRetention', 'keepBlocked', e.target.checked)}
                      className="mr-2 h-4 w-4 text-paz-blue-600"
                    />
                    <span>Manter histórico de números bloqueados</span>
                  </label>
                </div>
                
                <div className="mt-2">
                  <button 
                    onClick={cleanupData}
                    disabled={saveStatus === 'cleaning'}
                    className="px-4 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors text-sm"
                  >
                    {saveStatus === 'cleaning' ? 'Limpando...' : 'Limpar dados antigos agora'}
                  </button>
                  
                  {saveStatus === 'cleaned' && (
                    <span className="text-green-600 text-sm ml-2">
                      ✓ Dados antigos removidos
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Seção: Compartilhamento */}
        <div className="mb-8 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-3 flex items-center">
            <span className="mr-2">🔄</span> Compartilhamento
          </h3>
          
          <div className="ml-2 space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.sharing.contributeToReputation}
                  onChange={(e) => updateSetting('sharing', 'contributeToReputation', e.target.checked)}
                  className="mr-2 h-4 w-4 text-paz-blue-600"
                />
                <span>Contribuir com sistema de reputação</span>
              </label>
            </div>
            
            {settings.sharing.contributeToReputation && (
              <div className="space-y-3 mt-2 pl-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nível de privacidade:
                  </label>
                  <select
                    value={settings.sharing.privacyLevel}
                    onChange={(e) => updateSetting('sharing', 'privacyLevel', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-paz-blue-500 focus:border-paz-blue-500"
                  >
                    <option value="maximum">Máximo - Apenas estatísticas agregadas</option>
                    <option value="balanced">Balanceado - Dados anônimos</option>
                    <option value="standard">Padrão - Compartilhamento normal</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.sharing.anonymizeContacts}
                      onChange={(e) => updateSetting('sharing', 'anonymizeContacts', e.target.checked)}
                      className="mr-2 h-4 w-4 text-paz-blue-600"
                    />
                    <span>Anonimizar informações de contatos</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Seção: Armazenamento */}
        <div className="mb-8 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-3 flex items-center">
            <span className="mr-2">💾</span> Armazenamento
          </h3>
          
          <div className="ml-2 space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.storage.storeCallHistory}
                  onChange={(e) => updateSetting('storage', 'storeCallHistory', e.target.checked)}
                  className="mr-2 h-4 w-4 text-paz-blue-600"
                />
                <span>Armazenar histórico de chamadas</span>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.storage.encryptSensitiveData}
                  onChange={(e) => updateSetting('storage', 'encryptSensitiveData', e.target.checked)}
                  className="mr-2 h-4 w-4 text-paz-blue-600"
                />
                <span>Criptografar dados sensíveis</span>
              </label>
            </div>
            
            {!settings.storage.storeCallHistory && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-2">
                <p className="text-sm text-yellow-700">
                  <strong>Nota:</strong> Desativar o armazenamento de histórico de chamadas reduzirá a eficácia do bloqueio, pois o aplicativo não lembrará de chamadas anteriores.
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Botão de salvar */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saveStatus === 'saving'}
            className="px-5 py-2 bg-paz-blue-600 text-white rounded-lg hover:bg-paz-blue-700 transition-colors"
          >
            {saveStatus === 'saving' ? 'Salvando...' : 'Salvar Configurações'}
          </button>
          
          {saveStatus === 'saved' && (
            <span className="text-green-600 flex items-center ml-3">
              ✓ Salvo com sucesso
            </span>
          )}
          
          {saveStatus === 'error' && (
            <span className="text-red-600 flex items-center ml-3">
              ✗ Erro ao salvar
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrivacySettingsPanel;
