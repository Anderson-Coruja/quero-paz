# Quero Paz - Aplicativo de Bem-estar e Privacidade

Um aplicativo web progressivo (PWA) para gerenciar chamadas, mensagens e privacidade com foco em bem-estar.

## 📱 Versão para Testes (v1.0)

Esta versão do Quero Paz está disponível para testes iniciais e inclui as seguintes funcionalidades:

### ✅ Funcionalidades Disponíveis

- **Armazenamento Offline**: Dados armazenados localmente via IndexedDB com criptografia
- **Sincronização Básica**: Sincronização de configurações entre dispositivos (quando online)
- **Bloqueio de Chamadas**: Simulação e gerenciamento de chamadas bloqueadas
- **Configurações de Privacidade**: Gerenciamento de configurações de privacidade e segurança
- **Interface Responsiva**: Design adaptável para diferentes dispositivos

### 🔜 Funcionalidades Futuras (Não Disponíveis Nesta Versão)

- **Voicemail**: Recebimento e transcrição de mensagens de voz (implementação futura)
- **Webhooks**: Integração com serviços externos (implementação futura)
- **Transcrição de Áudio**: Conversão de mensagens de voz para texto (implementação futura)
- **Análise de Sentimento**: Categorização de mensagens por sentimento (implementação futura)

## 🚀 Começando

### Pré-requisitos

- Node.js (v14 ou superior)
- npm ou yarn

### Instalação

1. Clone o repositório
   ```bash
   git clone https://github.com/seu-usuario/quero-paz.git
   cd quero-paz-webapp
   ```

2. Instale as dependências
   ```bash
   npm install
   # ou
   yarn install
   ```

3. Execute o projeto em modo de desenvolvimento
   ```bash
   npm start
   # ou
   yarn start
   ```

4. Construa a versão de produção
   ```bash
   npm run build
   # ou
   yarn build
   ```

## 🏗️ Arquitetura

### Estrutura de Diretórios

```
quero-paz-webapp/
├── public/          # Arquivos estáticos e Service Worker
├── src/
│   ├── components/  # Componentes de UI reutilizáveis
│   ├── services/    # Serviços e lógica de negócios
│   │   ├── integration/  # Integrações com sistemas externos
│   │   ├── security/     # Módulos de segurança e criptografia
│   │   └── sync/         # Sistema de sincronização
│   ├── utils/       # Utilidades e helpers
│   ├── App.js       # Componente principal da aplicação
│   └── index.js     # Ponto de entrada da aplicação
└── README.md        # Esta documentação
```

### Principais Componentes

#### Sistema de Armazenamento (Storage)

O sistema de armazenamento é baseado em IndexedDB com fallback para localStorage, permitindo o armazenamento de grandes quantidades de dados offline.

Localização: `src/services/sync/offlineStorage.js`

Exemplo de uso:
```javascript
import storage from './storage';

// Salvar dados
await storage.setItem('chave_store', 'chave_item', { dados: 'valor' });

// Recuperar dados
const dados = await storage.getItem('chave_store', 'chave_item');
```

#### Sistema de Sincronização

Gerencia a sincronização de dados offline para o servidor quando a conexão é restaurada.

Localização: `src/services/sync/syncManager.js`

Principais funcionalidades:
- Detecção automática de conectividade
- Sincronização delta para economizar dados
- Enfileiramento de operações offline
- Compressão de dados para reduzir uso de rede

#### Serviço de Webhooks

Permite integração com sistemas externos através de notificações de eventos.

Localização: `src/services/integration/webhookService.js`

Eventos suportados:
- `message.received` - Nova mensagem recebida
- `message.sent` - Mensagem enviada
- `sync.completed` - Sincronização concluída
- E outros eventos personalizáveis

#### Serviço de Voicemail

Gerencia a transcrição e armazenamento de mensagens de voz.

Localização: `src/services/integration/voicemailService.js`

Funcionalidades:
- Transcrição de áudio para texto
- Categorização de mensagens
- Notificações de novas mensagens

#### Sistema de Segurança

Implementa criptografia e controles de privacidade.

Localização: `src/services/security/encryption.js`

## 🧪 Testes

Para executar os testes automatizados do sistema:

```bash
npm test
# ou
yarn test
```

Para executar os testes do sistema que verificam todos os componentes principais:

```javascript
import { runSystemTests, formatTestReport } from './utils/systemTest';

const testResults = await runSystemTests();
console.log(formatTestReport(testResults));
```

## 📱 Progressive Web App (PWA)

A aplicação é uma PWA completa, podendo ser instalada em dispositivos móveis e desktop, e funcionar offline.

Principais recursos:
- Service Worker para caching e funcionamento offline
- Sincronização em segundo plano
- Notificações push
- Instalação via manifest.json

## 🔒 Segurança

- Dados sensíveis são criptografados em repouso
- Comunicações são realizadas por HTTPS
- Não armazena dados sensíveis no localStorage não criptografado
- Implementa controles de acesso baseados em funções

## 📖 Guia de Contribuição

1. Faça um fork do projeto
2. Crie sua branch de feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 🚀 Deployment

A aplicação está configurada para deploy no Netlify:

1. Certifique-se de que o arquivo `netlify.toml` está configurado corretamente
2. Execute `npm run build` para criar a versão de produção
3. Deploy manual: faça upload da pasta `build` para o Netlify
4. Deploy automático: conecte seu repositório ao Netlify para CI/CD

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## 🙏 Agradecimentos

- Equipe Quero Paz
- Contribuidores de código aberto
- Comunidade React
