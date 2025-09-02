"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cache_1 = __importDefault(require("node-cache"));
const index_1 = __importDefault(require("../config/index"));
const logger_1 = __importDefault(require("./logger"));
class CacheManager {
    constructor() {
        this.cache = new node_cache_1.default({
            stdTTL: index_1.default.cache.ttl,
            maxKeys: index_1.default.cache.maxKeys,
            useClones: false
        });
        this.cache.on('set', (key) => {
            logger_1.default.debug('Cache key set', { key });
        });
        this.cache.on('del', (key) => {
            logger_1.default.debug('Cache key deleted', { key });
        });
        this.cache.on('expired', (key) => {
            logger_1.default.debug('Cache key expired', { key });
        });
    }
    set(key, value, ttl) {
        try {
            return this.cache.set(key, value, ttl || 0);
        }
        catch (error) {
            logger_1.default.error('Failed to set cache key', error, { key });
            return false;
        }
    }
    get(key) {
        try {
            return this.cache.get(key);
        }
        catch (error) {
            logger_1.default.error('Failed to get cache key', error, { key });
            return undefined;
        }
    }
    del(key) {
        try {
            return this.cache.del(key);
        }
        catch (error) {
            logger_1.default.error('Failed to delete cache key', error, { key });
            return 0;
        }
    }
    has(key) {
        try {
            return this.cache.has(key);
        }
        catch (error) {
            logger_1.default.error('Failed to check cache key', error, { key });
            return false;
        }
    }
    flush() {
        try {
            this.cache.flushAll();
            logger_1.default.info('Cache flushed successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to flush cache', error);
        }
    }
    getStats() {
        return this.cache.getStats();
    }
    cacheUserAction(userId, action, ttl) {
        const key = `user_action:${userId}:${action}`;
        return this.set(key, { timestamp: Date.now(), action }, ttl || 300);
    }
    getUserAction(userId, action) {
        const key = `user_action:${userId}:${action}`;
        return this.get(key);
    }
    cacheWelcomeMessageSent(userId, ttl) {
        const key = `welcome_sent:${userId}`;
        return this.set(key, true, ttl || 86400);
    }
    isWelcomeMessageSent(userId) {
        const key = `welcome_sent:${userId}`;
        return this.has(key);
    }
    cacheGoodbyeMessageSent(userId, ttl) {
        const key = `goodbye_sent:${userId}`;
        return this.set(key, true, ttl || 3600);
    }
    isGoodbyeMessageSent(userId) {
        const key = `goodbye_sent:${userId}`;
        return this.has(key);
    }
    checkRateLimit(identifier, maxRequests = 10, timeWindow = 60) {
        const key = `rate_limit:${identifier}`;
        const current = this.get(key) || 0;
        if (current >= maxRequests) {
            return false;
        }
        this.set(key, current + 1, timeWindow);
        return true;
    }
    setWithTTL(key, value, ttlSeconds) {
        this.set(key, value, ttlSeconds);
    }
}
exports.default = new CacheManager();
//# sourceMappingURL=cache.js.map