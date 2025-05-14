import React, { useState, useEffect, useCallback } from 'react';
import contactsSync, { CONTACT_PROVIDERS } from '../../services/integration/contactsSync';

/**
 * Painel de sincronização e gerenciamento de contatos
 */
const ContactsPanel = () => {
  const [contacts, setContacts] = useState([]);
  const [syncInfo, setSyncInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);

  // Carrega dados iniciais
  useEffect(() => {
    const initialize = async () => {
      await contactsSync.initialize();
      await loadData();
    };
    initialize();
  }, []);

  // Carrega dados de contatos e informações de sincronização
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [contactsList, info] = await Promise.all([
        contactsSync.getContacts(),
        contactsSync.getSyncInfo()
      ]);
      
      setContacts(contactsList);
      setSyncInfo(info);
    } catch (error) {
      console.error('Erro ao carregar dados de contatos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Inicia sincronização com o provedor selecionado
  const handleSync = async () => {
    if (!selectedProvider) {
      alert('Selecione um provedor de contatos primeiro');
      return;
    }
    
    setSyncing(true);
    try {
      // Configura o provedor
      await contactsSync.configureProvider(selectedProvider);
      
      // Inicia sincronização
      const result = await contactsSync.syncContacts();
      
      if (result.success) {
        alert(`Sincronização concluída! ${result.contactsCount} contatos sincronizados.`);
        await loadData(); // Recarrega os dados
      } else {
        alert(`Erro na sincronização: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro durante sincronização:', error);
      alert('Ocorreu um erro durante a sincronização de contatos.');
    } finally {
      setSyncing(false);
    }
  };

  // Pesquisa contatos
  const handleSearch = useCallback(async () => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      const results = await contactsSync.searchContacts(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Erro ao pesquisar contatos:', error);
    }
  }, [searchQuery]);

  // Executa pesquisa quando o query muda
  useEffect(() => {
    handleSearch();
  }, [searchQuery, handleSearch]);

  // Renderiza cartão de contato
  const renderContactCard = (contact) => (
    <div key={contact.id} className="p-3 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-start">
        <div className="bg-paz-blue-100 text-paz-blue-700 p-2 rounded-full mr-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-medium">{contact.name}</h3>
          <div className="text-sm text-gray-600 mt-1">
            {contact.phoneNumbers.map((phone, idx) => (
              <div key={idx}>
                {phone.number} <span className="text-gray-400 text-xs">({phone.type})</span>
              </div>
            ))}
          </div>
          {contact.groups && contact.groups.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {contact.groups.map((group, idx) => (
                <span key={idx} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                  {group}
                </span>
              ))}
            </div>
          )}
        </div>
        {contact.isFavorite && (
          <span className="text-yellow-500">⭐</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="bg-white rounded-paz shadow-paz p-6">
        <h2 className="text-2xl font-bold text-paz-blue-800 mb-2">Sincronização de Contatos</h2>
        <p className="text-gray-600 mb-6">
          Sincronize seus contatos para gerenciar melhor as chamadas e criar regras personalizadas.
        </p>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-paz-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Informações de sincronização */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-lg mb-2">Status de Sincronização</h3>
              <div className="flex flex-wrap gap-4">
                <div className="bg-white p-3 rounded shadow-sm flex-1">
                  <div className="text-sm text-gray-500">Última sincronização</div>
                  <div className="font-semibold">
                    {syncInfo?.lastSyncDate 
                      ? new Date(syncInfo.lastSyncDate).toLocaleString() 
                      : 'Nunca sincronizado'}
                  </div>
                </div>
                <div className="bg-white p-3 rounded shadow-sm flex-1">
                  <div className="text-sm text-gray-500">Contatos sincronizados</div>
                  <div className="font-semibold">{contacts.length}</div>
                </div>
                <div className="bg-white p-3 rounded shadow-sm flex-1">
                  <div className="text-sm text-gray-500">Provedor</div>
                  <div className="font-semibold">
                    {syncInfo?.provider 
                      ? syncInfo.provider.charAt(0).toUpperCase() + syncInfo.provider.slice(1) 
                      : 'Não configurado'}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Seleção de provedor e sincronização */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-lg mb-3">Sincronizar Agora</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <select 
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-paz-blue-500 focus:border-paz-blue-500"
                  value={selectedProvider || ''}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                >
                  <option value="">Selecione um provedor</option>
                  <option value={CONTACT_PROVIDERS.GOOGLE}>Google Contacts</option>
                  <option value={CONTACT_PROVIDERS.ICLOUD}>iCloud</option>
                  <option value={CONTACT_PROVIDERS.DEVICE}>Contatos do Dispositivo</option>
                  <option value={CONTACT_PROVIDERS.LOCAL}>Importação Local</option>
                </select>
                <button
                  onClick={handleSync}
                  disabled={syncing || !selectedProvider}
                  className="px-4 py-2 bg-paz-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-paz-blue-700 transition-colors"
                >
                  {syncing ? 'Sincronizando...' : 'Sincronizar Contatos'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {selectedProvider === CONTACT_PROVIDERS.GOOGLE ? 
                  'Será solicitado acesso à sua conta Google para sincronizar contatos.' :
                selectedProvider === CONTACT_PROVIDERS.ICLOUD ? 
                  'Será necessário autorizar o acesso aos seus contatos do iCloud.' :
                selectedProvider === CONTACT_PROVIDERS.DEVICE ? 
                  'Os contatos serão importados diretamente do seu dispositivo.' :
                selectedProvider === CONTACT_PROVIDERS.LOCAL ? 
                  'Você poderá importar um arquivo de contatos no formato CSV ou vCard.' :
                  'Selecione um provedor para sincronizar seus contatos.'}
              </p>
            </div>
            
            {/* Pesquisar contatos */}
            <div className="mt-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar contatos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-paz-blue-500 focus:border-paz-blue-500"
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              {/* Resultados da pesquisa ou lista de contatos */}
              <div className="mt-4 space-y-3">
                {searchQuery.length > 0 ? (
                  searchResults.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">
                        {searchResults.length} resultados encontrados
                      </h3>
                      {searchResults.map(contact => renderContactCard(contact))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum contato encontrado para "{searchQuery}"
                    </div>
                  )
                ) : contacts.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Contatos recentes
                    </h3>
                    {contacts.slice(0, 5).map(contact => renderContactCard(contact))}
                    {contacts.length > 5 && (
                      <button className="mt-3 text-paz-blue-600 text-sm hover:underline w-full text-center">
                        Ver todos os {contacts.length} contatos
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum contato sincronizado ainda. Sincronize seus contatos para começar.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactsPanel;
