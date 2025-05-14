import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  CircularProgress, 
  Divider, 
  FormControlLabel, 
  Grid, 
  IconButton, 
  List, 
  ListItem, 
  ListItemText, 
  Switch, 
  Typography, 
  Tooltip,
  Alert,
  Snackbar
} from '@mui/material';
import { 
  Sync as SyncIcon, 
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import SyncManager from '../../services/sync/syncManager';
import OfflineStorage from '../../services/sync/offlineStorage';

/**
 * SyncPanel Component - Manages offline data synchronization
 * 
 * Provides a UI for users to:
 * - View current sync status
 * - Manually trigger syncs
 * - Configure sync settings
 * - View sync statistics
 */
const SyncPanel = () => {
  // State for sync status
  const [syncStatus, setSyncStatus] = useState({
    isOnline: navigator.onLine,
    lastSync: null,
    pendingChanges: 0,
    isSyncing: false,
    syncError: null,
    autoSync: true
  });
  
  // State for statistics
  const [syncStats, setSyncStats] = useState({
    totalSyncs: 0,
    failedSyncs: 0,
    totalDataSynced: 0, // in KB
    compressionRatio: 0
  });

  // State for notification
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Efeito para inicialização e configuração de listeners
  useEffect(() => {
    // Definir manipuladores de eventos dentro do useEffect para evitar problemas com dependências
    const handleOnlineStatusChangeWithSync = () => {
      setSyncStatus(prev => ({
        ...prev,
        isOnline: navigator.onLine
      }));
      
      // Verifica automaticamente se precisamos sincronizar quando ficar online
      if (navigator.onLine) {
        // Usar a versão máis recente do status via callback
        setSyncStatus(prev => {
          if (prev.pendingChanges > 0 && prev.autoSync) {
            // Agendar a sincronização para o próximo tick para garantir que o estado está atualizado
            setTimeout(() => triggerSync(), 0);
          }
          return prev;
        });
      }
    };

    const loadInitialData = async () => {
      try {
        // Get sync settings from storage
        const settings = await OfflineStorage.getItem('settings', 'syncSettings') || {};
        
        // Get sync stats from storage
        const stats = await OfflineStorage.getItem('statistics', 'syncStats') || {
          totalSyncs: 0,
          failedSyncs: 0,
          totalDataSynced: 0,
          compressionRatio: 0
        };
        
        // Get last sync time
        const lastSync = await OfflineStorage.getItem('sync', 'lastSyncTime');
        
        // Count pending changes
        const pendingChanges = await SyncManager.getPendingChangesCount();
        
        setSyncStatus(prev => ({
          ...prev,
          lastSync,
          pendingChanges,
          autoSync: settings.autoSync !== undefined ? settings.autoSync : true
        }));
        
        setSyncStats(stats);
      } catch (error) {
        console.error('Error loading sync data:', error);
        setNotification({
          open: true,
          message: 'Erro ao carregar dados de sincronização',
          severity: 'error'
        });
      }
    };
    
    loadInitialData();
    
    // Set up event listeners
    window.addEventListener('online', handleOnlineStatusChangeWithSync);
    window.addEventListener('offline', handleOnlineStatusChangeWithSync);
    
    // Subscribe to sync events
    SyncManager.addEventListener('syncStart', handleSyncStart);
    SyncManager.addEventListener('syncComplete', handleSyncComplete);
    SyncManager.addEventListener('syncError', handleSyncError);
    SyncManager.addEventListener('dataChanged', handleDataChanged);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('online', handleOnlineStatusChangeWithSync);
      window.removeEventListener('offline', handleOnlineStatusChangeWithSync);
      
      // Unsubscribe from sync events
      SyncManager.removeEventListener('syncStart', handleSyncStart);
      SyncManager.removeEventListener('syncComplete', handleSyncComplete);
      SyncManager.removeEventListener('syncError', handleSyncError);
      SyncManager.removeEventListener('dataChanged', handleDataChanged);
    };
  }, [/* sem dependências para evitar remontagem */]);

  // Handle online/offline status changes
  const handleOnlineStatusChange = () => {
    setSyncStatus(prev => ({
      ...prev,
      isOnline: navigator.onLine
    }));
  };
  
  // Event handlers for sync events
  const handleSyncStart = () => {
    setSyncStatus(prev => ({
      ...prev,
      isSyncing: true,
      syncError: null
    }));
  };
  
  const handleSyncComplete = (event) => {
    const { syncedData, compressionRatio } = event.detail || {};
    const syncedDataKB = syncedData ? Math.round(syncedData / 1024) : 0;
    
    setSyncStatus(prev => ({
      ...prev,
      isSyncing: false,
      lastSync: new Date(),
      pendingChanges: 0
    }));
    
    setSyncStats(prev => {
      const newStats = {
        totalSyncs: prev.totalSyncs + 1,
        failedSyncs: prev.failedSyncs,
        totalDataSynced: prev.totalDataSynced + syncedDataKB,
        compressionRatio: compressionRatio || prev.compressionRatio
      };
      
      // Save updated stats asynchronously
      OfflineStorage.setItem('statistics', 'syncStats', newStats);
      
      return newStats;
    });
    
    setNotification({
      open: true,
      message: 'Sincronização concluída com sucesso',
      severity: 'success'
    });
  };
  
  const handleSyncError = (event) => {
    // Extrai o erro com fallbacks mais robustos
    let errorMessage = 'Erro desconhecido durante a sincronização';
    
    if (event && event.detail) {
      if (event.detail.error) {
        if (typeof event.detail.error === 'string') {
          errorMessage = event.detail.error;
        } else if (event.detail.error.message) {
          errorMessage = event.detail.error.message;
        } else {
          try {
            errorMessage = event.detail.error.toString();
          } catch (e) {
            // Mantém a mensagem padrão se toString() falhar
          }
        }
      }
    }
    
    console.log('Sync error handler received:', errorMessage);
    
    // Atualiza o estado de sincronização
    setSyncStatus(prev => ({
      ...prev,
      isSyncing: false,
      syncError: errorMessage
    }));
    
    // Atualiza estatísticas de sincronização
    setSyncStats(prev => {
      const newStats = {
        ...prev,
        failedSyncs: (prev.failedSyncs || 0) + 1
      };
      
      // Tenta salvar as estatísticas, com tratamento de erro
      try {
        OfflineStorage.setItem('statistics', 'syncStats', newStats)
          .catch(e => console.error('Erro ao salvar estatísticas:', e));
      } catch (e) {
        console.error('Erro ao salvar estatísticas de sincronização:', e);
      }
      
      return newStats;
    });
    
    // Notifica o usuário
    setNotification({
      open: true,
      message: `Erro na sincronização: ${errorMessage}`,
      severity: 'error'
    });
  };
  
  const handleDataChanged = () => {
    setSyncStatus(prev => ({
      ...prev,
      pendingChanges: prev.pendingChanges + 1
    }));
  };

  // Function to manually trigger sync
  const triggerSync = async () => {
    if (!navigator.onLine) {
      setNotification({
        open: true,
        message: 'Você está offline. A sincronização ocorrerá quando você estiver online novamente.',
        severity: 'warning'
      });
      return;
    }
    
    if (syncStatus.isSyncing) {
      setNotification({
        open: true,
        message: 'Sincronização já em andamento',
        severity: 'info'
      });
      return;
    }
    
    // Atualiza o estado para indicar sincronização em andamento mesmo antes do evento
    setSyncStatus(prev => ({
      ...prev,
      isSyncing: true,
      syncError: null
    }));
    
    try {
      const result = await SyncManager.syncAll();
      // Se chegou aqui, foi sucesso, mas o evento syncComplete também vai ser disparado
      console.log('Sync result:', result);
    } catch (error) {
      console.error('Manual sync error:', error);
      
      // Notifica o usuário diretamente aqui além do evento
      const errorMessage = error?.message || error?.toString() || 'Erro desconhecido';
      
      setNotification({
        open: true,
        message: `Erro na sincronização: ${errorMessage}`,
        severity: 'error'
      });
      
      // Emite um evento personalizado para o handler de sync error
      const errorEvent = new CustomEvent('syncError', { 
        detail: { error: errorMessage } 
      });
      window.dispatchEvent(errorEvent);
      
      // Atualiza o estado
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncError: errorMessage
      }));
    }
  };

  // Toggle auto-sync setting
  const toggleAutoSync = async (event) => {
    const autoSync = event.target.checked;
    
    setSyncStatus(prev => ({
      ...prev,
      autoSync
    }));
    
    // Save the setting
    const settings = await OfflineStorage.getItem('settings', 'syncSettings') || {};
    settings.autoSync = autoSync;
    await OfflineStorage.setItem('settings', 'syncSettings', settings);
    
    setNotification({
      open: true,
      message: `Sincronização automática ${autoSync ? 'ativada' : 'desativada'}`,
      severity: 'info'
    });
  };
  
  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'Nunca';
    if (typeof date === 'string') {
      date = new Date(date);
    }
    return date.toLocaleString();
  };
  
  // Close notification
  const handleCloseNotification = () => {
    setNotification(prev => ({
      ...prev,
      open: false
    }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        Gerenciamento de Sincronização
      </Typography>
      
      <Grid container spacing={3}>
        {/* Status Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h3">
                  Status
                </Typography>
                {syncStatus.isOnline ? (
                  <Tooltip title="Online">
                    <CloudDoneIcon color="primary" sx={{ ml: 1 }} />
                  </Tooltip>
                ) : (
                  <Tooltip title="Offline">
                    <CloudOffIcon color="error" sx={{ ml: 1 }} />
                  </Tooltip>
                )}
              </Box>
              
              <List>
                <ListItem>
                  <ListItemText 
                    primary="Status da conexão"
                    secondary={syncStatus.isOnline ? 'Online' : 'Offline'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Última sincronização"
                    secondary={formatDate(syncStatus.lastSync)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Alterações pendentes"
                    secondary={syncStatus.pendingChanges}
                  />
                </ListItem>
              </List>
              
              <Button
                variant="contained"
                color="primary"
                startIcon={syncStatus.isSyncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
                disabled={!syncStatus.isOnline || syncStatus.isSyncing}
                onClick={triggerSync}
                fullWidth
                sx={{ mt: 2 }}
              >
                {syncStatus.isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
              </Button>
              
              {syncStatus.syncError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {`Erro na última sincronização: ${syncStatus.syncError}`}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Settings Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h3">
                  Configurações
                </Typography>
                <SettingsIcon sx={{ ml: 1 }} />
              </Box>
              
              <List>
                <ListItem>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={syncStatus.autoSync}
                        onChange={toggleAutoSync}
                        color="primary"
                      />
                    }
                    label="Sincronização automática"
                  />
                  <Tooltip title="Sincroniza automaticamente quando você estiver online">
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Stats Card */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h3">
                  Estatísticas de Sincronização
                </Typography>
                <BarChartIcon sx={{ ml: 1 }} />
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Total de sincronizações
                  </Typography>
                  <Typography variant="h5">
                    {syncStats.totalSyncs}
                  </Typography>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Sincronizações falhas
                  </Typography>
                  <Typography variant="h5">
                    {syncStats.failedSyncs}
                  </Typography>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Dados sincronizados
                  </Typography>
                  <Typography variant="h5">
                    {syncStats.totalDataSynced} KB
                  </Typography>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Taxa de compressão
                  </Typography>
                  <Typography variant="h5">
                    {syncStats.compressionRatio.toFixed(2)}x
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
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

export default SyncPanel;
