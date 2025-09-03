"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardImageService = void 0;
const canvas_1 = require("canvas");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ContestService_1 = require("./ContestService");
const logger_1 = __importDefault(require("../utils/logger"));
class LeaderboardImageService {
    constructor() {
        this.contestService = null;
        this.templatePath = path_1.default.join(process.cwd(), 'media', 'classifica.png');
        this.outputPath = path_1.default.join(process.cwd(), 'media', 'classifica_output.png');
    }
    getContestService() {
        if (!this.contestService) {
            this.contestService = new ContestService_1.ContestService();
        }
        return this.contestService;
    }
    applyTextStyle(ctx, config) {
        ctx.fillStyle = config.fillStyle;
        ctx.strokeStyle = config.strokeStyle;
        ctx.lineWidth = config.lineWidth;
        ctx.font = config.font;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = config.shadowColor;
        ctx.shadowOffsetX = config.shadowOffset.x;
        ctx.shadowOffsetY = config.shadowOffset.y;
        ctx.shadowBlur = config.shadowBlur;
    }
    async generateLeaderboardImage(chatId) {
        try {
            logger_1.default.info('Starting leaderboard image generation', { chatId });
            const topParticipants = await this.getContestService().getLeaderboard(chatId, 5);
            if (topParticipants.length === 0) {
                logger_1.default.info('No participants found, generating empty leaderboard', { chatId });
                return await this.generateEmptyLeaderboard();
            }
            const templateImage = await (0, canvas_1.loadImage)(this.templatePath);
            const canvas = (0, canvas_1.createCanvas)(templateImage.width, templateImage.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(templateImage, 0, 0);
            const positions = [
                { x: 190, y: 435, maxWidth: 500 },
                { x: 190, y: 565, maxWidth: 500 },
                { x: 190, y: 690, maxWidth: 500 },
                { x: 190, y: 815, maxWidth: 500 },
                { x: 190, y: 940, maxWidth: 500 }
            ];
            this.applyTextStyle(ctx, LeaderboardImageService.MAIN_TEXT_CONFIG);
            const getDisplayName = (participant) => {
                if (participant.username) {
                    return `@${participant.username}`;
                }
                if (participant.lastName) {
                    return `${participant.firstName} ${participant.lastName}`;
                }
                if (participant.firstName) {
                    return participant.firstName;
                }
                return `Utente #${participant.userId}`;
            };
            for (let i = 0; i < Math.min(topParticipants.length, 5); i++) {
                const participant = topParticipants[i];
                const position = positions[i];
                const displayName = getDisplayName(participant);
                const text = displayName;
                const truncatedText = this.truncateText(ctx, text, position.maxWidth);
                const textX = position.x;
                const textY = position.y;
                ctx.strokeText(truncatedText, textX, textY);
                ctx.fillText(truncatedText, textX, textY);
                logger_1.default.debug('Added participant to leaderboard image', {
                    rank: i + 1,
                    userId: participant.userId,
                    username: participant.username || null,
                    displayName,
                    points: participant.points,
                    x: position.x,
                    y: position.y
                });
            }
            const buffer = canvas.toBuffer('image/png');
            fs_1.default.writeFileSync(this.outputPath, buffer);
            logger_1.default.info('Leaderboard image generated successfully', {
                chatId,
                participantCount: topParticipants.length,
                outputPath: this.outputPath
            });
            return this.outputPath;
        }
        catch (error) {
            logger_1.default.error('Failed to generate leaderboard image', error, { chatId });
            throw error;
        }
    }
    truncateText(ctx, text, maxWidth) {
        const metrics = ctx.measureText(text);
        if (metrics.width <= maxWidth) {
            return text;
        }
        let low = 0;
        let high = text.length;
        let result = text;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const truncated = text.substring(0, mid) + '...';
            const width = ctx.measureText(truncated).width;
            if (width <= maxWidth) {
                result = truncated;
                low = mid + 1;
            }
            else {
                high = mid - 1;
            }
        }
        return result;
    }
    async getLeaderboardData(chatId, limit = 5) {
        try {
            const participants = await this.getContestService().getLeaderboard(chatId, limit);
            const getDisplayName = (participant) => {
                if (participant.username) {
                    return participant.username;
                }
                if (participant.lastName) {
                    return `${participant.firstName} ${participant.lastName}`;
                }
                if (participant.firstName) {
                    return participant.firstName;
                }
                return `Utente #${participant.userId}`;
            };
            return participants.slice(0, limit).map((participant, index) => ({
                rank: index + 1,
                username: getDisplayName(participant),
                points: participant.points
            }));
        }
        catch (error) {
            logger_1.default.error('Failed to get leaderboard data', error, { chatId, limit });
            throw error;
        }
    }
    getOutputPath() {
        return this.outputPath;
    }
    getTemplatePath() {
        return this.templatePath;
    }
    async generateEmptyLeaderboard() {
        try {
            const templateImage = await (0, canvas_1.loadImage)(this.templatePath);
            const canvas = (0, canvas_1.createCanvas)(templateImage.width, templateImage.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(templateImage, 0, 0);
            const positions = [
                { x: 190, y: 435, maxWidth: 500 },
                { x: 190, y: 565, maxWidth: 500 },
                { x: 190, y: 690, maxWidth: 500 },
                { x: 190, y: 815, maxWidth: 500 },
                { x: 190, y: 940, maxWidth: 500 }
            ];
            this.applyTextStyle(ctx, LeaderboardImageService.EMPTY_TEXT_CONFIG);
            for (let i = 0; i < 5; i++) {
                const position = positions[i];
                const text = 'Nessun partecipante ancora...';
                const textX = position.x;
                const textY = position.y;
                ctx.strokeText(text, textX, textY);
                ctx.fillText(text, textX, textY);
            }
            const buffer = canvas.toBuffer('image/png');
            fs_1.default.writeFileSync(this.outputPath, buffer);
            logger_1.default.info('Empty leaderboard image generated successfully', {
                outputPath: this.outputPath
            });
            return this.outputPath;
        }
        catch (error) {
            logger_1.default.error('Failed to generate empty leaderboard image', error);
            throw error;
        }
    }
}
exports.LeaderboardImageService = LeaderboardImageService;
LeaderboardImageService.MAIN_TEXT_CONFIG = {
    fillStyle: '#FFFFFF',
    strokeStyle: '#000000',
    lineWidth: 2,
    font: 'bold 36px "Azeret Mono", monospace',
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { x: 2, y: 2 },
    shadowBlur: 4
};
LeaderboardImageService.EMPTY_TEXT_CONFIG = {
    fillStyle: '#FFFFFF',
    strokeStyle: '#000000',
    lineWidth: 2,
    font: 'bold 36px "Azeret Mono", monospace',
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { x: 2, y: 2 },
    shadowBlur: 4
};
//# sourceMappingURL=LeaderboardImageService.js.map