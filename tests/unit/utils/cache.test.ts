import cache from '@utils/cache';
import NodeCache from 'node-cache';

// Mock NodeCache
jest.mock('node-cache');

describe('CacheManager', () => {
  let mockCache: jest.Mocked<NodeCache>;

  beforeEach(() => {
    mockCache = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      has: jest.fn(),
      flushAll: jest.fn(),
      getStats: jest.fn(),
      on: jest.fn()
    } as any;

    (NodeCache as jest.MockedClass<typeof NodeCache>).mockImplementation(() => mockCache);
    jest.clearAllMocks();
  });

  describe('Basic cache operations', () => {
    it('should set cache values', () => {
      const key = 'test-key';
      const value = 'test-value';
      const ttl = 300;

      mockCache.set.mockReturnValue(true);

      const result = cache.set(key, value, ttl);

      expect(mockCache.set).toHaveBeenCalledWith(key, value, ttl);
      expect(result).toBe(true);
    });

    it('should get cache values', () => {
      const key = 'test-key';
      const expectedValue = 'test-value';

      mockCache.get.mockReturnValue(expectedValue);

      const result = cache.get(key);

      expect(mockCache.get).toHaveBeenCalledWith(key);
      expect(result).toBe(expectedValue);
    });

    it('should delete cache values', () => {
      const key = 'test-key';

      mockCache.del.mockReturnValue(1);

      const result = cache.del(key);

      expect(mockCache.del).toHaveBeenCalledWith(key);
      expect(result).toBe(1);
    });

    it('should check if cache has key', () => {
      const key = 'test-key';

      mockCache.has.mockReturnValue(true);

      const result = cache.has(key);

      expect(mockCache.has).toHaveBeenCalledWith(key);
      expect(result).toBe(true);
    });

    it('should flush all cache', () => {
      cache.flush();

      expect(mockCache.flushAll).toHaveBeenCalled();
    });

    it('should get cache stats', () => {
      const expectedStats = {
        keys: 5,
        hits: 10,
        misses: 2,
        ksize: 100,
        vsize: 500
      };

      mockCache.getStats.mockReturnValue(expectedStats);

      const result = cache.getStats();

      expect(mockCache.getStats).toHaveBeenCalled();
      expect(result).toEqual(expectedStats);
    });
  });

  describe('Bot-specific cache methods', () => {
    const userId = 123456789;
    const action = 'join_request';

    it('should cache user actions', () => {
      const ttl = 300;
      mockCache.set.mockReturnValue(true);

      const result = cache.cacheUserAction(userId, action, ttl);

      expect(mockCache.set).toHaveBeenCalledWith(
        `user_action:${userId}:${action}`,
        { timestamp: expect.any(Number), action },
        ttl
      );
      expect(result).toBe(true);
    });

    it('should get user actions', () => {
      const expectedAction = { timestamp: Date.now(), action };
      mockCache.get.mockReturnValue(expectedAction);

      const result = cache.getUserAction(userId, action);

      expect(mockCache.get).toHaveBeenCalledWith(`user_action:${userId}:${action}`);
      expect(result).toEqual(expectedAction);
    });

    it('should cache welcome message sent', () => {
      const ttl = 86400;
      mockCache.set.mockReturnValue(true);

      const result = cache.cacheWelcomeMessageSent(userId, ttl);

      expect(mockCache.set).toHaveBeenCalledWith(`welcome_sent:${userId}`, true, ttl);
      expect(result).toBe(true);
    });

    it('should check if welcome message was sent', () => {
      mockCache.has.mockReturnValue(true);

      const result = cache.isWelcomeMessageSent(userId);

      expect(mockCache.has).toHaveBeenCalledWith(`welcome_sent:${userId}`);
      expect(result).toBe(true);
    });

    it('should cache goodbye message sent', () => {
      const ttl = 3600;
      mockCache.set.mockReturnValue(true);

      const result = cache.cacheGoodbyeMessageSent(userId, ttl);

      expect(mockCache.set).toHaveBeenCalledWith(`goodbye_sent:${userId}`, true, ttl);
      expect(result).toBe(true);
    });

    it('should check if goodbye message was sent', () => {
      mockCache.has.mockReturnValue(false);

      const result = cache.isGoodbyeMessageSent(userId);

      expect(mockCache.has).toHaveBeenCalledWith(`goodbye_sent:${userId}`);
      expect(result).toBe(false);
    });
  });

  describe('Rate limiting', () => {
    const identifier = 'user:123456789';
    const maxRequests = 10;
    const timeWindow = 60;

    it('should allow requests within rate limit', () => {
      mockCache.get.mockReturnValue(5); // Current count is 5
      mockCache.set.mockReturnValue(true);

      const result = cache.checkRateLimit(identifier, maxRequests, timeWindow);

      expect(mockCache.get).toHaveBeenCalledWith(`rate_limit:${identifier}`);
      expect(mockCache.set).toHaveBeenCalledWith(`rate_limit:${identifier}`, 6, timeWindow);
      expect(result).toBe(true);
    });

    it('should block requests exceeding rate limit', () => {
      mockCache.get.mockReturnValue(10); // Current count equals max

      const result = cache.checkRateLimit(identifier, maxRequests, timeWindow);

      expect(mockCache.get).toHaveBeenCalledWith(`rate_limit:${identifier}`);
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should initialize counter for first request', () => {
      mockCache.get.mockReturnValue(undefined); // No previous requests
      mockCache.set.mockReturnValue(true);

      const result = cache.checkRateLimit(identifier, maxRequests, timeWindow);

      expect(mockCache.get).toHaveBeenCalledWith(`rate_limit:${identifier}`);
      expect(mockCache.set).toHaveBeenCalledWith(`rate_limit:${identifier}`, 1, timeWindow);
      expect(result).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle cache set errors', () => {
      mockCache.set.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const result = cache.set('test-key', 'test-value');

      expect(result).toBe(false);
    });

    it('should handle cache get errors', () => {
      mockCache.get.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const result = cache.get('test-key');

      expect(result).toBeUndefined();
    });

    it('should handle cache delete errors', () => {
      mockCache.del.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const result = cache.del('test-key');

      expect(result).toBe(0);
    });

    it('should handle cache has errors', () => {
      mockCache.has.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const result = cache.has('test-key');

      expect(result).toBe(false);
    });
  });
});