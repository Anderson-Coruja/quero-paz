#!/bin/bash
# deploy-hostinger.sh - Script de deploy automático para Hostinger

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variáveis (personalize conforme necessário)
HOSTINGER_USER="seu_usuario"
HOSTINGER_HOST="seuservidor.hostinger.com"
HOSTINGER_PATH="/home/usuario/public_html"

# Banner
echo -e "${GREEN}=== 🚀 Deploy Automático para Hostinger ===${NC}"
echo -e "Iniciando deploy do Quero Paz WebApp\n"

# Verificação de ambiente
echo -e "${YELLOW}Verificando ambiente...${NC}"
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Erro: package.json não encontrado! Execute este script no diretório raiz do projeto.${NC}"
  exit 1
fi

# Build
echo -e "${YELLOW}Gerando build de produção...${NC}"
npm run build
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Erro durante o build!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Build concluído com sucesso${NC}"

# Compactação
echo -e "${YELLOW}Compactando arquivos...${NC}"
if [ -f "quero-paz-hostinger.zip" ]; then
  rm quero-paz-hostinger.zip
fi
zip -r quero-paz-hostinger.zip build
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Erro durante a compactação!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Arquivos compactados com sucesso${NC}"

# Upload
echo -e "${YELLOW}Enviando para o servidor Hostinger...${NC}"
echo -e "Realizando upload para ${HOSTINGER_USER}@${HOSTINGER_HOST}:${HOSTINGER_PATH}/"
scp quero-paz-hostinger.zip ${HOSTINGER_USER}@${HOSTINGER_HOST}:${HOSTINGER_PATH}/
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Erro durante o upload! Verifique as credenciais SSH e conexão.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Upload concluído com sucesso${NC}"

# Extração e configuração remota
echo -e "${YELLOW}Configurando arquivos no servidor...${NC}"
ssh ${HOSTINGER_USER}@${HOSTINGER_HOST} "cd ${HOSTINGER_PATH} && \
  echo 'Extraindo arquivos...' && \
  unzip -o quero-paz-hostinger.zip -d . && \
  echo 'Movendo arquivos para diretório público...' && \
  rm -rf build_old && \
  [ -d 'build' ] && mv build/* . && \
  rm -rf build && \
  rm quero-paz-hostinger.zip && \
  echo 'Verificando .htaccess...' && \
  if [ ! -f '.htaccess' ]; then \
    echo 'Criando arquivo .htaccess...' && \
    echo '<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>' > .htaccess; \
  fi"

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Erro durante a configuração remota!${NC}"
  exit 1
fi

# Limpeza local
echo -e "${YELLOW}Limpando arquivos temporários locais...${NC}"
rm quero-paz-hostinger.zip
echo -e "${GREEN}✓ Limpeza concluída${NC}"

# Mensagem de sucesso
echo -e "\n${GREEN}🎉 Deploy concluído com sucesso! 🎉${NC}"
echo -e "Acesse seu site em: https://<seu-dominio>.com"
echo -e "\n${YELLOW}Lembre-se de verificar:${NC}"
echo -e "1. Navegação entre rotas"
echo -e "2. Registro correto do Service Worker"
echo -e "3. Recursos estáticos (imagens, estilos, scripts)"
echo -e "4. Funcionalidades offline do PWA"
echo -e "\n${GREEN}Obrigado por usar o script de deploy automatizado do Quero Paz WebApp!${NC}"