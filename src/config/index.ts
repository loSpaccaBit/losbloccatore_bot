import 'dotenv/config';
import { BotConfig } from '../types/index';
import { validateConfig } from './validation';

const config: BotConfig = {
  token: process.env.BOT_TOKEN || '',
  channelId: process.env.CHANNEL_ID || '',
  ...(process.env.ADMIN_USER_ID && { adminUserId: parseInt(process.env.ADMIN_USER_ID, 10) }),
  environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'losbloccatore',
    logging: process.env.DB_LOGGING === 'true' || false
  },
  
  logging: {
    level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '14', 10),
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
  },
  
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10), // 1 hour default
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS || '1000', 10)
  }
};

// Validate configuration
const validationResult = validateConfig(config);
if (validationResult.error) {
  console.error('❌ Configuration validation failed:', validationResult.error.details);
  process.exit(1);
}

export default config;
export { BotConfig };