import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterListIcon,
  DataUsage as DataUsageIcon
} from '@mui/icons-material';
import OfflineStorage from '../../services/sync/offlineStorage';
import SyncManager from '../../services/sync/syncManager';

/**
 * SyncHistoryViewer Component - Displays detailed sync history
 * 
 * Provides:
 * - Visualization of sync history with timestamps
 * - Details of each sync operation including size and status
 * - Data analytics for sync operations
 */
const SyncHistoryViewer = () => {
  // State for sync history records
  const [syncHistory, setSyncHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);
  const [detailsDialog, setDetailsDialog] = useState({
    open: false,
    details: null
  });
  
  // Filtering and sorting options
  const [filters, setFilters] = useState({
    status: 'all', // 'all', 'success', 'failed'
    timeRange: 'all', // 'all', 'today', 'week', 'month'
    sortBy: 'date', // 'date', 'size', 'duration'
    sortOrder: 'desc' // 'asc', 'desc'
  });
  
  // State for filter dialog
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  
  // Load sync history
  useEffect(() => {
    loadSyncHistory();
  }, []);
  
  // Function to load sync history from storage
  const loadSyncHistory = async () => {
    setLoadingHistory(true);
    try {
      // Get sync history from storage
      const history = await OfflineStorage.getItem('statistics', 'syncHistory') || [];
      setSyncHistory(history);
    } catch (error) {
      console.error('Error loading sync history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };
  
  // Handle expanding a row to show more details
  const handleExpandRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index);
  };
  
  // Handle opening details dialog
  const handleOpenDetails = (details) => {
    setDetailsDialog({
      open: true,
      details
    });
  };
  
  // Handle closing details dialog
  const handleCloseDetails = () => {
    setDetailsDialog({
      open: false,
      details: null
    });
  };
  
  // Handle deleting a sync history entry
  const handleDeleteEntry = async (id) => {
    try {
      const updatedHistory = syncHistory.filter(entry => entry.id !== id);
      setSyncHistory(updatedHistory);
      
      // Save updated history to storage
      await OfflineStorage.setItem('statistics', 'syncHistory', updatedHistory);
    } catch (error) {
      console.error('Error deleting sync history entry:', error);
    }
  };
  
  // Filter and sort sync history based on current filters
  const getFilteredAndSortedHistory = () => {
    // Apply status filter
    let filtered = [...syncHistory];
    if (filters.status !== 'all') {
      filtered = filtered.filter(entry => {
        return filters.status === 'success' ? entry.success : !entry.success;
      });
    }
    
    // Apply time range filter
    const now = new Date();
    if (filters.timeRange !== 'all') {
      let cutoffDate;
      if (filters.timeRange === 'today') {
        cutoffDate = new Date(now.setHours(0, 0, 0, 0));
      } else if (filters.timeRange === 'week') {
        cutoffDate = new Date(now.setDate(now.getDate() - 7));
      } else if (filters.timeRange === 'month') {
        cutoffDate = new Date(now.setMonth(now.getMonth() - 1));
      }
      
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= cutoffDate;
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      if (filters.sortBy === 'date') {
        aValue = new Date(a.timestamp).getTime();
        bValue = new Date(b.timestamp).getTime();
      } else if (filters.sortBy === 'size') {
        aValue = a.dataSize || 0;
        bValue = b.dataSize || 0;
      } else if (filters.sortBy === 'duration') {
        aValue = a.duration || 0;
        bValue = b.duration || 0;
      }
      
      return filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
    
    return filtered;
  };
  
  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Format size for display
  const formatSize = (size) => {
    if (size === undefined || size === null) return 'N/A';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };
  
  // Format duration for display
  const formatDuration = (duration) => {
    if (duration === undefined || duration === null) return 'N/A';
    if (duration < 1000) return `${duration} ms`;
    return `${(duration / 1000).toFixed(2)} s`;
  };
  
  // Get summary statistics for display
  const getSyncSummary = () => {
    // Avoid calculations if no history
    if (!syncHistory.length) {
      return {
        totalSyncs: 0,
        successRate: 0,
        avgSize: 0,
        avgDuration: 0,
        totalDataSynced: 0
      };
    }
    
    const totalSyncs = syncHistory.length;
    const successfulSyncs = syncHistory.filter(entry => entry.success).length;
    const successRate = (successfulSyncs / totalSyncs) * 100;
    
    // Calculate sizes and durations only for successful syncs to avoid skewing the data
    const successEntries = syncHistory.filter(entry => entry.success);
    const totalSize = successEntries.reduce((sum, entry) => sum + (entry.dataSize || 0), 0);
    const totalDuration = successEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    
    return {
      totalSyncs,
      successRate: successRate.toFixed(1),
      avgSize: successEntries.length ? totalSize / successEntries.length : 0,
      avgDuration: successEntries.length ? totalDuration / successEntries.length : 0,
      totalDataSynced: totalSize
    };
  };
  
  // Save filter changes
  const handleSaveFilters = () => {
    setFilterDialogOpen(false);
    // The filters state is already updated by the inputs
  };
  
  // Get filterable sync types
  const getSyncTypes = () => {
    const types = new Set();
    syncHistory.forEach(entry => {
      if (entry.type) types.add(entry.type);
    });
    return Array.from(types);
  };
  
  // Refresh the history
  const handleRefresh = () => {
    loadSyncHistory();
  };
  
  // Get the filtered and sorted history for display
  const filteredHistory = getFilteredAndSortedHistory();
  const syncSummary = getSyncSummary();
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        Histórico de Sincronização
      </Typography>
      
      {/* Summary Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" component="h3">
              Resumo de Sincronização
            </Typography>
            <DataUsageIcon sx={{ ml: 1 }} />
          </Box>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ minWidth: 120 }}>
              <Typography variant="body2" color="textSecondary">
                Total de Sincronizações
              </Typography>
              <Typography variant="h6">
                {syncSummary.totalSyncs}
              </Typography>
            </Box>
            
            <Box sx={{ minWidth: 120 }}>
              <Typography variant="body2" color="textSecondary">
                Taxa de Sucesso
              </Typography>
              <Typography variant="h6">
                {syncSummary.successRate}%
              </Typography>
            </Box>
            
            <Box sx={{ minWidth: 120 }}>
              <Typography variant="body2" color="textSecondary">
                Tamanho Médio
              </Typography>
              <Typography variant="h6">
                {formatSize(syncSummary.avgSize)}
              </Typography>
            </Box>
            
            <Box sx={{ minWidth: 120 }}>
              <Typography variant="body2" color="textSecondary">
                Duração Média
              </Typography>
              <Typography variant="h6">
                {formatDuration(syncSummary.avgDuration)}
              </Typography>
            </Box>
            
            <Box sx={{ minWidth: 120 }}>
              <Typography variant="body2" color="textSecondary">
                Total de Dados
              </Typography>
              <Typography variant="h6">
                {formatSize(syncSummary.totalDataSynced)}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      {/* Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={loadingHistory}
        >
          Atualizar
        </Button>
        
        <Button
          startIcon={<FilterListIcon />}
          onClick={() => setFilterDialogOpen(true)}
        >
          Filtrar
        </Button>
      </Box>
      
      {/* History Table */}
      {loadingHistory ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : filteredHistory.length === 0 ? (
        <Typography variant="body1" sx={{ textAlign: 'center', p: 3 }}>
          Nenhum histórico de sincronização encontrado.
        </Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell></TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Tamanho</TableCell>
                <TableCell>Duração</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredHistory.map((entry, index) => (
                <React.Fragment key={entry.id || index}>
                  <TableRow>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        onClick={() => handleExpandRow(index)}
                      >
                        {expandedRow === index ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>{formatDate(entry.timestamp)}</TableCell>
                    <TableCell>{entry.type || 'Manual'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={entry.success ? 'Sucesso' : 'Falha'} 
                        color={entry.success ? 'success' : 'error'} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>{formatSize(entry.dataSize)}</TableCell>
                    <TableCell>{formatDuration(entry.duration)}</TableCell>
                    <TableCell>
                      <Tooltip title="Ver detalhes">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDetails(entry)}
                        >
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir entrada">
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteEntry(entry.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded row details */}
                  {expandedRow === index && (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ py: 0 }}>
                        <Box sx={{ p: 2, backgroundColor: 'background.default' }}>
                          <Typography variant="subtitle2">
                            Detalhes da Sincronização:
                          </Typography>
                          
                          {entry.error && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="body2" color="error">
                                Erro: {entry.error}
                              </Typography>
                            </Box>
                          )}
                          
                          {entry.details && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="body2">
                                {entry.details.map((detail, idx) => (
                                  <div key={idx}>{detail}</div>
                                ))}
                              </Typography>
                            </Box>
                          )}
                          
                          {entry.compressionRatio && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="body2">
                                Taxa de compressão: {entry.compressionRatio.toFixed(2)}x
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Filter Dialog */}
      <Dialog open={filterDialogOpen} onClose={() => setFilterDialogOpen(false)}>
        <DialogTitle>Filtros</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="success">Sucesso</MenuItem>
              <MenuItem value="failed">Falha</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Período</InputLabel>
            <Select
              value={filters.timeRange}
              label="Período"
              onChange={(e) => setFilters({ ...filters, timeRange: e.target.value })}
            >
              <MenuItem value="all">Todo o período</MenuItem>
              <MenuItem value="today">Hoje</MenuItem>
              <MenuItem value="week">Última semana</MenuItem>
              <MenuItem value="month">Último mês</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Ordenar por</InputLabel>
            <Select
              value={filters.sortBy}
              label="Ordenar por"
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
            >
              <MenuItem value="date">Data</MenuItem>
              <MenuItem value="size">Tamanho</MenuItem>
              <MenuItem value="duration">Duração</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Ordem</InputLabel>
            <Select
              value={filters.sortOrder}
              label="Ordem"
              onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value })}
            >
              <MenuItem value="desc">Decrescente</MenuItem>
              <MenuItem value="asc">Crescente</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilterDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSaveFilters} variant="contained">Aplicar</Button>
        </DialogActions>
      </Dialog>
      
      {/* Details Dialog */}
      <Dialog open={detailsDialog.open} onClose={handleCloseDetails} maxWidth="md">
        <DialogTitle>Detalhes da Sincronização</DialogTitle>
        <DialogContent>
          {detailsDialog.details && (
            <Box sx={{ minWidth: 400 }}>
              <Typography variant="subtitle1" gutterBottom>
                {formatDate(detailsDialog.details.timestamp)}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row">Tipo</TableCell>
                      <TableCell>{detailsDialog.details.type || 'Manual'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Status</TableCell>
                      <TableCell>
                        <Chip 
                          label={detailsDialog.details.success ? 'Sucesso' : 'Falha'} 
                          color={detailsDialog.details.success ? 'success' : 'error'} 
                          size="small" 
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Tamanho</TableCell>
                      <TableCell>{formatSize(detailsDialog.details.dataSize)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Duração</TableCell>
                      <TableCell>{formatDuration(detailsDialog.details.duration)}</TableCell>
                    </TableRow>
                    {detailsDialog.details.compressionRatio && (
                      <TableRow>
                        <TableCell component="th" scope="row">Taxa de compressão</TableCell>
                        <TableCell>{detailsDialog.details.compressionRatio.toFixed(2)}x</TableCell>
                      </TableRow>
                    )}
                    {detailsDialog.details.device && (
                      <TableRow>
                        <TableCell component="th" scope="row">Dispositivo</TableCell>
                        <TableCell>{detailsDialog.details.device}</TableCell>
                      </TableRow>
                    )}
                    {detailsDialog.details.network && (
                      <TableRow>
                        <TableCell component="th" scope="row">Rede</TableCell>
                        <TableCell>{detailsDialog.details.network}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {detailsDialog.details.error && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="error">
                    Erro:
                  </Typography>
                  <Box sx={{ p: 1, bgcolor: 'error.light', borderRadius: 1, mt: 1 }}>
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                      {detailsDialog.details.error}
                    </Typography>
                  </Box>
                </Box>
              )}
              
              {detailsDialog.details.details && detailsDialog.details.details.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">
                    Detalhes adicionais:
                  </Typography>
                  <List>
                    {detailsDialog.details.details.map((detail, idx) => (
                      <Typography key={idx} variant="body2" component="li" sx={{ ml: 2 }}>
                        {detail}
                      </Typography>
                    ))}
                  </List>
                </Box>
              )}
              
              {detailsDialog.details.syncedItems && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">
                    Itens sincronizados:
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Tipo</TableCell>
                          <TableCell>Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(detailsDialog.details.syncedItems).map(([itemType, count]) => (
                          <TableRow key={itemType}>
                            <TableCell>{itemType}</TableCell>
                            <TableCell>{count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SyncHistoryViewer;
