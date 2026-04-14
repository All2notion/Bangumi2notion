import fetch from 'node-fetch';

// API请求缓存
const apiCache = new Map();
const CACHE_TTL = 3600000; // 1小时缓存

// 并发控制
const MAX_CONCURRENT_REQUESTS = 5;
let activeRequests = 0;
const requestQueue = [];

// 速率限制控制
const RATE_LIMIT_WINDOW = 1000; // 1秒
const MAX_REQUESTS_PER_WINDOW = 10;
let requestsInWindow = 0;
let windowStart = Date.now();

// 执行队列中的请求
async function processRequestQueue() {
  if (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
    const { url, enhancedOptions, resolve, reject } = requestQueue.shift();
    activeRequests++;
    
    try {
      const response = await fetch(url, enhancedOptions);
      resolve(response);
    } catch (error) {
      reject(error);
    } finally {
      activeRequests--;
      processRequestQueue();
    }
  }
}

// 检查并遵守速率限制
async function throttleRequest() {
  const now = Date.now();
  
  // 重置窗口
  if (now - windowStart > RATE_LIMIT_WINDOW) {
    windowStart = now;
    requestsInWindow = 0;
  }
  
  // 检查是否达到速率限制
  if (requestsInWindow >= MAX_REQUESTS_PER_WINDOW) {
    const waitTime = RATE_LIMIT_WINDOW - (now - windowStart);
    console.log(`Rate limit reached, waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    // 重置窗口
    windowStart = Date.now();
    requestsInWindow = 0;
  }
  
  requestsInWindow++;
}

// 带并发控制的fetch函数
export async function fetchWithConcurrency(url, options = {}) {
  // 应用速率限制
  await throttleRequest();
  
  // 添加默认请求头
  const defaultHeaders = {
    'User-Agent': 'Bangumi-To-Notion-Sync/1.0',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  
  const enhancedOptions = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };
  
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, enhancedOptions, resolve, reject });
    processRequestQueue();
  });
}

// 带重试机制和缓存的fetch函数
export async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  // 检查缓存
  const cacheKey = url + JSON.stringify(options);
  const cachedData = apiCache.get(cacheKey);
  
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    console.log(`Using cached data for ${url}`);
    return new Response(JSON.stringify(cachedData.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithConcurrency(url, options);
      
      if (!response.ok) {
        // 对于429（速率限制）和500+错误，进行重试
        if ((response.status === 429 || response.status >= 500) && i < retries - 1) {
          console.warn(`Request failed with status ${response.status}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // 对于其他错误，抛出异常
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 缓存响应
      try {
        const data = await response.clone().json();
        apiCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      } catch (e) {
        // 非JSON响应，不缓存
      }
      
      return response;
    } catch (error) {
      // 网络错误，进行重试
      if (i < retries - 1) {
        console.warn(`Network error: ${error.message}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
