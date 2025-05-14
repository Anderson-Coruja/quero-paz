import React, { useState } from 'react';
import { Suspense, lazy } from 'react';

// Lazy loading dos componentes de integração para melhor performance
const ContactsPanel = lazy(() => import('./ContactsPanel'));
const VoicemailPanel = lazy(() => import('./VoicemailPanel'));
const WebhookPanel = lazy(() => import('./WebhookPanel'));

/**
 * Painel principal de integrações que gerencia as diferentes seções
 */
const IntegrationPanel = () => {
  const [activeTab, setActiveTab] = useState('contacts');

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="bg-white rounded-paz shadow-paz p-6">
        <h2 className="text-2xl font-bold text-paz-blue-800 mb-2">Integração com Ecossistema</h2>
        <p className="text-gray-600 mb-6">
          Conecte o Quero Paz com outros serviços e aprimore sua experiência de bloqueio de chamadas.
        </p>
        
        {/* Tabs de navegação */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('contacts')}
              className={`
                whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'contacts'
                  ? 'border-paz-blue-500 text-paz-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              <span className="mr-2">📇</span>
              Contatos
            </button>
            
            <button
              onClick={() => setActiveTab('voicemail')}
              className={`
                whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'voicemail'
                  ? 'border-paz-blue-500 text-paz-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              <span className="mr-2">🔊</span>
              Voicemail
            </button>
            
            <button
              onClick={() => setActiveTab('webhooks')}
              className={`
                whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'webhooks'
                  ? 'border-paz-blue-500 text-paz-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              <span className="mr-2">🔌</span>
              Webhooks
            </button>
          </nav>
        </div>
        
        {/* Conteúdo da tab ativa */}
        <Suspense fallback={
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-paz-blue-600"></div>
          </div>
        }>
          {activeTab === 'contacts' && <ContactsPanel />}
          {activeTab === 'voicemail' && <VoicemailPanel />}
          {activeTab === 'webhooks' && <WebhookPanel />}
        </Suspense>
      </div>
      
      {/* Seção de dicas e benefícios */}
      <div className="bg-white rounded-paz shadow-paz p-6">
        <h3 className="font-semibold text-lg text-paz-blue-800 mb-3">Benefícios da Integração</h3>
        <ul className="space-y-3 text-gray-700">
          <li className="flex items-start">
            <span className="text-paz-blue-600 mr-2">✓</span>
            <span>Sincronize contatos de diferentes plataformas para gerenciar melhor suas chamadas</span>
          </li>
          <li className="flex items-start">
            <span className="text-paz-blue-600 mr-2">✓</span>
            <span>Transcreva mensagens de voz para texto e identifique a urgência das chamadas</span>
          </li>
          <li className="flex items-start">
            <span className="text-paz-blue-600 mr-2">✓</span>
            <span>Conecte-se a outros aplicativos e serviços via webhooks para automação completa</span>
          </li>
          <li className="flex items-start">
            <span className="text-paz-blue-600 mr-2">✓</span>
            <span>Receba alertas em plataformas como Slack, Discord ou por email quando chamadas forem bloqueadas</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default IntegrationPanel;
