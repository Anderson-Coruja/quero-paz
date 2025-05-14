import React, { useState, useEffect } from 'react';
import { runSystemTests } from '../../utils/systemTest';

/**
 * Componente para executar e exibir testes do sistema
 */
const TestRunner = () => {
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);

  // Executar testes quando solicitado
  const executeTests = async () => {
    setIsRunning(true);
    setError(null);
    
    try {
      const testResults = await runSystemTests();
      setResults(testResults);
    } catch (err) {
      setError(err.message || 'Erro desconhecido ao executar testes');
    } finally {
      setIsRunning(false);
    }
  };

  // Formatar resultados de testes individuais
  const formatTestResult = (result) => {
    const statusColor = result.status === 'passed' ? 'text-green-600' : 'text-red-600';
    
    return (
      <div className="mb-4 p-4 border rounded">
        <div className="flex justify-between">
          <h3 className="font-medium">{result.name}</h3>
          <span className={statusColor}>{result.status}</span>
        </div>
        <p className="text-gray-700 mt-1">{result.message}</p>
        {result.details && (
          <div className="mt-2 text-sm bg-gray-100 p-2 rounded">
            <pre>{JSON.stringify(result.details, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Testes do Sistema Quero Paz</h1>
        <button
          onClick={executeTests}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? 'Executando...' : 'Executar Testes'}
        </button>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p className="font-bold">Erro</p>
          <p>{error}</p>
        </div>
      )}
      
      {results && (
        <div className="mb-6">
          <div className={`text-xl font-semibold mb-4 ${
            results.overallStatus === 'passed' ? 'text-green-600' : 'text-red-600'
          }`}>
            Status geral: {results.overallStatus}
            {results.overallStatus === 'passed' && ' ✅'}
            {results.overallStatus === 'failed' && ' ❌'}
          </div>
          
          <div className="mb-4">
            <p><strong>Data do teste:</strong> {new Date(results.timestamp).toLocaleString()}</p>
          </div>
          
          <h2 className="text-xl font-semibold mb-4">Resultados dos Testes</h2>
          
          {Object.entries(results.tests).map(([key, value]) => (
            <div key={key}>
              {formatTestResult({ name: key, ...value })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestRunner;
