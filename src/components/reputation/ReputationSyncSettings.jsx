import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  FormControlLabel,
  Switch,
  Slider,
  Button,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  CloudSync as CloudSyncIcon,
  Security as SecurityIcon,
  TrackChanges as TrackChangesIcon,
  BubbleChart as BubbleChartIcon,
  Info as InfoIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon,
  HelpOutline as HelpOutlineIcon
} from '@mui/icons-material';
import OfflineStorage from '../../services/sync/offlineStorage';
import ReputationSync from '../../services/reputation/reputationSync';
import SyncManager from '../../services/sync/syncManager';

/**
 * Componente de Configurações de Sincronização de Reputação
 * 
 * Permite aos usuários configurarem como os dados de reputação são compartilhados
 * e sincronizados entre seus dispositivos e com a comunidade
 */
const ReputationSyncSettings = () => {
  // Estados para as configurações
  const [settings, setSettings] = useState({
    syncEnabled: true,
    contributeToCommunity: true,
    syncFrequency: 60, // em minutos
    privacyLevel: 2, // 1: Compartilhar tudo, 2: Anônimo, 3: Somente local
    autoReconcile: true,
    dataRetentionDays: 90
  });
  
  // Estado para notificações e UI
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  const [loading, setLoading] = useState(true);
  const [syncStats, setSyncStats] = useState({
    queuedEvents: 0,
    lastSync: null,
    syncActive: false
  });
  
  // Carregar configurações ao inicializar
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        
        // Carregar configurações do storage
        const storedSettings = await OfflineStorage.getItem('settings', 'reputationSyncSettings');
        if (storedSettings) {
          setSettings(prev => ({ ...prev, ...storedSettings }));
        }
        
        // Carregar estatísticas de sincronização
        updateSyncStats();
        
        // Registrar event listeners
        ReputationSync.addEventListener('syncStart', handleSyncStatusChange);
        ReputationSync.addEventListener('syncComplete', handleSyncStatusChange);
        ReputationSync.addEventListener('syncError', handleSyncStatusChange);
        ReputationSync.addEventListener('eventQueued', handleSyncStatusChange);
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading reputation sync settings:', error);
        setNotification({
          open: true,
          message: 'Erro ao carregar configurações de sincronização',
          severity: 'error'
        });
        setLoading(false);
      }
    };
    
    loadSettings();
    
    // Limpar event listeners ao desmontar
    return () => {
      ReputationSync.removeEventListener('syncStart', handleSyncStatusChange);
      ReputationSync.removeEventListener('syncComplete', handleSyncStatusChange);
      ReputationSync.removeEventListener('syncError', handleSyncStatusChange);
      ReputationSync.removeEventListener('eventQueued', handleSyncStatusChange);
    };
  }, []);
  
  // Atualizar estatísticas de sincronização
  const updateSyncStats = async () => {
    try {
      // Obter número de eventos na fila
      const pendingEvents = await OfflineStorage.getItem('reputation', 'pendingReputationEvents') || [];
      
      // Obter última data de sincronização
      const lastSync = await OfflineStorage.getItem('reputation', 'lastReputationSync');
      
      setSyncStats({
        queuedEvents: pendingEvents.length,
        lastSync,
        syncActive: ReputationSync.syncInProgress
      });
    } catch (error) {
      console.error('Error updating sync stats:', error);
    }
  };
  
  // Handler para mudanças nos eventos de sincronização
  const handleSyncStatusChange = () => {
    updateSyncStats();
  };
  
  // Salvar configurações quando alteradas
  const saveSettings = async () => {
    try {
      await OfflineStorage.setItem('settings', 'reputationSyncSettings', settings);
      
      setNotification({
        open: true,
        message: 'Configurações salvas com sucesso',
        severity: 'success'
      });
      
      // Aplicar configurações ao sistema de sincronização
      applySettingsToSyncSystem();
    } catch (error) {
      console.error('Error saving reputation sync settings:', error);
      setNotification({
        open: true,
        message: 'Erro ao salvar configurações',
        severity: 'error'
      });
    }
  };
  
  // Aplicar configurações ao sistema de sincronização
  const applySettingsToSyncSystem = () => {
    // Configurar frequência de sincronização
    SyncManager.setSettings({
      syncInterval: settings.syncEnabled ? settings.syncFrequency * 60 * 1000 : 0
    });
    
    // Outras configurações específicas podem ser aplicadas aqui
  };
  
  // Iniciar sincronização manual
  const triggerManualSync = async () => {
    if (syncStats.syncActive) {
      setNotification({
        open: true,
        message: 'Sincronização já em andamento',
        severity: 'info'
      });
      return;
    }
    
    try {
      setNotification({
        open: true,
        message: 'Iniciando sincronização...',
        severity: 'info'
      });
      
      await ReputationSync.syncPendingEvents();
      updateSyncStats();
    } catch (error) {
      console.error('Error triggering manual sync:', error);
      setNotification({
        open: true,
        message: `Erro ao sincronizar: ${error.message || 'Erro desconhecido'}`,
        severity: 'error'
      });
    }
  };
  
  // Auxiliar para formatar data
  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Fechar notificação
  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };
  
  // Atualizar configuração
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Configurações de Sincronização de Reputação
      </Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Status da Sincronização */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CloudSyncIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Status da Sincronização
                </Typography>
              </Box>
              
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Última sincronização" 
                    secondary={formatDate(syncStats.lastSync)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Eventos pendentes" 
                    secondary={syncStats.queuedEvents}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Status" 
                    secondary={syncStats.syncActive ? 'Sincronizando...' : 'Aguardando'}
                  />
                  {syncStats.syncActive && <CircularProgress size={20} sx={{ ml: 1 }} />}
                </ListItem>
              </List>
              
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshIcon />}
                onClick={triggerManualSync}
                disabled={syncStats.syncActive || !settings.syncEnabled}
                fullWidth
                sx={{ mt: 2 }}
              >
                Sincronizar Agora
              </Button>
            </CardContent>
          </Card>
          
          {/* Configurações Gerais */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrackChangesIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Configurações Gerais
                </Typography>
              </Box>
              
              <List>
                <ListItem>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.syncEnabled}
                        onChange={(e) => updateSetting('syncEnabled', e.target.checked)}
                      />
                    }
                    label="Habilitar sincronização"
                  />
                  <Tooltip title="Quando ativado, seus dados de reputação serão sincronizados entre seus dispositivos">
                    <IconButton size="small">
                      <HelpOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItem>
                
                <ListItem>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.autoReconcile}
                        onChange={(e) => updateSetting('autoReconcile', e.target.checked)}
                        disabled={!settings.syncEnabled}
                      />
                    }
                    label="Reconciliação automática"
                  />
                  <Tooltip title="Resolve automaticamente conflitos entre dados locais e remotos">
                    <IconButton size="small">
                      <HelpOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItem>
                
                <ListItem sx={{ display: 'block' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography id="frequency-slider-label">
                      Frequência de sincronização
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {settings.syncFrequency} minutos
                    </Typography>
                  </Box>
                  <Slider
                    value={settings.syncFrequency}
                    onChange={(e, value) => updateSetting('syncFrequency', value)}
                    min={15}
                    max={240}
                    step={15}
                    marks={[
                      { value: 15, label: '15m' },
                      { value: 60, label: '1h' },
                      { value: 120, label: '2h' },
                      { value: 240, label: '4h' },
                    ]}
                    valueLabelDisplay="auto"
                    aria-labelledby="frequency-slider-label"
                    disabled={!settings.syncEnabled}
                  />
                </ListItem>
                
                <ListItem sx={{ display: 'block' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography id="retention-slider-label">
                      Retenção de dados
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {settings.dataRetentionDays} dias
                    </Typography>
                  </Box>
                  <Slider
                    value={settings.dataRetentionDays}
                    onChange={(e, value) => updateSetting('dataRetentionDays', value)}
                    min={30}
                    max={365}
                    step={30}
                    marks={[
                      { value: 30, label: '1m' },
                      { value: 90, label: '3m' },
                      { value: 180, label: '6m' },
                      { value: 365, label: '1a' },
                    ]}
                    valueLabelDisplay="auto"
                    aria-labelledby="retention-slider-label"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
          
          {/* Configurações de Privacidade */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SecurityIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Privacidade e Compartilhamento
                </Typography>
              </Box>
              
              <List>
                <ListItem>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.contributeToCommunity}
                        onChange={(e) => updateSetting('contributeToCommunity', e.target.checked)}
                        disabled={!settings.syncEnabled}
                      />
                    }
                    label="Contribuir com a comunidade"
                  />
                  <Tooltip title="Compartilha dados anônimos para melhorar a detecção de spam e golpes para todos">
                    <IconButton size="small">
                      <HelpOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItem>
                
                <ListItem sx={{ display: 'block' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography id="privacy-slider-label">
                      Nível de privacidade
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {settings.privacyLevel === 1 ? 'Compartilhar tudo' : 
                       settings.privacyLevel === 2 ? 'Anônimo' : 'Somente local'}
                    </Typography>
                  </Box>
                  <Slider
                    value={settings.privacyLevel}
                    onChange={(e, value) => updateSetting('privacyLevel', value)}
                    min={1}
                    max={3}
                    step={1}
                    marks={[
                      { value: 1, label: 'Aberto' },
                      { value: 2, label: 'Anônimo' },
                      { value: 3, label: 'Privado' },
                    ]}
                    valueLabelDisplay="auto"
                    aria-labelledby="privacy-slider-label"
                    disabled={!settings.syncEnabled || !settings.contributeToCommunity}
                  />
                </ListItem>
              </List>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                <AlertTitle>Sobre a privacidade</AlertTitle>
                No modo <strong>Anônimo</strong>, seus dados são anonimizados antes de serem compartilhados.
                No modo <strong>Privado</strong>, seus dados nunca deixam o dispositivo, mas você ainda se beneficia dos dados da comunidade.
              </Alert>
            </CardContent>
          </Card>
          
          {/* Botão de Salvar */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<CheckIcon />}
              onClick={saveSettings}
            >
              Salvar Configurações
            </Button>
          </Box>
        </>
      )}
      
      {/* Notificações */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ReputationSyncSettings;
