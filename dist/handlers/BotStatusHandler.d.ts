import { Context } from 'telegraf';
export declare class BotStatusHandler {
    constructor();
    handleMyChatMember(ctx: Context): Promise<void>;
    private processBotStatusChange;
    private handleBotPromotedToAdmin;
    private handleBotRemovedFromChat;
    private handleBotAddedToChat;
    private handleBotDemoted;
    private isBotPromotedToAdmin;
    private isBotRemovedFromChat;
    private isBotAddedToChat;
    private isBotDemoted;
    getBotStatus(ctx: Context, chatId: number): Promise<string | null>;
    hasBotAdminPermissions(ctx: Context, chatId: number): Promise<boolean>;
}
//# sourceMappingURL=BotStatusHandler.d.ts.map