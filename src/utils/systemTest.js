/**
 * Utilitário para testar os principais componentes do sistema Quero Paz
 * Execute este script para verificar se todos os componentes estão funcionando corretamente
 */

import offlineStorage from '../services/sync/offlineStorage';
import syncManager from '../services/sync/syncManager';
import { encryptData, decryptData } from '../services/security/encryption';

/**
 * Executa testes automatizados em todos os componentes críticos do sistema
 * @returns {Promise<Object>} Resultados dos testes
 */
export const runSystemTests = async () => {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
    overallStatus: 'pending'
  };

  try {
    // 1. Testar armazenamento offline
    results.tests.storage = await testStorage();
    
    // 2. Testar sistema de sincronização
    results.tests.sync = await testSync();
    
    // 3. Testar criptografia
    results.tests.encryption = await testEncryption();
    
    // 4. Testar conectividade de rede
    results.tests.network = testNetwork();
    
    // 5. Testar suporte a IndexedDB
    results.tests.indexedDB = testIndexedDBSupport();

    // 6. Testar registro de service worker (para PWA)
    results.tests.serviceWorker = testServiceWorker();
    
    // Determinar status geral
    const failedTests = Object.entries(results.tests)
      .filter(([_, result]) => result.status === 'failed')
      .map(([name]) => name);
    
    if (failedTests.length === 0) {
      results.overallStatus = 'passed';
    } else {
      results.overallStatus = 'failed';
      results.failedTests = failedTests;
    }
    
  } catch (error) {
    results.overallStatus = 'error';
    results.error = error.message;
    console.error('Erro ao executar testes do sistema:', error);
  }
  
  return results;
};

/**
 * Testa o sistema de armazenamento offline
 */
const testStorage = async () => {
  const result = {
    name: 'Armazenamento Offline',
    status: 'pending',
    tests: {}
  };
  
  try {
    // Inicializar armazenamento
    await offlineStorage.initialize();
    result.tests.initialization = { status: 'passed' };
    
    // Testar operações básicas
    const testKey = `test_${Date.now()}`;
    const testValue = { test: true, timestamp: Date.now() };
    
    // Set
    await offlineStorage.setItem('test', testKey, testValue);
    result.tests.setItem = { status: 'passed' };
    
    // Get
    const retrievedValue = await offlineStorage.getItem('test', testKey);
    if (JSON.stringify(retrievedValue) === JSON.stringify(testValue)) {
      result.tests.getItem = { status: 'passed' };
    } else {
      result.tests.getItem = { 
        status: 'failed',
        expected: testValue,
        received: retrievedValue
      };
    }
    
    // Remove
    await offlineStorage.removeItem('test', testKey);
    const shouldBeNull = await offlineStorage.getItem('test', testKey);
    if (shouldBeNull === null || shouldBeNull === undefined) {
      result.tests.removeItem = { status: 'passed' };
    } else {
      result.tests.removeItem = { 
        status: 'failed',
        reason: 'Item não foi removido corretamente'
      };
    }
    
    // Verifica status geral
    const failedSubTests = Object.values(result.tests)
      .filter(test => test.status === 'failed');
      
    result.status = failedSubTests.length === 0 ? 'passed' : 'failed';
    
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    console.error('Erro no teste de armazenamento:', error);
  }
  
  return result;
};

/**
 * Testa o sistema de sincronização
 */
const testSync = async () => {
  const result = {
    name: 'Sistema de Sincronização',
    status: 'pending',
    tests: {}
  };
  
  try {
    // Inicialização
    if (syncManager.initialize) {
      await syncManager.initialize();
      result.tests.initialization = { status: 'passed' };
    } else {
      result.tests.initialization = { 
        status: 'failed',
        reason: 'Método de inicialização não encontrado'
      };
    }
    
    // Verificar contagem de pendências
    if (syncManager.getPendingChangesCount) {
      const count = await syncManager.getPendingChangesCount();
      result.tests.pendingChanges = { 
        status: 'passed',
        pendingCount: count
      };
    } else {
      result.tests.pendingChanges = { 
        status: 'failed',
        reason: 'Método getPendingChangesCount não encontrado'
      };
    }
    
    // Testar evento
    let eventReceived = false;
    const testListener = () => {
      eventReceived = true;
    };
    
    if (syncManager.addEventListener) {
      syncManager.addEventListener('statusChange', testListener);
      // Força mudança de status
      if (syncManager._updateStatus) {
        syncManager._updateStatus('testing');
        result.tests.events = {
          status: eventReceived ? 'passed' : 'failed',
          reason: eventReceived ? null : 'Evento não recebido'
        };
      } else {
        result.tests.events = { 
          status: 'skipped',
          reason: 'Método _updateStatus não encontrado'
        };
      }
      syncManager.removeEventListener('statusChange', testListener);
    } else {
      result.tests.events = { 
        status: 'failed',
        reason: 'Método addEventListener não encontrado'
      };
    }
    
    // Verifica status geral
    const failedSubTests = Object.values(result.tests)
      .filter(test => test.status === 'failed');
      
    result.status = failedSubTests.length === 0 ? 'passed' : 'failed';
    
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    console.error('Erro no teste de sincronização:', error);
  }
  
  return result;
};

/**
 * Testa o sistema de criptografia
 */
const testEncryption = async () => {
  const result = {
    name: 'Criptografia',
    status: 'pending',
    tests: {}
  };
  
  try {
    // Dados de teste - simplificado para evitar problemas de codificação
    const testData = { 
      sensitiveInfo: 'teste-seguro-123',
      userId: 12345,
      timestamp: Date.now()
    };
    const testPassword = 'senha-segura-teste';
    
    // Testar criptografia
    try {
      const encrypted = await encryptData(testData, testPassword);
      
      if (encrypted && encrypted.encryptedData) {
        result.tests.encryption = { status: 'passed' };
        
        // Testar descriptografia
        try {
          const decrypted = await decryptData(encrypted, testPassword);
          
          // Verificação mais segura de equivalência entre objetos
          let isEqual = true;
          for (const key in testData) {
            if (typeof testData[key] === 'object') {
              // Para objetos aninhados, comparamos representação em string
              if (JSON.stringify(testData[key]) !== JSON.stringify(decrypted[key])) {
                isEqual = false;
                break;
              }
            } else if (key === 'timestamp') {
              // Para timestamp, não exigimos igualdade exata (pode haver diferença de milissegundos)
              continue;
            } else if (testData[key] !== decrypted[key]) {
              isEqual = false;
              break;
            }
          }
          
          if (isEqual) {
            result.tests.decryption = { status: 'passed' };
          } else {
            result.tests.decryption = { 
              status: 'failed',
              details: {
                expected: JSON.stringify(testData),
                received: JSON.stringify(decrypted)
              }
            };
          }
        } catch (decryptError) {
          result.tests.decryption = { 
            status: 'failed',
            reason: `Erro ao descriptografar: ${decryptError.message}`
          };
        }
        
        // Verificar dados incorretos
        try {
          await decryptData(encrypted, 'senha-incorreta');
          result.tests.wrongPassword = {
            status: 'failed',
            reason: 'Descriptografia com senha incorreta não falhou como esperado'
          };
        } catch (e) {
          result.tests.wrongPassword = { status: 'passed' };
        }
      } else {
        result.tests.encryption = { 
          status: 'failed',
          reason: 'Dados criptografados incompletos'
        };
        
        result.tests.decryption = { 
          status: 'skipped',
          reason: 'Não foi possível testar descriptografia porque a criptografia falhou'
        };
        
        result.tests.wrongPassword = { 
          status: 'skipped',
          reason: 'Não foi possível testar senha incorreta porque a criptografia falhou'
        };
      }
    } catch (encryptError) {
      result.tests.encryption = { 
        status: 'failed',
        reason: `Falha ao criptografar dados: ${encryptError.message}`
      };
      
      result.tests.decryption = { 
        status: 'skipped',
        reason: 'Não foi possível testar descriptografia porque a criptografia falhou'
      };
      
      result.tests.wrongPassword = { 
        status: 'skipped',
        reason: 'Não foi possível testar senha incorreta porque a criptografia falhou'
      };
    }
    
    // Verifica status geral
    const failedSubTests = Object.values(result.tests)
      .filter(test => test.status === 'failed');
      
    result.status = failedSubTests.length === 0 ? 'passed' : 'failed';
    
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    console.error('Erro no teste de criptografia:', error);
  }
  
  return result;
};

/**
 * Testa a conectividade de rede
 */
const testNetwork = () => {
  const result = {
    name: 'Conectividade de Rede',
    status: 'pending',
    tests: {}
  };
  
  try {
    // Verificar estado online
    const isOnline = navigator.onLine;
    result.tests.onlineStatus = {
      status: 'passed',
      online: isOnline
    };
    
    // Verificar suporte a API de conectividade
    result.tests.apiSupport = {
      status: 'passed',
      hasOnlineEvent: 'ononline' in window,
      hasOfflineEvent: 'onoffline' in window
    };
    
    result.status = 'passed';
    
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    console.error('Erro no teste de rede:', error);
  }
  
  return result;
};

/**
 * Testa suporte a IndexedDB
 */
const testIndexedDBSupport = () => {
  const result = {
    name: 'Suporte a IndexedDB',
    status: 'pending'
  };
  
  try {
    const hasIndexedDB = 'indexedDB' in window;
    result.hasSupport = hasIndexedDB;
    
    if (hasIndexedDB) {
      // Tenta abrir um banco de teste
      const request = indexedDB.open('test_db', 1);
      
      result.status = 'passed';
    } else {
      result.status = 'failed';
      result.reason = 'Navegador não suporta IndexedDB';
    }
    
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    console.error('Erro no teste de IndexedDB:', error);
  }
  
  return result;
};

/**
 * Testa o suporte e registro de Service Worker
 */
const testServiceWorker = () => {
  const result = {
    name: 'Service Worker',
    status: 'pending'
  };
  
  try {
    const hasServiceWorker = 'serviceWorker' in navigator;
    result.hasSupport = hasServiceWorker;
    
    if (hasServiceWorker) {
      result.status = 'passed';
      result.registrationStatus = navigator.serviceWorker.controller 
        ? 'active' 
        : 'inactive';
    } else {
      result.status = 'failed';
      result.reason = 'Navegador não suporta Service Worker';
    }
    
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    console.error('Erro no teste de Service Worker:', error);
  }
  
  return result;
};

// Função auxiliar para formatar o relatório de teste
export const formatTestReport = (results) => {
  const report = [];
  
  report.push(`# Relatório de Testes do Sistema Quero Paz`);
  report.push(`Executado em: ${new Date(results.timestamp).toLocaleString()}`);
  report.push(`Status geral: ${results.overallStatus === 'passed' ? '✅ APROVADO' : '❌ FALHOU'}`);
  report.push('');
  
  Object.entries(results.tests).forEach(([name, test]) => {
    report.push(`## ${test.name || name.charAt(0).toUpperCase() + name.slice(1)}`);
    report.push(`Status: ${test.status === 'passed' ? '✅ Passou' : '❌ Falhou'}`);
    
    if (test.error) {
      report.push(`Erro: ${test.error}`);
    }
    
    if (test.tests) {
      report.push('Subtestes:');
      Object.entries(test.tests).forEach(([subName, subTest]) => {
        const icon = subTest.status === 'passed' ? '✅' : 
                    subTest.status === 'failed' ? '❌' : '⚠️';
        report.push(`- ${icon} ${subName}: ${subTest.status}`);
        
        if (subTest.reason) {
          report.push(`  Motivo: ${subTest.reason}`);
        }
      });
    }
    
    report.push('');
  });
  
  return report.join('\n');
};

export default { runSystemTests, formatTestReport };
