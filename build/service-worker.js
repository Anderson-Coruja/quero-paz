/* eslint-disable no-restricted-globals */

/**
 * Service Worker Avançado para o Quero Paz
 * 
 * Recursos implementados:
 * - Estratégias de cache inteligentes para diferentes tipos de recursos
 * - Sincronização em segundo plano quando offline
 * - Suporte a notificações push
 * - Atualização automática
 */

// Versão do cache (atualizar ao fazer mudanças significativas)
const CACHE_VERSION = 'v2';

// Caches separados para diferentes tipos de recursos
const CACHES = {
  static: `quero-paz-static-${CACHE_VERSION}`,
  dynamic: `quero-paz-dynamic-${CACHE_VERSION}`,
  images: `quero-paz-images-${CACHE_VERSION}`,
  fonts: `quero-paz-fonts-${CACHE_VERSION}`,
  api: `quero-paz-api-${CACHE_VERSION}`
};

// Recursos estáticos a serem cacheados na instalação
const STATIC_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/css/main.chunk.css',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico',
  '/offline.html' // Página de fallback quando offline
];

// URLs de API que devem ser sempre buscadas da rede quando possível
const API_URLS = [
  '/api/sync',
  '/api/user'
];

// Timeout para requisições de rede
const NETWORK_TIMEOUT = 10000; // 10 segundos

/**
 * Função de utilidade para verificar se uma URL corresponde a um padrão
 */
const matchPattern = (url, patterns) => {
  return patterns.some(pattern => {
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    } else if (pattern instanceof RegExp) {
      return pattern.test(url);
    }
    return false;
  });
};

/**
 * Evento de instalação - armazena recursos estáticos em cache
 */
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando nova versão');
  
  // Skip waiting para ativar imediatamente
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHES.static)
      .then(cache => {
        console.log('[Service Worker] Cacheando recursos estáticos');
        return cache.addAll(STATIC_URLS);
      })
      .catch(error => {
        console.error('[Service Worker] Erro ao cachear recursos estáticos:', error);
      })
  );
});

/**
 * Evento de ativação - limpa caches antigos
 */
self.addEventListener('activate', event => {
  console.log('[Service Worker] Ativando');
  
  // Tomar controle de clientes não controlados (tabs/janelas)
  self.clients.claim();
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Se o cacheName não estiver nos caches atuais, delete-o
            if (!Object.values(CACHES).includes(cacheName)) {
              console.log('[Service Worker] Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
            return null;
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Ativação concluída');
      })
  );
});

/**
 * Estratégia Cache-Primeiro para recursos estáticos
 */
const getFromCacheFirst = (request, cacheName) => {
  return caches.open(cacheName)
    .then(cache => {
      return cache.match(request)
        .then(cacheResponse => {
          if (cacheResponse) {
            // Retorna do cache, mas atualiza o cache em segundo plano
            const fetchPromise = fetch(request)
              .then(networkResponse => {
                cache.put(request, networkResponse.clone());
                return networkResponse;
              })
              .catch(() => {
                console.log('[Service Worker] Cache atualizado em segundo plano falhou, mas temos versão em cache');
              });
            
            return cacheResponse;
          }
          
          // Se não estiver em cache, busque na rede e armazene em cache
          return fetch(request)
            .then(networkResponse => {
              cache.put(request, networkResponse.clone());
              return networkResponse;
            });
        });
    });
};

/**
 * Estratégia Rede-Primeiro com fallback para cache
 */
const getFromNetworkFirst = (request, cacheName) => {
  return new Promise((resolve, reject) => {
    // Timeout para evitar esperas longas em redes ruins
    let timeoutId = setTimeout(() => {
      console.log('[Service Worker] Timeout, tentando do cache');
      caches.open(cacheName)
        .then(cache => cache.match(request))
        .then(response => {
          if (response) {
            resolve(response);
          } else {
            reject(new Error('No cache response and network timeout'));
          }
        })
        .catch(reject);
    }, NETWORK_TIMEOUT);
    
    fetch(request)
      .then(networkResponse => {
        clearTimeout(timeoutId);
        
        // Verificar se a resposta é válida
        if (!networkResponse || networkResponse.status !== 200) {
          throw new Error('Network response not valid');
        }
        
        // Clone a resposta antes de colocá-la em cache
        caches.open(cacheName)
          .then(cache => cache.put(request, networkResponse.clone()))
          .catch(error => console.error('[Service Worker] Erro ao cachear resposta:', error));
        
        resolve(networkResponse);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        console.log('[Service Worker] Falha na rede, tentando do cache:', error.message);
        
        caches.open(cacheName)
          .then(cache => cache.match(request))
          .then(response => {
            if (response) {
              resolve(response);
            } else {
              // Se não estiver em cache, veja se podemos fornecer uma página offline
              if (request.headers.get('Accept').includes('text/html')) {
                resolve(caches.match('/offline.html'));
              } else {
                reject(error);
              }
            }
          })
          .catch(reject);
      });
  });
};

/**
 * Somente rede para APIs (sem cache)
 */
const getFromNetworkOnly = (request) => {
  return fetch(request)
    .catch(error => {
      console.error('[Service Worker] Erro na rede para request importante:', error);
      
      // Adicionar à fila de sincronização em segundo plano se for uma requisição POST
      if (request.method === 'POST') {
        return registerSyncRequest(request.clone())
          .then(() => {
            // Responder com um status de "queued for sync"
            return new Response(JSON.stringify({
              status: 'queued',
              message: 'Request enfileirada para sincronização quando online'
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
      }
      
      throw error;
    });
};

/**
 * Registra uma requisição para sincronização em segundo plano
 */
const registerSyncRequest = async (request) => {
  try {
    const db = await openSyncDB();
    const data = await request.clone().text();
    const url = request.url;
    const method = request.method;
    const headers = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    const syncRequest = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      url,
      method,
      headers,
      data,
      timestamp: Date.now()
    };
    
    const tx = db.transaction('sync-requests', 'readwrite');
    const store = tx.objectStore('sync-requests');
    await store.add(syncRequest);
    
    // Registrar para sincronização em segundo plano
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-data');
    }
    
    return true;
  } catch (error) {
    console.error('[Service Worker] Erro ao registrar sincronização:', error);
    return false;
  }
};

/**
 * Abre/cria o banco de dados IndexedDB para sincronização
 */
const openSyncDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('quero-paz-sync', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Cria object store para requisições pendentes
      if (!db.objectStoreNames.contains('sync-requests')) {
        db.createObjectStore('sync-requests', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (error) => reject(error);
  });
};

/**
 * Evento de fetch - lida com todas as requisições
 */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const requestUrl = url.pathname;
  
  // Ignorar requisições para o Chrome Extension (caso o usuário tenha alguma)
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Ignorar requisições de outros domínios (exceto APIs conhecidas)
  if (url.origin !== self.location.origin && !matchPattern(url.href, ['api.queropaz.com'])) {
    return;
  }
  
  // Diferente estratégia para diferentes tipos de recursos
  if (matchPattern(requestUrl, STATIC_URLS)) {
    // Recursos estáticos - cache first, network fallback
    event.respondWith(getFromCacheFirst(event.request, CACHES.static));
  } 
  else if (matchPattern(requestUrl, [/\.(?:png|gif|jpg|jpeg|svg|webp)$/])) {
    // Imagens - cache first, network fallback
    event.respondWith(getFromCacheFirst(event.request, CACHES.images));
  } 
  else if (matchPattern(requestUrl, [/\.(?:woff|woff2|ttf|otf)$/])) {
    // Fontes - cache first
    event.respondWith(getFromCacheFirst(event.request, CACHES.fonts));
  } 
  else if (matchPattern(requestUrl, API_URLS) || matchPattern(url.href, ['api.queropaz.com'])) {
    // APIs - network first com timeout, cache fallback
    if (event.request.method === 'GET') {
      event.respondWith(getFromNetworkFirst(event.request, CACHES.api));
    } else {
      // Para POST, PUT, DELETE - tenta a rede, com possibilidade de enfileirar
      event.respondWith(getFromNetworkOnly(event.request));
    }
  } 
  else {
    // Demais recursos - network first, cache fallback
    event.respondWith(getFromNetworkFirst(event.request, CACHES.dynamic));
  }
});

/**
 * Evento sync - processa requisições enfileiradas quando o usuário fica online
 */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('[Service Worker] Sincronizando dados em segundo plano');
    event.waitUntil(syncData());
  }
});

/**
 * Processa sincronização em segundo plano
 */
const syncData = async () => {
  try {
    const db = await openSyncDB();
    const tx = db.transaction('sync-requests', 'readwrite');
    const store = tx.objectStore('sync-requests');
    const requests = await store.getAll();
    
    console.log(`[Service Worker] Encontradas ${requests.length} requisições pendentes`);
    
    // Processa cada requisição pendente
    const results = await Promise.allSettled(
      requests.map(async (request) => {
        try {
          // Reconstruí a requisição original
          const fetchOptions = {
            method: request.method,
            headers: request.headers,
            body: request.method !== 'GET' ? request.data : undefined,
            credentials: 'include'
          };
          
          const response = await fetch(request.url, fetchOptions);
          if (response.ok) {
            // Requisição bem-sucedida, remova da fila
            const delTx = db.transaction('sync-requests', 'readwrite');
            const delStore = delTx.objectStore('sync-requests');
            await delStore.delete(request.id);
            return { id: request.id, success: true };
          } else {
            return { id: request.id, success: false, status: response.status };
          }
        } catch (error) {
          console.error(`[Service Worker] Erro ao sincronizar requisição ${request.id}:`, error);
          return { id: request.id, success: false, error: error.message };
        }
      })
    );
    
    console.log('[Service Worker] Resultados da sincronização:', results);
    
    // Notifique o usuário sobre o resultado da sincronização
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    if (successCount > 0) {
      self.registration.showNotification('Quero Paz - Sincronização', {
        body: `${successCount} item(s) sincronizado(s) com sucesso`,
        icon: '/logo192.png'
      });
    }
    
    return results;
  } catch (error) {
    console.error('[Service Worker] Erro na sincronização em segundo plano:', error);
    throw error;
  }
};

/**
 * Evento push - processa notificações push
 */
self.addEventListener('push', event => {
  let notification = {};
  
  try {
    notification = event.data.json();
  } catch (e) {
    // Se não for JSON, tenta usar como texto
    notification = {
      title: 'Quero Paz',
      body: event.data.text()
    };
  }
  
  const title = notification.title || 'Quero Paz';
  const options = {
    body: notification.body || 'Nova notificação',
    icon: notification.icon || '/logo192.png',
    badge: notification.badge || '/logo192.png',
    data: notification.data || {},
    actions: notification.actions || [],
    vibrate: notification.vibrate || [100, 50, 100],
    tag: notification.tag || 'default'
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/**
 * Evento notificationclick - lida com cliques nas notificações
 */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  // Dados personalizados da notificação
  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/';
  
  // Se a notificação tiver ações
  if (event.action) {
    console.log(`[Service Worker] Ação ${event.action} clicada na notificação`);
    
    // Processar ação específica
    switch (event.action) {
      case 'view-details':
        // Abrir página de detalhes
        event.waitUntil(
          clients.openWindow(`${urlToOpen}?view=details`)
        );
        return;
      case 'dismiss':
        // Apenas fechar a notificação
        return;
    }
  }
  
  // Comportamento padrão: focar na janela existente ou abrir uma nova
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        // Se já houver uma janela aberta, focá-la
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Caso contrário, abrir uma nova janela
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
