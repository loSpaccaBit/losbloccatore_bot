import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

class DatabaseConnection {
  private prisma: PrismaClient | null = null;

  async initialize(): Promise<PrismaClient> {
    if (this.prisma) {
      return this.prisma;
    }

    this.prisma = new PrismaClient({
      log: ['error', 'warn']
    });

    try {
      await this.prisma.$connect();
      logger.info('Database connection initialized successfully with Prisma');
      
      return this.prisma;
    } catch (error) {
      logger.error('Failed to initialize database connection', error);
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async close(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      logger.info('Database connection closed');
      this.prisma = null;
    }
  }

  getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database connection not initialized. Call initialize() first.');
    }
    return this.prisma;
  }

  async checkConnection(): Promise<boolean> {
    try {
      if (!this.prisma) {
        return false;
      }
      
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database connection check failed', error);
      return false;
    }
  }
}

export default new DatabaseConnection();