"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = void 0;
const joi_1 = __importDefault(require("joi"));
const configSchema = joi_1.default.object({
    token: joi_1.default.string().required().messages({
        'string.empty': 'BOT_TOKEN is required',
        'any.required': 'BOT_TOKEN environment variable must be set'
    }),
    channelId: joi_1.default.string().required().messages({
        'string.empty': 'CHANNEL_ID is required',
        'any.required': 'CHANNEL_ID environment variable must be set'
    }),
    adminUserId: joi_1.default.number().integer().optional().messages({
        'number.base': 'ADMIN_USER_ID must be a valid integer',
        'number.integer': 'ADMIN_USER_ID must be an integer'
    }),
    environment: joi_1.default.string().valid('development', 'production', 'test').default('development'),
    port: joi_1.default.number().integer().min(1).max(65535).default(3000),
    database: joi_1.default.object({
        host: joi_1.default.string().required().messages({
            'string.empty': 'DB_HOST is required for PostgreSQL',
            'any.required': 'DB_HOST environment variable must be set'
        }),
        port: joi_1.default.number().integer().min(1).max(65535).default(5432),
        username: joi_1.default.string().required().messages({
            'string.empty': 'DB_USERNAME is required for PostgreSQL',
            'any.required': 'DB_USERNAME environment variable must be set'
        }),
        password: joi_1.default.string().required().messages({
            'string.empty': 'DB_PASSWORD is required for PostgreSQL',
            'any.required': 'DB_PASSWORD environment variable must be set'
        }),
        database: joi_1.default.string().required().messages({
            'string.empty': 'DB_NAME is required',
            'any.required': 'Database name must be specified'
        }),
        logging: joi_1.default.boolean().default(false)
    }).required(),
    logging: joi_1.default.object({
        level: joi_1.default.string().valid('error', 'warn', 'info', 'debug').default('info'),
        maxFiles: joi_1.default.number().integer().min(1).default(14),
        maxSize: joi_1.default.string().default('20m'),
        datePattern: joi_1.default.string().default('YYYY-MM-DD')
    }).required(),
    cache: joi_1.default.object({
        ttl: joi_1.default.number().integer().min(1).default(3600),
        maxKeys: joi_1.default.number().integer().min(1).default(1000)
    }).required()
});
const validateConfig = (config) => {
    return configSchema.validate(config, {
        allowUnknown: false,
        abortEarly: false
    });
};
exports.validateConfig = validateConfig;
//# sourceMappingURL=validation.js.map