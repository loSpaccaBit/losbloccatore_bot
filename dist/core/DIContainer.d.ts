import { TelegramService } from '../services/TelegramService';
import { UserActivityService } from '../services/UserActivityService';
import { ContestService } from '../services/ContestService';
import messageService from '../services/MessageService';
import leaderboardScheduler from '../services/LeaderboardSchedulerService';
export interface ServiceContainer {
    telegramService: TelegramService;
    userActivityService: UserActivityService;
    contestService: ContestService;
    messageService: typeof messageService;
    leaderboardScheduler: typeof leaderboardScheduler;
}
export declare class DIContainer {
    private static instance;
    private services;
    private initialized;
    private constructor();
    static getInstance(): DIContainer;
    initialize(): ServiceContainer;
    getServices(): ServiceContainer;
    getService<K extends keyof ServiceContainer>(serviceName: K): ServiceContainer[K];
    clear(): void;
}
declare const _default: DIContainer;
export default _default;
//# sourceMappingURL=DIContainer.d.ts.map