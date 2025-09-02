import { TelegramCoreService } from './TelegramCoreService';
export declare class TelegramChatService {
    private coreService;
    constructor(coreService: TelegramCoreService);
    approveChatJoinRequest(chatId: number, userId: number): Promise<boolean>;
    declineChatJoinRequest(chatId: number, userId: number): Promise<boolean>;
    getChatMemberCount(chatId: number): Promise<number>;
    getChatInfo(chatId: number): Promise<any | null>;
    getChatMember(chatId: number, userId: number): Promise<any | null>;
    isUserMemberOfChat(chatId: number, userId: number): Promise<boolean>;
    getChatAdministrators(chatId: number): Promise<any[]>;
    isUserAdminOfChat(chatId: number, userId: number): Promise<boolean>;
    banChatMember(chatId: number, userId: number, untilDate?: number): Promise<boolean>;
    unbanChatMember(chatId: number, userId: number): Promise<boolean>;
}
//# sourceMappingURL=TelegramChatService.d.ts.map