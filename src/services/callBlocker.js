import storage from './storage';
import notificationService from './notifications';

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
        await notificationService.notifyPendingConfirmation(phoneNumber);
      } else {
        result = {
          action: 'silence',
          message: `${phoneNumber} - Ligação silenciada às ${getFormattedTime()}`
        };
        
        await storage.addSilencedCall(result.message);
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
    }
    
    return result;
  },
  
  // Bloqueia manualmente um número
  async blockNumber(phoneNumber) {
    const message = `${phoneNumber} - Ligação bloqueada às ${getFormattedTime()}`;
    await storage.addSilencedCall(message);
    
    return {
      action: 'block',
      message
    };
  },
  
  // Confirma um número como confiável (remove das pendências)
  async confirmAsTrusted(index) {
    return await storage.removePendingConfirmation(index);
  },
  
  // Rejeita um número (adiciona à lista de bloqueados e remove das pendências)
  async rejectNumber(index) {
    const confirmations = await storage.getPendingConfirmations();
    if (index >= 0 && index < confirmations.length) {
      const confirmation = confirmations[index];
      const phoneNumber = confirmation.split(' - ')[0];
      
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
    
    return await this.processIncomingCall(phoneNumber, isDDI);
  }
};

export default callBlockerService;
