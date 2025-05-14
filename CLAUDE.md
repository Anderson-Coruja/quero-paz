# CLAUDE.md

Este arquivo fornece orientações para o Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Projeto Quero Paz WebApp

O Quero Paz WebApp é uma aplicação web progressiva (PWA) focada em gerenciar chamadas, mensagens e privacidade com foco em bem-estar do usuário. A aplicação é construída em React com Tailwind CSS e implementa recursos de armazenamento offline e sincronização de dados.

## Comandos Principais

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm start

# Gerar build de produção
npm run build
```

## Arquitetura e Estrutura do Código

### Visão Geral da Arquitetura

O Quero Paz WebApp utiliza uma arquitetura baseada em:
- **Frontend**: React 18.2.0 com componentes organizados por funcionalidade
- **Estilização**: Tailwind CSS 3.3.3 + CSS personalizado
- **Armazenamento**: IndexedDB via localforage com criptografia
- **Funcionalidades Offline**: Service Worker com estratégia de cache
- **Sincronização**: Sistema de sincronização para dados em múltiplos dispositivos

### Módulos Principais

1. **Bloqueio de Chamadas**: Implementado em `services/callBlocker.js`
2. **Armazenamento Seguro**: Centralizado em `services/storage.js` com `security/encryption.js`
3. **Notificações**: Sistema de notificações em `services/notifications.js`
4. **IA e Análise**: Componentes e serviços em `/components/ai` e `/services/ai`
5. **Sincronização**: Sistema completo em `/components/sync` e `/services/sync`

### Fluxo de Dados

1. Os dados são armazenados localmente com criptografia
2. Quando online, os dados são sincronizados (quando configurado)
3. Service Worker gerencia o cache e a experiência offline
4. As notificações são processadas tanto online quanto offline

## Padrões de Desenvolvimento

### React

- Uso de hooks funcionais (useState, useEffect, useCallback)
- Componentes organizados por domínio funcional
- Carregamento lazy para otimização de performance
- Context API para gerenciamento de estado global

### Segurança

- Dados sensíveis devem ser criptografados usando `services/security/encryption.js`
- Evitar armazenamento de dados em localStorage não criptografado
- As chaves de criptografia devem ser gerenciadas via ambiente seguro

### PWA

- Service Worker gerencia cache e experiência offline
- Otimização para diferentes tamanhos de tela via Tailwind
- Suporte a instalação em dispositivos (Add to Home Screen)

## Deployment

### Netlify
- Configurado para deploy na Netlify via `netlify.toml`
- Build de produção otimizado para performance
- Cache estratégico para recursos estáticos

### Hostinger
- Processo de deployment para Hostinger:
  1. Executar build de produção: `npm run build`
  2. Compactar o conteúdo da pasta `build` em um arquivo zip:
     ```bash
     zip -r quero-paz-hostinger.zip build
     ```
  3. Enviar o arquivo zip para o servidor usando SCP:
     ```bash
     scp quero-paz-hostinger.zip usuario@seuservidor.hostinger.com:/home/usuario/public_html/
     ```
  4. Conectar via SSH e extrair o arquivo no diretório público:
     ```bash
     ssh usuario@seuservidor.hostinger.com
     cd /home/usuario/public_html/
     unzip quero-paz-hostinger.zip -d .
     mv build/* .
     rm -rf build
     rm quero-paz-hostinger.zip
     ```
- Configurar as regras de redirecionamento no .htaccess para suportar SPA:
  ```apache
  <IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
  </IfModule>
  ```
- Atualizar a URL da API no arquivo `.env.production` antes do build com o domínio real na Hostinger
- Garantir que o subdomínio ou domínio esteja configurado corretamente para HTTPS

## Diretrizes de Código

1. Manter o padrão de organização existente (componentes e serviços por domínio)
2. Usar Tailwind CSS para estilização, seguindo as convenções existentes
3. Implementar tratamento de erros e fallbacks para operações que podem falhar
4. Garantir que todos os dados sensíveis sejam criptografados antes do armazenamento
5. Testar funcionalidades tanto online quanto offline