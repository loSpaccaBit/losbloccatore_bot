declare class Logger {
    private logger;
    private bigIntReplacer;
    constructor();
    private createTransports;
    info(message: string, meta?: any): void;
    error(message: string, error?: Error | any, meta?: any): void;
    warn(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
    logUserJoin(userId: number, username: string, chatId: number, chatTitle: string): void;
    logUserApproved(userId: number, username: string, chatId: number, chatTitle: string): void;
    logUserLeft(userId: number, username: string, chatId: number, chatTitle: string): void;
    logMessageSent(userId: number, messageType: 'goodbye' | 'welcome_tiktok' | 'tiktok_points' | 'welcome_returning_user', success: boolean, error?: Error): void;
    logBotAction(action: string, details?: any): void;
}
declare const _default: Logger;
export default _default;
//# sourceMappingURL=logger.d.ts.map