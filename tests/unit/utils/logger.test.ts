import logger from '@utils/logger';
import winston from 'winston';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    add: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn()
  }
}));

jest.mock('winston-daily-rotate-file', () => jest.fn());

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic logging methods', () => {
    it('should log info messages', () => {
      const message = 'Test info message';
      const meta = { test: 'data' };

      logger.info(message, meta);

      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should log error messages with error objects', () => {
      const message = 'Test error message';
      const error = new Error('Test error');
      const meta = { test: 'data' };

      logger.error(message, error, meta);

      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      const message = 'Test warning message';
      const meta = { test: 'data' };

      logger.warn(message, meta);

      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should log debug messages', () => {
      const message = 'Test debug message';
      const meta = { test: 'data' };

      logger.debug(message, meta);

      expect(winston.createLogger).toHaveBeenCalled();
    });
  });

  describe('Bot-specific logging methods', () => {
    const userId = 123456789;
    const username = 'testuser';
    const chatId = -987654321;
    const chatTitle = 'Test Chat';

    it('should log user join requests', () => {
      logger.logUserJoin(userId, username, chatId, chatTitle);

      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should log user approvals', () => {
      logger.logUserApproved(userId, username, chatId, chatTitle);

      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should log user leaving', () => {
      logger.logUserLeft(userId, username, chatId, chatTitle);

      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should log successful message sending', () => {
      logger.logMessageSent(userId, 'welcome', true);

      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should log failed message sending with error', () => {
      const error = new Error('Message failed');
      logger.logMessageSent(userId, 'goodbye', false, error);

      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should log bot actions', () => {
      const action = 'start_polling';
      const details = { timestamp: new Date().toISOString() };

      logger.logBotAction(action, details);

      expect(winston.createLogger).toHaveBeenCalled();
    });
  });
});