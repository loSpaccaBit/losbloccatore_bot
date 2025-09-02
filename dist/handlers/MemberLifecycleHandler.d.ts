import { Context } from 'telegraf';
import { TelegramService } from '../services/TelegramService';
import { UserActivityService } from '../services/UserActivityService';
import { ContestService } from '../services/ContestService';
export declare class MemberLifecycleHandler {
    private telegramService;
    private userActivityService;
    private contestService;
    constructor(telegramService: TelegramService, userActivityService: UserActivityService, contestService: ContestService);
    handleChatMemberUpdate(ctx: Context): Promise<void>;
    handleLeftChatMember(ctx: Context): Promise<void>;
    private processMemberStatusChange;
    private handleUserLeave;
    private handleUserJoinViaMemberUpdate;
    private processLegacyUserLeave;
    private sendGoodbyeMessage;
    private isAuthorizedChannel;
}
//# sourceMappingURL=MemberLifecycleHandler.d.ts.map