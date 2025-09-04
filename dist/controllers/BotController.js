"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotController = void 0;
const JoinRequestHandler_1 = require("../handlers/JoinRequestHandler");
const MemberLifecycleHandler_1 = require("../handlers/MemberLifecycleHandler");
const CommandHandler_1 = require("../handlers/CommandHandler");
const TikTokTaskHandler_1 = require("../handlers/TikTokTaskHandler");
const AdminCommandHandler_1 = require("../handlers/AdminCommandHandler");
const BotStatusHandler_1 = require("../handlers/BotStatusHandler");
const logger_1 = __importDefault(require("../utils/logger"));
class BotController {
    constructor(services) {
        this.joinRequestHandler = new JoinRequestHandler_1.JoinRequestHandler(services.telegramService, services.userActivityService, services.contestService);
        this.memberLifecycleHandler = new MemberLifecycleHandler_1.MemberLifecycleHandler(services.telegramService, services.userActivityService, services.contestService);
        this.commandHandler = new CommandHandler_1.CommandHandler(services.telegramService, services.contestService);
        this.tikTokTaskHandler = new TikTokTaskHandler_1.TikTokTaskHandler(services.telegramService, services.contestService);
        this.adminCommandHandler = new AdminCommandHandler_1.AdminCommandHandler(services.userActivityService, services.contestService);
        this.botStatusHandler = new BotStatusHandler_1.BotStatusHandler();
        logger_1.default.info('BotController initialized with all handlers');
    }
    async handleChatJoinRequest(ctx) {
        try {
            await this.joinRequestHandler.handleChatJoinRequest(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in chat join request handling', error);
        }
    }
    async handleChatMemberUpdate(ctx) {
        try {
            await this.memberLifecycleHandler.handleChatMemberUpdate(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in chat member update handling', error);
        }
    }
    async handleLeftChatMember(ctx) {
        try {
            await this.memberLifecycleHandler.handleLeftChatMember(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in left chat member handling', error);
        }
    }
    async handleTiktokMessage(ctx) {
        try {
            await this.tikTokTaskHandler.handleTiktokMessage(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in TikTok message handling', error);
        }
    }
    async handleTikTokCallback(ctx) {
        try {
            await this.tikTokTaskHandler.handleTikTokCallback(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in TikTok callback handling', error);
        }
    }
    async handleStartCommand(ctx) {
        try {
            await this.commandHandler.handleStartCommand(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in start command handling', error);
        }
    }
    async handleClassificaCommand(ctx) {
        try {
            await this.commandHandler.handleClassificaCommand(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in classifica command handling', error);
        }
    }
    async handleHelpCommand(ctx) {
        try {
            await this.commandHandler.handleHelpCommand(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in help command handling', error);
        }
    }
    async handleLinkCommand(ctx) {
        try {
            await this.commandHandler.handleLinkCommand(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in link command handling', error);
        }
    }
    async handleGenerateClassificaCommand(ctx) {
        try {
            await this.adminCommandHandler.handleGenerateClassificaCommand(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in admin classifica generation', error);
        }
    }
    async handleHealthCommand(ctx) {
        try {
            await this.adminCommandHandler.handleHealthCommand(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in health command handling', error);
        }
    }
    async handleStatsCommand(ctx) {
        try {
            await this.adminCommandHandler.handleStatsCommand(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in stats command handling', error);
        }
    }
    async handleCleanupCommand(ctx) {
        try {
            await this.adminCommandHandler.handleCleanupCommand(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in cleanup command handling', error);
        }
    }
    async handleContestCommand(ctx) {
        try {
            await this.adminCommandHandler.handleContestCommand(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in contest command handling', error);
        }
    }
    async handleMessageCommand(ctx) {
        try {
            await this.adminCommandHandler.handleMessageCommand(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in admin message command handling', error);
        }
    }
    async handleMyChatMember(ctx) {
        try {
            await this.botStatusHandler.handleMyChatMember(ctx);
        }
        catch (error) {
            logger_1.default.error('Error in bot status handling', error);
        }
    }
    getJoinRequestHandler() {
        return this.joinRequestHandler;
    }
    getMemberLifecycleHandler() {
        return this.memberLifecycleHandler;
    }
    getCommandHandler() {
        return this.commandHandler;
    }
    getTikTokTaskHandler() {
        return this.tikTokTaskHandler;
    }
    getAdminCommandHandler() {
        return this.adminCommandHandler;
    }
    getBotStatusHandler() {
        return this.botStatusHandler;
    }
    async isHealthy() {
        try {
            return true;
        }
        catch (error) {
            logger_1.default.error('Health check failed', error);
            return false;
        }
    }
    async shutdown() {
        try {
            logger_1.default.info('BotController shutting down...');
            logger_1.default.info('BotController shutdown complete');
        }
        catch (error) {
            logger_1.default.error('Error during BotController shutdown', error);
        }
    }
}
exports.BotController = BotController;
//# sourceMappingURL=BotController.js.map