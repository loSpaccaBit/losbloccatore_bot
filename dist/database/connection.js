"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../utils/logger"));
class DatabaseConnection {
    constructor() {
        this.prisma = null;
    }
    async initialize() {
        if (this.prisma) {
            return this.prisma;
        }
        this.prisma = new client_1.PrismaClient({
            log: ['error', 'warn']
        });
        try {
            await this.prisma.$connect();
            logger_1.default.info('Database connection initialized successfully with Prisma');
            return this.prisma;
        }
        catch (error) {
            logger_1.default.error('Failed to initialize database connection', error);
            throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async close() {
        if (this.prisma) {
            await this.prisma.$disconnect();
            logger_1.default.info('Database connection closed');
            this.prisma = null;
        }
    }
    getPrisma() {
        if (!this.prisma) {
            throw new Error('Database connection not initialized. Call initialize() first.');
        }
        return this.prisma;
    }
    async checkConnection() {
        try {
            if (!this.prisma) {
                return false;
            }
            await this.prisma.$queryRaw `SELECT 1`;
            return true;
        }
        catch (error) {
            logger_1.default.error('Database connection check failed', error);
            return false;
        }
    }
}
exports.default = new DatabaseConnection();
//# sourceMappingURL=connection.js.map