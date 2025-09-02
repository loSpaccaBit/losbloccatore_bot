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
        this.telegramService = null;
        this.leaderboardImageService = null;
        this.chatId = chatId || Number(config_1.default.channelId);
        this.cronExpression = cronExpression || '0 18 * * *';
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
        logger_1.default.info('Starting leaderboard scheduler', {
            chatId: this.chatId,
            cronExpression: this.cronExpression,
            timezone: 'Europe/Rome'
        });
        this.scheduledTask = cron.schedule(this.cronExpression, async () => {
            await this.generateAndSendLeaderboard();
        }, {
            timezone: 'Europe/Rome'
        });
        this.isRunning = true;
        logger_1.default.info('Leaderboard scheduler started successfully');
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
            logger_1.default.info('Generating and sending scheduled leaderboard', { chatId: this.chatId });
            const dbChatId = this.chatId;
            const imagePath = await this.getLeaderboardImageService().generateLeaderboardImage(dbChatId);
            const leaderboardData = await this.getLeaderboardImageService().getLeaderboardData(dbChatId, 5);
            let messageText;
            if (leaderboardData.length === 0) {
                messageText = '🏆 **CLASSIFICA** 🏆\n\n' +
                    '🚀 Sii il primo a partecipare!\n' +
                    '💫 Unisciti al canale e inizia a guadagnare punti!\n\n' +
                    '🎯 Come partecipare:\n' +
                    '• Visita il nostro TikTok per 3 punti\n' +
                    '• Invita amici per 2 punti ciascuno\n\n' +
                    '💪 La competizione ti aspetta!';
            }
            else {
                messageText = '🏆 **CLASSIFICA AGGIORNATA** 🏆\n\n';
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                leaderboardData.forEach((participant, index) => {
                    const medal = medals[index] || `${index + 1}️⃣`;
                    messageText += `${medal} **${participant.username}** - ${participant.points} punti\n`;
                });
                messageText += '\n💪 Continua a partecipare per scalare la classifica!';
            }
            await this.getTelegramService().sendPhoto(this.chatId, imagePath, messageText);
            logger_1.default.info('Scheduled leaderboard sent successfully', {
                chatId: this.chatId,
                dbChatId,
                participantCount: leaderboardData.length,
                imagePath
            });
        }
        catch (error) {
            logger_1.default.error('Failed to generate and send scheduled leaderboard', error, {
                chatId: this.chatId
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
            cronExpression: this.cronExpression
        };
    }
    isActive() {
        return this.isRunning;
    }
}
exports.LeaderboardSchedulerService = LeaderboardSchedulerService;
exports.default = new LeaderboardSchedulerService();
//# sourceMappingURL=LeaderboardSchedulerService.js.map