import React, { useState, useEffect, useCallback } from 'react';
import blockProfiles, { PROFILE_TYPES, PROFILE_STATUS } from '../../services/ai/blockProfiles';

/**
 * Componente que exibe e gerencia perfis de bloqueio
 */
const BlockProfilesCard = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [activeProfile, setActiveProfile] = useState(null);

  // Carrega perfis existentes
  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const profilesList = await blockProfiles.getProfiles();
      setProfiles(profilesList);
      
      // Identifica o perfil ativo, se houver
      const active = profilesList.find(p => p.status === PROFILE_STATUS.ACTIVE);
      setActiveProfile(active || null);
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Ativa um perfil específico
  const handleActivateProfile = async (profileId) => {
    try {
      await blockProfiles.activateProfile(profileId);
      loadProfiles(); // Recarrega a lista para refletir a mudança
    } catch (error) {
      console.error('Erro ao ativar perfil:', error);
    }
  };

  // Desativa todos os perfis
  const handleDeactivateAll = async () => {
    try {
      await blockProfiles.deactivateAllProfiles();
      loadProfiles(); // Recarrega a lista para refletir a mudança
    } catch (error) {
      console.error('Erro ao desativar perfis:', error);
    }
  };

  // Cria um novo perfil predefinido
  const handleCreateProfile = async (type) => {
    try {
      let newProfile;
      
      switch (type) {
        case PROFILE_TYPES.SLEEP:
          newProfile = await blockProfiles.createSleepProfile();
          break;
        case PROFILE_TYPES.WORK:
          newProfile = await blockProfiles.createWorkProfile();
          break;
        case PROFILE_TYPES.VACATION:
          newProfile = await blockProfiles.createVacationProfile();
          break;
        case PROFILE_TYPES.MEETING:
          newProfile = await blockProfiles.createMeetingProfile();
          break;
        default:
          return;
      }
      
      loadProfiles(); // Recarrega a lista para mostrar o novo perfil
    } catch (error) {
      console.error('Erro ao criar perfil:', error);
    }
  };

  // Renderiza ícone para o tipo de perfil
  const renderProfileIcon = (type) => {
    switch (type) {
      case PROFILE_TYPES.SLEEP:
        return <span className="text-lg">🌙</span>;
      case PROFILE_TYPES.WORK:
        return <span className="text-lg">💼</span>;
      case PROFILE_TYPES.VACATION:
        return <span className="text-lg">🏖️</span>;
      case PROFILE_TYPES.MEETING:
        return <span className="text-lg">👥</span>;
      default:
        return <span className="text-lg">📱</span>;
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-lg text-paz-blue-800">Perfis de Bloqueio</h3>
            <p className="text-sm text-paz-blue-600">
              {activeProfile ? `Ativo: ${activeProfile.name}` : 'Nenhum perfil ativo'}
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
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-paz-blue-600"></div>
            </div>
          ) : (
            <div>
              {/* Lista de perfis existentes */}
              {profiles.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {profiles.map((profile) => (
                    <div 
                      key={profile.id} 
                      className={`p-3 rounded-lg border ${
                        profile.status === PROFILE_STATUS.ACTIVE 
                          ? 'border-paz-blue-500 bg-paz-blue-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center">
                          {renderProfileIcon(profile.type)}
                          <div className="ml-2">
                            <h4 className="font-medium">{profile.name}</h4>
                            <p className="text-sm text-gray-600">{profile.description}</p>
                          </div>
                        </div>
                        
                        {/* Status Badge */}
                        {profile.status === PROFILE_STATUS.ACTIVE && (
                          <span className="bg-paz-green-100 text-paz-green-800 text-xs px-2 py-1 rounded-full">
                            Ativo
                          </span>
                        )}
                        {profile.status === PROFILE_STATUS.SCHEDULED && (
                          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                            Agendado
                          </span>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="mt-3 flex justify-end space-x-2">
                        {profile.status !== PROFILE_STATUS.ACTIVE && (
                          <button 
                            onClick={() => handleActivateProfile(profile.id)}
                            className="px-3 py-1 bg-paz-blue-600 hover:bg-paz-blue-700 text-white text-sm rounded transition"
                          >
                            Ativar
                          </button>
                        )}
                        {profile.status === PROFILE_STATUS.ACTIVE && (
                          <button 
                            onClick={handleDeactivateAll}
                            className="px-3 py-1 bg-paz-red-600 hover:bg-paz-red-700 text-white text-sm rounded transition"
                          >
                            Desativar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 mb-6">
                  <p className="text-gray-600">
                    Nenhum perfil de bloqueio configurado.
                    Crie um perfil para começar.
                  </p>
                </div>
              )}

              {/* Add new profile section */}
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h4 className="font-medium text-paz-blue-800 mb-3">Adicionar Perfil</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleCreateProfile(PROFILE_TYPES.SLEEP)}
                    className="flex items-center justify-center p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded transition"
                  >
                    <span className="mr-2">🌙</span>
                    <span>Modo Sono</span>
                  </button>
                  <button 
                    onClick={() => handleCreateProfile(PROFILE_TYPES.WORK)}
                    className="flex items-center justify-center p-3 bg-green-50 hover:bg-green-100 text-green-800 rounded transition"
                  >
                    <span className="mr-2">💼</span>
                    <span>Modo Trabalho</span>
                  </button>
                  <button 
                    onClick={() => handleCreateProfile(PROFILE_TYPES.VACATION)}
                    className="flex items-center justify-center p-3 bg-red-50 hover:bg-red-100 text-red-800 rounded transition"
                  >
                    <span className="mr-2">🏖️</span>
                    <span>Modo Férias</span>
                  </button>
                  <button 
                    onClick={() => handleCreateProfile(PROFILE_TYPES.MEETING)}
                    className="flex items-center justify-center p-3 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded transition"
                  >
                    <span className="mr-2">👥</span>
                    <span>Modo Reunião</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BlockProfilesCard;
