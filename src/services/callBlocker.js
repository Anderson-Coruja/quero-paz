import storage from './storage';
import notificationService from './notifications';
import trackingService from './tracking';

// Formata a hora atual para registro de chamadas
const getFormattedTime = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Serviço de gerenciamento de bloqueio de chamadas
const callBlockerService = {
  // Simula recebimento de uma chamada e processa conforme configurações
  async processIncomingCall(phoneNumber, isDDI = false) {
    const blockingState = await storage.getBlockingState();
    const settings = await storage.getSettings();
    let result = null;
    
    // Se o bloqueio está ativo
    if (blockingState) {
      // Verifica se é internacional e se bloqueio internacional está ativo
      if (isDDI && settings.blockInternational) {
        result = {
          action: 'block',
          message: `${phoneNumber} - DDI bloqueado automaticamente`
        };
        
        await storage.addSilencedCall(result.message);
        
        // Registra evento de chamada bloqueada (DDI)
        trackingService.trackBlockedCall(phoneNumber, 'ddi_blocked');
        
        if (settings.soundOnBlock) {
          await notificationService.notifyBlockedCall(phoneNumber);
        }
        
        return result;
      }
      
      // Processa conforme o tipo de número e configurações
      if (settings.autoConfirm) {
        result = {
          action: 'confirm',
          message: `${phoneNumber} - Aguardando confirmação`
        };
        
        await storage.addPendingConfirmation(result.message);
        
        // Registra evento de confirmação pendente
        trackingService.trackEvent(trackingService.EVENT_TYPES.CALL, 'pending_confirmation', {
          phoneNumber,
          timestamp: new Date().toISOString()
        });
        
        await notificationService.notifyPendingConfirmation(phoneNumber);
      } else {
        result = {
          action: 'silence',
          message: `${phoneNumber} - Ligação silenciada às ${getFormattedTime()}`
        };
        
        await storage.addSilencedCall(result.message);
        
        // Registra evento de chamada silenciada
        trackingService.trackSilencedCall(phoneNumber);
        
        if (settings.soundOnBlock) {
          await notificationService.notifySilencedCall(phoneNumber);
        }
      }
    } else {
      // Se o bloqueio está desativado, apenas registra a chamada
      result = {
        action: 'allow',
        message: `${phoneNumber} - Chamada permitida às ${getFormattedTime()}`
      };
      
      // Registra evento de chamada permitida
      trackingService.trackEvent(trackingService.EVENT_TYPES.CALL, 'allowed', {
        phoneNumber,
        timestamp: new Date().toISOString()
      });
    }
    
    return result;
  },
  
  // Bloqueia manualmente um número
  async blockNumber(phoneNumber) {
    const message = `${phoneNumber} - Ligação bloqueada às ${getFormattedTime()}`;
    await storage.addSilencedCall(message);
    
    // Registra evento de bloqueio manual
    trackingService.trackBlockedCall(phoneNumber, 'manual_block');
    
    return {
      action: 'block',
      message
    };
  },
  
  // Confirma um número como confiável (remove das pendências)
  async confirmAsTrusted(index) {
    // Primeiro obtém os números pendentes para conseguir o número de telefone
    const confirmations = await storage.getPendingConfirmations();
    if (index >= 0 && index < confirmations.length) {
      const phoneNumber = confirmations[index].split(' - ')[0];
      
      // Registra evento de confirmação de número confiável
      trackingService.trackEvent(trackingService.EVENT_TYPES.USER, 'confirm_trusted', {
        phoneNumber,
        timestamp: new Date().toISOString()
      });
    }
    
    return await storage.removePendingConfirmation(index);
  },
  
  // Rejeita um número (adiciona à lista de bloqueados e remove das pendências)
  async rejectNumber(index) {
    const confirmations = await storage.getPendingConfirmations();
    if (index >= 0 && index < confirmations.length) {
      const confirmation = confirmations[index];
      const phoneNumber = confirmation.split(' - ')[0];
      
      // Registra evento de rejeição de número
      trackingService.trackEvent(trackingService.EVENT_TYPES.USER, 'reject_number', {
        phoneNumber,
        timestamp: new Date().toISOString()
      });
      
      await this.blockNumber(phoneNumber);
      return await storage.removePendingConfirmation(index);
    }
    return confirmations;
  },
  
  // Simula uma chamada recebida (para testes)
  async simulateIncomingCall() {
    // Gera um número de telefone aleatório
    const generatePhoneNumber = () => {
      const ddd = Math.floor(Math.random() * 90) + 10; // DDD entre 10 e 99
      const part1 = Math.floor(Math.random() * 9000) + 1000; // 4 dígitos
      const part2 = Math.floor(Math.random() * 9000) + 1000; // 4 dígitos
      return `${ddd} ${part1}-${part2}`;
    };
    
    // Chance de 20% de ser DDI
    const isDDI = Math.random() < 0.2;
    const phoneNumber = isDDI ? 
      `+${Math.floor(Math.random() * 900) + 100} ${generatePhoneNumber()}` : 
      generatePhoneNumber();
    
    // Registra evento de simulação de chamada
    trackingService.trackEvent(trackingService.EVENT_TYPES.CALL, 'simulated_call', {
      phoneNumber,
      isDDI,
      timestamp: new Date().toISOString()
    });
    
    return await this.processIncomingCall(phoneNumber, isDDI);
  }
};

export default callBlockerService;
