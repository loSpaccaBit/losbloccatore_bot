import NodeCache from 'node-cache';
import config from '../config/index';
import logger from './logger';

class CacheManager {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.cache.ttl,
      maxKeys: config.cache.maxKeys,
      useClones: false
    });

    // Setup cache event listeners
    this.cache.on('set', (key: string) => {
      logger.debug('Cache key set', { key });
    });

    this.cache.on('del', (key: string) => {
      logger.debug('Cache key deleted', { key });
    });

    this.cache.on('expired', (key: string) => {
      logger.debug('Cache key expired', { key });
    });
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    try {
      return this.cache.set(key, value, ttl || 0);
    } catch (error) {
      logger.error('Failed to set cache key', error, { key });
      return false;
    }
  }

  get<T>(key: string): T | undefined {
    try {
      return this.cache.get<T>(key);
    } catch (error) {
      logger.error('Failed to get cache key', error, { key });
      return undefined;
    }
  }

  del(key: string): number {
    try {
      return this.cache.del(key);
    } catch (error) {
      logger.error('Failed to delete cache key', error, { key });
      return 0;
    }
  }

  has(key: string): boolean {
    try {
      return this.cache.has(key);
    } catch (error) {
      logger.error('Failed to check cache key', error, { key });
      return false;
    }
  }

  flush(): void {
    try {
      this.cache.flushAll();
      logger.info('Cache flushed successfully');
    } catch (error) {
      logger.error('Failed to flush cache', error);
    }
  }

  getStats(): { keys: number; hits: number; misses: number; ksize: number; vsize: number } {
    return this.cache.getStats();
  }

  // Bot-specific cache methods
  cacheUserAction(userId: number, action: string, ttl?: number): boolean {
    const key = `user_action:${userId}:${action}`;
    return this.set(key, { timestamp: Date.now(), action }, ttl || 300); // 5 minutes default
  }

  getUserAction(userId: number, action: string): { timestamp: number; action: string } | undefined {
    const key = `user_action:${userId}:${action}`;
    return this.get(key);
  }

  cacheWelcomeMessageSent(userId: number, ttl?: number): boolean {
    const key = `welcome_sent:${userId}`;
    return this.set(key, true, ttl || 86400); // 24 hours default
  }

  isWelcomeMessageSent(userId: number): boolean {
    const key = `welcome_sent:${userId}`;
    return this.has(key);
  }

  cacheGoodbyeMessageSent(userId: number, ttl?: number): boolean {
    const key = `goodbye_sent:${userId}`;
    return this.set(key, true, ttl || 3600); // 1 hour default
  }

  isGoodbyeMessageSent(userId: number): boolean {
    const key = `goodbye_sent:${userId}`;
    return this.has(key);
  }

  // Rate limiting
  checkRateLimit(identifier: string, maxRequests: number = 10, timeWindow: number = 60): boolean {
    const key = `rate_limit:${identifier}`;
    const current = this.get<number>(key) || 0;
    
    if (current >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    this.set(key, current + 1, timeWindow);
    return true; // Within rate limit
  }

  /**
   * Set value with specific TTL (Time To Live)
   * Alias for set method with TTL parameter for better readability
   */
  setWithTTL<T>(key: string, value: T, ttlSeconds: number): void {
    this.set(key, value, ttlSeconds);
  }
}

export default new CacheManager();