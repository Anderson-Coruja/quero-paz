// Serviço para lidar com notificações
const notificationService = {
  // Verifica o status atual da permissão de notificações
  checkPermissionStatus() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission; // 'granted', 'denied' ou 'default'
  },
  
  // Solicita permissão para enviar notificações - deve ser chamada em resposta a uma interação do usuário
  async requestPermission() {
    if (!('Notification' in window)) {
      console.log('Este navegador não suporta notificações');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Erro ao solicitar permissão para notificações:', error);
        return false;
      }
    }
    
    return false;
  },
  
  // Envia uma notificação
  async sendNotification(title, options = {}) {
    // Verifica se notificações são suportadas e permitidas
    if (!('Notification' in window)) {
      console.log('Este navegador não suporta notificações');
      return;
    }
    
    // Se a permissão não foi concedida, tenta solicitar
    if (Notification.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) {
        console.log('Permissão para notificações negada');
        return;
      }
    }
    
    // Configurações padrão da notificação
    const defaultOptions = {
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [200, 100, 200],
      ...options
    };
    
    // Cria e envia a notificação
    try {
      const notification = new Notification(title, defaultOptions);
      
      // Configura ação ao clicar
      if (options.onClick) {
        notification.onclick = options.onClick;
      } else {
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
      
      return notification;
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
    }
  },
  
  // Notificação de chamada bloqueada
  async notifyBlockedCall(phoneNumber) {
    return this.sendNotification(
      'Chamada Bloqueada', 
      {
        body: `O número ${phoneNumber} foi bloqueado pela proteção Quero Paz.`,
        tag: 'blocked-call',
        data: { phoneNumber, type: 'blocked' }
      }
    );
  },
  
  // Notificação de chamada silenciada
  async notifySilencedCall(phoneNumber) {
    return this.sendNotification(
      'Chamada Silenciada', 
      {
        body: `O número ${phoneNumber} foi silenciado.`,
        tag: 'silenced-call',
        data: { phoneNumber, type: 'silenced' }
      }
    );
  },
  
  // Notificação de chamada para confirmação
  async notifyPendingConfirmation(phoneNumber) {
    return this.sendNotification(
      'Confirma pra Mim', 
      {
        body: `Nova chamada pendente de confirmação: ${phoneNumber}`,
        tag: 'pending-confirmation',
        data: { phoneNumber, type: 'confirm' }
      }
    );
  }
};

export default notificationService;
