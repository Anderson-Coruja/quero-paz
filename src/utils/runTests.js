/**
 * Script para executar os testes do sistema Quero Paz
 * Este arquivo executa o utilitário de teste e exibe os resultados formatados
 */

import { runSystemTests, formatTestReport } from './systemTest';

// Função principal para executar os testes
async function executeTests() {
  console.log('🧪 Iniciando testes do sistema Quero Paz...');
  
  try {
    // Executar todos os testes
    const results = await runSystemTests();
    
    // Formatar e exibir os resultados
    const report = formatTestReport(results);
    
    console.log('\n===== RELATÓRIO DE TESTES DO SISTEMA =====');
    console.log(report);
    console.log('=========================================\n');
    
    return results;
  } catch (error) {
    console.error('❌ Erro ao executar testes:', error);
    return {
      overallStatus: 'error',
      error: error.message
    };
  }
}

// Executar os testes
executeTests().then(results => {
  if (results.overallStatus === 'passed') {
    console.log('✅ Todos os testes passaram com sucesso!');
  } else if (results.overallStatus === 'failed') {
    console.log('⚠️ Alguns testes falharam:', results.failedTests);
  } else {
    console.log('❌ Erro ao executar os testes');
  }
});

// Exporta a função para uso em outros componentes se necessário
export default executeTests;
