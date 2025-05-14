# Guia de Deploy para Hostinger

Este documento contém instruções detalhadas para realizar o deploy do Quero Paz WebApp em um servidor Hostinger.

## Pré-requisitos

- Conta ativa na Hostinger com:
  - Acesso SSH habilitado
  - PHP 7.4+ habilitado
  - Módulo mod_rewrite habilitado

## Processo de Deploy

### 1. Preparação do Build

Antes de iniciar o deploy, certifique-se de que seu ambiente local está configurado corretamente:

1. Verifique e atualize as variáveis de ambiente em `.env.production`:
   ```
   REACT_APP_API_URL=https://seudominio.com/api
   REACT_APP_ENV=production
   REACT_APP_ENCRYPTION_KEY=sua_chave_segura
   ```

2. Gere o build de produção:
   ```bash
   npm run build
   ```

3. Compacte o diretório de build:
   ```bash
   zip -r quero-paz-hostinger.zip build
   ```

### 2. Upload para o Servidor

Existem duas formas de fazer o upload:

#### Opção 1: Usando SCP (Recomendado)

```bash
scp quero-paz-hostinger.zip usuario@seuservidor.hostinger.com:/home/usuario/public_html/
```

#### Opção 2: Usando o Painel da Hostinger

1. Acesse o Painel de Controle da Hostinger
2. Navegue até o Gerenciador de Arquivos
3. Vá para a pasta `public_html`
4. Faça upload do arquivo zip

### 3. Extração e Configuração no Servidor

Conecte-se via SSH e execute:

```bash
ssh usuario@seuservidor.hostinger.com

# Navegue para o diretório público
cd /home/usuario/public_html/

# Extraia os arquivos
unzip quero-paz-hostinger.zip -d .

# Mova os arquivos para a raiz (ou subdiretório desejado)
mv build/* .
rm -rf build
rm quero-paz-hostinger.zip
```

### 4. Configuração do .htaccess

Crie ou edite o arquivo `.htaccess` na raiz com o conteúdo:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Não redirecionar arquivos existentes ou diretórios
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  
  # Redirecionar todas as outras requisições para index.html
  RewriteRule . /index.html [L]
</IfModule>

# Configurações adicionais para segurança e performance
<IfModule mod_headers.c>
  # Cache para recursos estáticos (1 semana)
  <FilesMatch "\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2)$">
    Header set Cache-Control "max-age=604800, public"
  </FilesMatch>
  
  # Segurança
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-XSS-Protection "1; mode=block"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```

### 5. Configuração de HTTPS

Para habilitar HTTPS:

1. Acesse o Painel de Controle da Hostinger
2. Vá para a seção SSL/TLS
3. Ative o certificado Let's Encrypt para seu domínio
4. Aguarde a propagação (pode levar até 24 horas)

### 6. Verificação do Deploy

Após concluir o deploy, verifique:

1. Acesse o site através do domínio principal
2. Teste a navegação entre as rotas da aplicação
3. Verifique se o Service Worker está registrado corretamente
4. Teste as funcionalidades offline
5. Verifique se o HTTPS está funcionando corretamente

## Solução de Problemas

### Problema: Rotas não funcionam (404)
- **Solução**: Verifique se o arquivo .htaccess foi criado corretamente e se o mod_rewrite está habilitado

### Problema: Service Worker não registra
- **Solução**: Verifique se o HTTPS está configurado corretamente, pois PWAs requerem conexão segura

### Problema: Arquivos estáticos não carregam
- **Solução**: Verifique os caminhos relativos dos arquivos e se eles estão sendo servidos corretamente

## Automatização Futura

Para automatizar deployments futuros, considere criar um script shell:

```bash
#!/bin/bash
# deploy-hostinger.sh

# Variáveis
HOSTINGER_USER="seu_usuario"
HOSTINGER_HOST="seuservidor.hostinger.com"
HOSTINGER_PATH="/home/usuario/public_html"

# Build
npm run build

# Zip
zip -r quero-paz-hostinger.zip build

# Upload
scp quero-paz-hostinger.zip $HOSTINGER_USER@$HOSTINGER_HOST:$HOSTINGER_PATH/

# Extração e configuração remota
ssh $HOSTINGER_USER@$HOSTINGER_HOST "cd $HOSTINGER_PATH && \
  unzip -o quero-paz-hostinger.zip -d . && \
  rm -rf build_old && \
  [ -d 'build' ] && mv build/* . && \
  rm -rf build && \
  rm quero-paz-hostinger.zip"

echo "Deploy concluído com sucesso!"
```

Torne o script executável:
```bash
chmod +x deploy-hostinger.sh
```

## Referências

- [Documentação da Hostinger sobre aplicações SPA](https://support.hostinger.com/en/articles/4455931-how-to-set-up-a-single-page-application-spa)
- [Guia de PWA na Hostinger](https://www.hostinger.com/tutorials/progressive-web-apps)