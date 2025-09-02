import { Context } from 'telegraf';
import { TelegramService } from '../services/TelegramService';
import { UserActivityService } from '../services/UserActivityService';
import { ContestService } from '../services/ContestService';
export declare class JoinRequestHandler {
    private telegramService;
    private userActivityService;
    private contestService;
    constructor(telegramService: TelegramService, userActivityService: UserActivityService, contestService: ContestService);
    handleChatJoinRequest(ctx: Context): Promise<void>;
    private processJoinRequest;
    private handleSuccessfulApproval;
    private handleFailedApproval;
    private sendWelcomeMessage;
    private handleJoinRequestError;
    private isAuthorizedChannel;
    private extractReferralCodeFromInviteLink;
}
//# sourceMappingURL=JoinRequestHandler.d.ts.map