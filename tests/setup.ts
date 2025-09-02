import 'reflect-metadata';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'test_bot_token';
process.env.CHANNEL_ID = '-1234567890';
process.env.DB_TYPE = 'sqlite';
process.env.DB_NAME = ':memory:';
process.env.LOG_LEVEL = 'error';

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Setup global test timeout
jest.setTimeout(10000);

// Mock process.exit to prevent tests from actually exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit was called');
});

beforeEach(() => {
  mockExit.mockClear();
});

afterAll(() => {
  mockExit.mockRestore();
});