"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const validation_1 = require("./validation");
const parseAdminUserIds = () => {
    const adminIds = [];
    if (process.env.ADMIN_USER_IDS) {
        const ids = process.env.ADMIN_USER_IDS.split(',')
            .map(id => parseInt(id.trim(), 10))
            .filter(id => !isNaN(id));
        adminIds.push(...ids);
    }
    if (process.env.ADMIN_USER_ID && adminIds.length === 0) {
        const id = parseInt(process.env.ADMIN_USER_ID, 10);
        if (!isNaN(id)) {
            adminIds.push(id);
        }
    }
    return adminIds;
};
const config = {
    token: process.env.BOT_TOKEN || '',
    channelId: process.env.CHANNEL_ID || '',
    ...(process.env.ADMIN_USER_ID && { adminUserId: parseInt(process.env.ADMIN_USER_ID, 10) }),
    adminUserIds: parseAdminUserIds(),
    environment: process.env.NODE_ENV || 'development',
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
        level: process.env.LOG_LEVEL || 'info',
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '14', 10),
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
    },
    cache: {
        ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
        maxKeys: parseInt(process.env.CACHE_MAX_KEYS || '1000', 10)
    }
};
const validationResult = (0, validation_1.validateConfig)(config);
if (validationResult.error) {
    console.error('❌ Configuration validation failed:', validationResult.error.details);
    process.exit(1);
}
exports.default = config;
//# sourceMappingURL=index.js.map