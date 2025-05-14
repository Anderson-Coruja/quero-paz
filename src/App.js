import React, { useState } from 'react';
import './App.css';

export default function App() {
  const [isBlocking, setIsBlocking] = useState(true);
  const [view, setView] = useState('main');

  const statusText = isBlocking ? '🛡️ Proteção Ativa' : '😌 Modo Zen';
  const silencedCalls = [
    '11 3030-1122 - Ligação bloqueada às 09:12',
    '85 4002-8922 - Ligação silenciada às 10:03',
    '31 3201-7766 - Mensagem enviada, aguardando retorno',
    '+1 332-555-8899 - DDI bloqueado automaticamente'
  ];

  const pendingConfirmations = [
    '31 3201-7766 - Aguardando retorno',
    '27 3030-1122 - Enviada mensagem',
    '+351 234-567-890 - Bloqueado internacional'
  ];

  if (view === 'settings') {
    return (
      <div className="p-6 text-left">
        <h1 className="text-2xl font-bold mb-4">⚙️ Configurações</h1>
        <ul className="list-disc ml-6">
          <li>Bloquear chamadas internacionais (DDI)</li>
          <li>Priorizar números com DDD local</li>
          <li>Ativar modo Confirma pra Mim para números fixos</li>
        </ul>
        <button onClick={() => setView('main')} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded">Voltar</button>
      </div>
    );
  }

  if (view === 'confirma') {
    return (
      <div className="p-6 text-left">
        <h1 className="text-2xl font-bold mb-4">📩 Confirma pra Mim</h1>
        <ul className="space-y-2">
          {pendingConfirmations.map((item, idx) => (
            <li key={idx} className="flex justify-between items-center">
              <span>{item}</span>
              <button className="px-2 py-1 bg-green-500 text-white rounded">Confiável</button>
            </li>
          ))}
        </ul>
        <button onClick={() => setView('main')} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded">Voltar</button>
      </div>
    );
  }

  return (
    <div className="p-6 text-center">
      <h1 className="text-4xl font-bold mb-4">Quero Paz ✌️</h1>
      <p className="text-xl mb-4">{statusText}</p>
      <button onClick={() => setIsBlocking(!isBlocking)} className="mb-2 px-4 py-2 bg-blue-600 text-white rounded">
        {isBlocking ? 'Desativar Bloqueio' : 'Ativar Bloqueio'}
      </button>
      <br />
      <button onClick={() => setView('settings')} className="mb-2 px-4 py-2 bg-gray-600 text-white rounded">⚙️ Configurações</button>
      <br />
      <button onClick={() => setView('confirma')} className="mb-6 px-4 py-2 bg-purple-600 text-white rounded">📩 Confirma pra Mim</button>

      <hr className="my-6" />
      <h2 className="text-2xl mb-2">Painel de Silêncio</h2>
      <ul className="list-disc text-left ml-6">
        {silencedCalls.map((call, idx) => (
          <li key={idx}>{call}</li>
        ))}
      </ul>
    </div>
  );
}
