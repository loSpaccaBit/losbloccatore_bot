import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from '../config/index';
import path from 'path';

class Logger {
  private logger: winston.Logger;

  /**
   * JSON replacer function to handle BigInt serialization
   */
  private bigIntReplacer = (_key: string, value: any): any => {
    return typeof value === 'bigint' ? value.toString() : value;
  };

  constructor() {
    this.logger = winston.createLogger({
      level: config.logging.level,
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json({ replacer: this.bigIntReplacer })
      ),
      defaultMeta: {
        service: 'losbloccatore-bot',
        environment: config.environment
      },
      transports: this.createTransports()
    });

    // Add console transport for development
    if (config.environment === 'development') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, this.bigIntReplacer, 2) : '';
            return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
          })
        )
      }));
    }
  }

  private createTransports(): winston.transport[] {
    const logsDir = path.join(process.cwd(), 'logs');
    
    return [
      // Error logs
      new DailyRotateFile({
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: config.logging.datePattern,
        level: 'error',
        maxFiles: config.logging.maxFiles,
        maxSize: config.logging.maxSize,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }),
      
      // Combined logs
      new DailyRotateFile({
        filename: path.join(logsDir, 'combined-%DATE%.log'),
        datePattern: config.logging.datePattern,
        maxFiles: config.logging.maxFiles,
        maxSize: config.logging.maxSize,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    ];
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, error?: Error | any, meta?: any): void {
    this.logger.error(message, {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      ...meta
    });
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  // Bot-specific logging methods
  logUserJoin(userId: number, username: string, chatId: number, chatTitle: string): void {
    this.info('User join request received', {
      userId,
      username,
      chatId,
      chatTitle,
      action: 'join_request'
    });
  }

  logUserApproved(userId: number, username: string, chatId: number, chatTitle: string): void {
    this.info('User join request approved', {
      userId,
      username,
      chatId,
      chatTitle,
      action: 'approved'
    });
  }

  logUserLeft(userId: number, username: string, chatId: number, chatTitle: string): void {
    this.info('User left chat', {
      userId,
      username,
      chatId,
      chatTitle,
      action: 'left'
    });
  }

  logMessageSent(userId: number, messageType: 'goodbye' | 'welcome_tiktok' | 'tiktok_points' | 'welcome_returning_user', success: boolean, error?: Error): void {
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

  logBotAction(action: string, details?: any): void {
    this.info(`Bot action: ${action}`, {
      action,
      details,
      timestamp: new Date().toISOString()
    });
  }
}

export default new Logger();