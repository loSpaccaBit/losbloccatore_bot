import { Telegraf } from 'telegraf';
export declare class TelegramCoreService {
    private bot;
    private isPolling;
    constructor();
    private setupErrorHandling;
    getBot(): Telegraf;
    startPolling(): Promise<void>;
    stop(): Promise<void>;
    isCurrentlyPolling(): boolean;
    getBotInfo(): Promise<any>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=TelegramCoreService.d.ts.map