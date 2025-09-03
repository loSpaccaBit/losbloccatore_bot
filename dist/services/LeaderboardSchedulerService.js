"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardSchedulerService = void 0;
const cron = __importStar(require("node-cron"));
const LeaderboardImageService_1 = require("./LeaderboardImageService");
const TelegramService_1 = require("./TelegramService");
const logger_1 = __importDefault(require("../utils/logger"));
const config_1 = __importDefault(require("../config"));
class LeaderboardSchedulerService {
    constructor(chatId, cronExpression) {
        this.isRunning = false;
        this.scheduledTask = null;
        this.adminUserId = null;
        this.telegramService = null;
        this.leaderboardImageService = null;
        this.chatId = chatId || Number(config_1.default.channelId);
        this.adminUserId = config_1.default.adminUserId ? Number(config_1.default.adminUserId) : null;
        this.cronExpression = cronExpression || '0 * * * *';
    }
    getTelegramService() {
        if (!this.telegramService) {
            this.telegramService = new TelegramService_1.TelegramService();
        }
        return this.telegramService;
    }
    getLeaderboardImageService() {
        if (!this.leaderboardImageService) {
            this.leaderboardImageService = new LeaderboardImageService_1.LeaderboardImageService();
        }
        return this.leaderboardImageService;
    }
    start() {
        if (this.isRunning) {
            logger_1.default.warn('Leaderboard scheduler is already running');
            return;
        }
        if (!this.adminUserId) {
            logger_1.default.error('Cannot start leaderboard scheduler: ADMIN_USER_ID not configured');
            return;
        }
        logger_1.default.info('Starting leaderboard scheduler', {
            chatId: this.chatId,
            adminUserId: this.adminUserId,
            cronExpression: this.cronExpression,
            timezone: 'Europe/Rome'
        });
        if (!cron.validate(this.cronExpression)) {
            logger_1.default.error('Invalid cron expression', { cronExpression: this.cronExpression });
            return;
        }
        try {
            this.scheduledTask = cron.schedule(this.cronExpression, async () => {
                logger_1.default.info('Cron job triggered - generating leaderboard');
                await this.generateAndSendLeaderboard();
            }, {
                timezone: 'Europe/Rome'
            });
            this.isRunning = true;
            logger_1.default.info('Leaderboard scheduler started successfully', {
                nextRun: this.scheduledTask ? 'scheduled' : 'unknown'
            });
        }
        catch (error) {
            logger_1.default.error('Failed to start leaderboard scheduler', error);
        }
    }
    stop() {
        if (!this.isRunning || !this.scheduledTask) {
            logger_1.default.warn('Leaderboard scheduler is not running');
            return;
        }
        this.scheduledTask.stop();
        this.scheduledTask = null;
        this.isRunning = false;
        logger_1.default.info('Leaderboard scheduler stopped');
    }
    async generateAndSendLeaderboard() {
        try {
            if (!this.adminUserId) {
                logger_1.default.error('Cannot send leaderboard: admin user ID not configured');
                return;
            }
            logger_1.default.info('Generating and sending scheduled leaderboard to admin', {
                chatId: this.chatId,
                adminUserId: this.adminUserId
            });
            const dbChatId = this.chatId;
            const imagePath = await this.getLeaderboardImageService().generateLeaderboardImage(dbChatId);
            const leaderboardData = await this.getLeaderboardImageService().getLeaderboardData(dbChatId, 10);
            let messageText;
            const currentTime = new Date().toLocaleString('it-IT', {
                timeZone: 'Europe/Rome',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            if (leaderboardData.length === 0) {
                messageText = `🏆 **CLASSIFICA CONTEST** 🏆\n\n` +
                    `📅 Aggiornamento: ${currentTime}\n\n` +
                    `🚫 Nessun partecipante al momento\n\n` +
                    `💡 **Come partecipano gli utenti:**\n` +
                    `• Visita TikTok: 3 punti (solo 1 volta)\n` +
                    `• Invita amici: 2 punti per amico\n\n` +
                    `📊 **Canale:** ${config_1.default.channelId}`;
            }
            else {
                messageText = `🏆 **CLASSIFICA CONTEST** 🏆\n\n` +
                    `📅 Aggiornamento: ${currentTime}\n` +
                    `👥 Partecipanti: ${leaderboardData.length}\n\n`;
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                leaderboardData.forEach((participant, index) => {
                    const medal = medals[index] || `${index + 1}️⃣`;
                    messageText += `${medal} **${participant.username}** - ${participant.points} punti\n`;
                });
                messageText += `\n📊 **Canale:** ${config_1.default.channelId}`;
            }
            await this.getTelegramService().sendPhoto(this.adminUserId, imagePath, messageText);
            logger_1.default.info('Scheduled leaderboard sent to admin successfully', {
                adminUserId: this.adminUserId,
                dbChatId,
                participantCount: leaderboardData.length,
                imagePath
            });
        }
        catch (error) {
            logger_1.default.error('Failed to generate and send scheduled leaderboard to admin', error, {
                chatId: this.chatId,
                adminUserId: this.adminUserId
            });
        }
    }
    async sendLeaderboardNow() {
        logger_1.default.info('Manual leaderboard generation requested', { chatId: this.chatId });
        await this.generateAndSendLeaderboard();
    }
    updateSchedule(cronExpression) {
        logger_1.default.info('Updating leaderboard schedule', {
            oldSchedule: this.cronExpression,
            newSchedule: cronExpression
        });
        if (this.isRunning) {
            this.stop();
        }
        this.cronExpression = cronExpression;
        this.start();
    }
    updateChatId(chatId) {
        logger_1.default.info('Updating leaderboard chat ID', {
            oldChatId: this.chatId,
            newChatId: chatId
        });
        this.chatId = chatId;
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            chatId: this.chatId,
            cronExpression: this.cronExpression,
            adminUserId: this.adminUserId
        };
    }
    isActive() {
        return this.isRunning;
    }
    startTestSchedule() {
        logger_1.default.info('Starting test cron job (every minute for 5 minutes)');
        let testCount = 0;
        const maxTests = 5;
        const testTask = cron.schedule('* * * * *', () => {
            testCount++;
            logger_1.default.info(`Test cron job executed ${testCount}/${maxTests}`, {
                timestamp: new Date().toISOString()
            });
            if (testCount >= maxTests) {
                testTask.stop();
                logger_1.default.info('Test cron job completed - node-cron is working!');
            }
        }, {
            timezone: 'Europe/Rome'
        });
    }
}
exports.LeaderboardSchedulerService = LeaderboardSchedulerService;
exports.default = new LeaderboardSchedulerService();
//# sourceMappingURL=LeaderboardSchedulerService.js.map