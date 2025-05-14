/**
 * Sistema de Compressão de Dados para o Quero Paz
 * 
 * Este módulo implementa algoritmos de compressão eficientes para
 * minimizar o uso de dados durante sincronização e armazenamento.
 * Utiliza métodos nativos do navegador quando disponíveis.
 */

// Constantes para configuração
const DEFAULT_COMPRESSION_LEVEL = 6; // 1-9 (9 é máxima compressão, mais lenta)
const COMPRESSION_ENABLED = true; // Flag global para ativar/desativar

/**
 * Comprime dados para transmissão ou armazenamento
 * @param {any} data - Dados a comprimir (será convertido para JSON)
 * @param {Object} [options] - Opções de compressão
 * @returns {Promise<string|Uint8Array>} Dados comprimidos
 */
export async function compress(data, options = {}) {
  // Se compressão desativada, retorna JSON simples
  if (!COMPRESSION_ENABLED || options.noCompression) {
    return JSON.stringify(data);
  }
  
  // Converte para string JSON
  const jsonString = JSON.stringify(data);
  
  try {
    // Verifica se CompressionStream API está disponível (mais moderna/eficiente)
    if (typeof CompressionStream !== 'undefined') {
      return await compressWithCompressionStream(jsonString, options);
    }
    
    // Fallback para algoritmos mais antigos/universais
    if (typeof TextEncoder !== 'undefined' && typeof pako !== 'undefined') {
      return compressWithPako(jsonString, options);
    }
    
    // Nenhum método de compressão disponível
    console.warn('Nenhum método de compressão disponível no navegador');
    return jsonString;
  } catch (error) {
    console.error('Erro durante compressão de dados:', error);
    // Retorna dado não comprimido em caso de erro
    return jsonString;
  }
}

/**
 * Descomprime dados previamente comprimidos
 * @param {string|Uint8Array} compressedData - Dados comprimidos
 * @param {Object} [options] - Opções de descompressão
 * @returns {Promise<any>} Dados descomprimidos e parseados
 */
export async function decompress(compressedData, options = {}) {
  // Se é string simples, tenta parse direto
  if (typeof compressedData === 'string' && 
      (compressedData.startsWith('{') || compressedData.startsWith('['))) {
    try {
      return JSON.parse(compressedData);
    } catch (e) {
      // Não é JSON válido, continua para tentar descompressão
    }
  }
  
  try {
    let decompressedString;
    
    // Verifica o método apropriado para descompressão
    if (compressedData instanceof Uint8Array || compressedData instanceof ArrayBuffer) {
      // Dados comprimidos em formato binário
      if (typeof DecompressionStream !== 'undefined') {
        decompressedString = await decompressWithDecompressionStream(compressedData, options);
      } else if (typeof TextDecoder !== 'undefined' && typeof pako !== 'undefined') {
        decompressedString = decompressWithPako(compressedData, options);
      } else {
        throw new Error('Nenhum método de descompressão disponível para dados binários');
      }
    } else {
      // Se chegou aqui, pode ser string codificada em base64 ou outro formato
      decompressedString = compressedData.toString();
    }
    
    // Parse do JSON descomprimido
    return JSON.parse(decompressedString);
  } catch (error) {
    console.error('Erro durante descompressão de dados:', error);
    throw new Error('Não foi possível descomprimir os dados: ' + error.message);
  }
}

/**
 * Comprime usando a moderna API CompressionStream
 * @param {string} jsonString - String JSON a comprimir
 * @param {Object} options - Opções de compressão
 * @returns {Promise<Uint8Array>} Dados comprimidos
 * @private
 */
async function compressWithCompressionStream(jsonString, options) {
  // Criar stream de compressão (gzip é amplamente suportado)
  const format = options.format || 'gzip';
  const cs = new CompressionStream(format);
  
  // Criar TextEncoder para converter string para Uint8Array
  const te = new TextEncoder();
  const bytes = te.encode(jsonString);
  
  // Pipe do stream de dados pelo compressor
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  
  // Ler o resultado comprimido
  const output = [];
  const reader = cs.readable.getReader();
  
  let done, value;
  while (({ done, value } = await reader.read(), !done)) {
    output.push(value);
  }
  
  // Concatenar partes do array em único Uint8Array
  const totalLength = output.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  
  let offset = 0;
  for (const arr of output) {
    result.set(arr, offset);
    offset += arr.length;
  }
  
  return result;
}

/**
 * Descomprime usando a moderna API DecompressionStream
 * @param {Uint8Array} compressedData - Dados comprimidos
 * @param {Object} options - Opções de descompressão
 * @returns {Promise<string>} String JSON descomprimida
 * @private
 */
async function decompressWithDecompressionStream(compressedData, options) {
  // Criar stream de descompressão
  const format = options.format || 'gzip';
  const ds = new DecompressionStream(format);
  
  // Pipe dos dados comprimidos pelo descompressor
  const writer = ds.writable.getWriter();
  writer.write(compressedData instanceof Uint8Array ? 
              compressedData : 
              new Uint8Array(compressedData));
  writer.close();
  
  // Ler o resultado descomprimido
  const output = [];
  const reader = ds.readable.getReader();
  
  let done, value;
  while (({ done, value } = await reader.read(), !done)) {
    output.push(value);
  }
  
  // Concatenar partes do array em único Uint8Array
  const totalLength = output.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  
  let offset = 0;
  for (const arr of output) {
    result.set(arr, offset);
    offset += arr.length;
  }
  
  // Converter bytes para string
  const td = new TextDecoder();
  return td.decode(result);
}

/**
 * Comprime usando biblioteca pako (fallback)
 * @param {string} jsonString - String JSON a comprimir
 * @param {Object} options - Opções de compressão
 * @returns {Uint8Array} Dados comprimidos
 * @private
 */
function compressWithPako(jsonString, options) {
  // Nota: Esta função normalmente usaria a biblioteca pako
  // Para este protótipo, usamos uma implementação simulada
  console.warn('Simulando compressão com pako (em produção, usaria a biblioteca real)');
  
  // Converter para bytes
  const te = new TextEncoder();
  const bytes = te.encode(jsonString);
  
  // Simular compressão (em produção, isso chamaria pako.deflate)
  // Retorna os bytes originais para demonstração
  return bytes;
}

/**
 * Descomprime usando biblioteca pako (fallback)
 * @param {Uint8Array} compressedData - Dados comprimidos
 * @param {Object} options - Opções de descompressão
 * @returns {string} String JSON descomprimida
 * @private
 */
function decompressWithPako(compressedData, options) {
  // Nota: Esta função normalmente usaria a biblioteca pako
  // Para este protótipo, usamos uma implementação simulada
  console.warn('Simulando descompressão com pako (em produção, usaria a biblioteca real)');
  
  // Simular descompressão (em produção, isso chamaria pako.inflate)
  // Converter bytes de volta para string
  const td = new TextDecoder();
  return td.decode(compressedData);
}

/**
 * Estima a taxa de compressão para avaliar economia de dados
 * @param {any} data - Dados originais
 * @returns {Promise<Object>} Estatísticas de compressão
 */
export async function estimateCompressionRatio(data) {
  const jsonString = JSON.stringify(data);
  const originalSize = jsonString.length;
  
  // Se compressão desativada, retorna proporção 1:1
  if (!COMPRESSION_ENABLED) {
    return {
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
      savings: 0
    };
  }
  
  try {
    // Comprime os dados
    const compressed = await compress(data);
    const compressedSize = compressed.length || compressed.byteLength;
    
    // Calcula proporção e economia
    const ratio = compressedSize / originalSize;
    const savings = 1 - ratio;
    
    return {
      originalSize,
      compressedSize,
      ratio,
      savings: Math.round(savings * 100)
    };
  } catch (error) {
    console.error('Erro ao estimar taxa de compressão:', error);
    return {
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
      savings: 0,
      error: error.message
    };
  }
}
