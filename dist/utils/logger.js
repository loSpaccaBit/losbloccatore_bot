"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const index_1 = __importDefault(require("../config/index"));
const path_1 = __importDefault(require("path"));
class Logger {
    constructor() {
        this.logger = winston_1.default.createLogger({
            level: index_1.default.logging.level,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
            defaultMeta: {
                service: 'losbloccatore-bot',
                environment: index_1.default.environment
            },
            transports: this.createTransports()
        });
        if (index_1.default.environment === 'development') {
            this.logger.add(new winston_1.default.transports.Console({
                format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple(), winston_1.default.format.printf(({ timestamp, level, message, service, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                    return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
                }))
            }));
        }
    }
    createTransports() {
        const logsDir = path_1.default.join(process.cwd(), 'logs');
        return [
            new winston_daily_rotate_file_1.default({
                filename: path_1.default.join(logsDir, 'error-%DATE%.log'),
                datePattern: index_1.default.logging.datePattern,
                level: 'error',
                maxFiles: index_1.default.logging.maxFiles,
                maxSize: index_1.default.logging.maxSize,
                format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json())
            }),
            new winston_daily_rotate_file_1.default({
                filename: path_1.default.join(logsDir, 'combined-%DATE%.log'),
                datePattern: index_1.default.logging.datePattern,
                maxFiles: index_1.default.logging.maxFiles,
                maxSize: index_1.default.logging.maxSize,
                format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json())
            })
        ];
    }
    info(message, meta) {
        this.logger.info(message, meta);
    }
    error(message, error, meta) {
        this.logger.error(message, {
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : error,
            ...meta
        });
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
    logUserJoin(userId, username, chatId, chatTitle) {
        this.info('User join request received', {
            userId,
            username,
            chatId,
            chatTitle,
            action: 'join_request'
        });
    }
    logUserApproved(userId, username, chatId, chatTitle) {
        this.info('User join request approved', {
            userId,
            username,
            chatId,
            chatTitle,
            action: 'approved'
        });
    }
    logUserLeft(userId, username, chatId, chatTitle) {
        this.info('User left chat', {
            userId,
            username,
            chatId,
            chatTitle,
            action: 'left'
        });
    }
    logMessageSent(userId, messageType, success, error) {
        const level = success ? 'info' : 'warn';
        this.logger.log(level, `${messageType} message ${success ? 'sent successfully' : 'failed'}`, {
            userId,
            messageType,
            success,
            error: error ? {
                message: error.message,
                name: error.name
            } : undefined
        });
    }
    logBotAction(action, details) {
        this.info(`Bot action: ${action}`, {
            action,
            details,
            timestamp: new Date().toISOString()
        });
    }
}
exports.default = new Logger();
//# sourceMappingURL=logger.js.map