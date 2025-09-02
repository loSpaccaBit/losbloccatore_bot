declare class CacheManager {
    private cache;
    constructor();
    set<T>(key: string, value: T, ttl?: number): boolean;
    get<T>(key: string): T | undefined;
    del(key: string): number;
    has(key: string): boolean;
    flush(): void;
    getStats(): {
        keys: number;
        hits: number;
        misses: number;
        ksize: number;
        vsize: number;
    };
    cacheUserAction(userId: number, action: string, ttl?: number): boolean;
    getUserAction(userId: number, action: string): {
        timestamp: number;
        action: string;
    } | undefined;
    cacheWelcomeMessageSent(userId: number, ttl?: number): boolean;
    isWelcomeMessageSent(userId: number): boolean;
    cacheGoodbyeMessageSent(userId: number, ttl?: number): boolean;
    isGoodbyeMessageSent(userId: number): boolean;
    checkRateLimit(identifier: string, maxRequests?: number, timeWindow?: number): boolean;
    setWithTTL<T>(key: string, value: T, ttlSeconds: number): void;
}
declare const _default: CacheManager;
export default _default;
//# sourceMappingURL=cache.d.ts.map