import { Context } from 'telegraf';
import { TelegramService } from '../services/TelegramService';
import { ContestService } from '../services/ContestService';
export declare class CommandHandler {
    private telegramService;
    private contestService;
    constructor(telegramService: TelegramService, contestService: ContestService);
    handleStartCommand(ctx: Context): Promise<void>;
    handleClassificaCommand(ctx: Context): Promise<void>;
    handleHelpCommand(ctx: Context): Promise<void>;
    handleLinkCommand(ctx: Context): Promise<void>;
    private extractReferralCodeFromStart;
    private sendStartCommandResponse;
    private sendPersonalStatistics;
    private sendReferralLinkInfo;
    private sendMarkdownMessage;
    private sendFallbackHelpMessage;
    private handleCommandError;
}
//# sourceMappingURL=CommandHandler.d.ts.map