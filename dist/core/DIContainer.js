"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIContainer = void 0;
const TelegramService_1 = require("../services/TelegramService");
const UserActivityService_1 = require("../services/UserActivityService");
const ContestService_1 = require("../services/ContestService");
const MessageService_1 = __importDefault(require("../services/MessageService"));
const LeaderboardSchedulerService_1 = __importDefault(require("../services/LeaderboardSchedulerService"));
class DIContainer {
    constructor() {
        this.services = {};
        this.initialized = false;
    }
    static getInstance() {
        if (!DIContainer.instance) {
            DIContainer.instance = new DIContainer();
        }
        return DIContainer.instance;
    }
    initialize() {
        if (this.initialized) {
            return this.services;
        }
        this.services.telegramService = new TelegramService_1.TelegramService();
        this.services.userActivityService = new UserActivityService_1.UserActivityService();
        this.services.contestService = new ContestService_1.ContestService();
        this.services.messageService = MessageService_1.default;
        this.services.leaderboardScheduler = LeaderboardSchedulerService_1.default;
        this.initialized = true;
        return this.services;
    }
    getServices() {
        if (!this.initialized) {
            throw new Error('DIContainer must be initialized before getting services');
        }
        return this.services;
    }
    getService(serviceName) {
        const services = this.getServices();
        return services[serviceName];
    }
    clear() {
        this.services = {};
        this.initialized = false;
    }
}
exports.DIContainer = DIContainer;
exports.default = DIContainer.getInstance();
//# sourceMappingURL=DIContainer.js.map