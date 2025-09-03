import Joi from 'joi';
import { BotConfig } from '../types/index';

const configSchema = Joi.object<BotConfig>({
  token: Joi.string().required().messages({
    'string.empty': 'BOT_TOKEN is required',
    'any.required': 'BOT_TOKEN environment variable must be set'
  }),
  
  channelId: Joi.string().required().messages({
    'string.empty': 'CHANNEL_ID is required',
    'any.required': 'CHANNEL_ID environment variable must be set'
  }),

  adminUserId: Joi.number().integer().optional().messages({
    'number.base': 'ADMIN_USER_ID must be a valid integer',
    'number.integer': 'ADMIN_USER_ID must be an integer'
  }),

  adminUserIds: Joi.array().items(
    Joi.number().integer().messages({
      'number.base': 'Each ADMIN_USER_ID must be a valid integer',
      'number.integer': 'Each ADMIN_USER_ID must be an integer'
    })
  ).default([]).messages({
    'array.base': 'ADMIN_USER_IDS must be an array of integers'
  }),
  
  environment: Joi.string().valid('development', 'production', 'test').default('development'),
  
  port: Joi.number().integer().min(1).max(65535).default(3000),
  
  database: Joi.object({
    host: Joi.string().required().messages({
      'string.empty': 'DB_HOST is required for PostgreSQL',
      'any.required': 'DB_HOST environment variable must be set'
    }),
    port: Joi.number().integer().min(1).max(65535).default(5432),
    username: Joi.string().required().messages({
      'string.empty': 'DB_USERNAME is required for PostgreSQL',
      'any.required': 'DB_USERNAME environment variable must be set'
    }),
    password: Joi.string().required().messages({
      'string.empty': 'DB_PASSWORD is required for PostgreSQL',
      'any.required': 'DB_PASSWORD environment variable must be set'
    }),
    database: Joi.string().required().messages({
      'string.empty': 'DB_NAME is required',
      'any.required': 'Database name must be specified'
    }),
    logging: Joi.boolean().default(false)
  }).required(),
  
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    maxFiles: Joi.number().integer().min(1).default(14),
    maxSize: Joi.string().default('20m'),
    datePattern: Joi.string().default('YYYY-MM-DD')
  }).required(),
  
  cache: Joi.object({
    ttl: Joi.number().integer().min(1).default(3600),
    maxKeys: Joi.number().integer().min(1).default(1000)
  }).required()
});

export const validateConfig = (config: BotConfig) => {
  return configSchema.validate(config, {
    allowUnknown: false,
    abortEarly: false
  });
};