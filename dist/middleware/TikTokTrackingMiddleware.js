"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikTokTrackingMiddleware = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const TikTokService_1 = __importDefault(require("../services/TikTokService"));
class TikTokTrackingMiddleware {
    static createTikTokTrackingMiddleware() {
        return async (ctx, next) => {
            try {
                if ('message' in ctx.update && 'text' in ctx.update.message) {
                    const message = ctx.update.message;
                    const userId = message.from?.id;
                    const userName = message.from?.first_name || 'User';
                    const text = message.text;
                    if (userId && text) {
                        const tiktokUrl = TikTokService_1.default.extractTikTokUrl(text);
                        if (tiktokUrl) {
                            logger_1.default.info('TikTok link detected in message', {
                                userId,
                                userName,
                                chatId: message.chat.id,
                                chatType: message.chat.type,
                                tiktokUrl,
                                messageId: message.message_id,
                                timestamp: new Date(message.date * 1000).toISOString()
                            });
                            logger_1.default.info('TikTok engagement tracked', {
                                event: 'tiktok_link_shared',
                                userId,
                                userName,
                                url: tiktokUrl,
                                source: message.chat.type === 'private' ? 'private_chat' : 'group_chat'
                            });
                        }
                    }
                }
                if ('callback_query' in ctx.update) {
                    const callbackQuery = ctx.update.callback_query;
                    const userId = callbackQuery.from.id;
                    const userName = callbackQuery.from.first_name || 'User';
                    if ('data' in callbackQuery && callbackQuery.data && callbackQuery.data.includes('tiktok')) {
                        logger_1.default.info('TikTok related callback query', {
                            userId,
                            userName,
                            callbackData: callbackQuery.data,
                            messageId: callbackQuery.message?.message_id,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                await next();
            }
            catch (error) {
                logger_1.default.error('Error in TikTok tracking middleware', error, {
                    updateType: ctx.updateType,
                    updateId: ctx.update?.update_id
                });
                await next();
            }
        };
    }
    static createTikTokInteractionMiddleware() {
        return async (ctx, next) => {
            try {
                const startTime = Date.now();
                await next();
                const duration = Date.now() - startTime;
                if (duration > 1000 && 'message' in ctx.update) {
                    const message = ctx.update.message;
                    if ('text' in message && message.text) {
                        const tiktokUrl = TikTokService_1.default.extractTikTokUrl(message.text);
                        if (tiktokUrl) {
                            logger_1.default.info('TikTok message processing completed', {
                                userId: message.from?.id,
                                userName: message.from?.first_name,
                                processingDuration: duration,
                                tiktokUrl,
                                wasProcessed: true
                            });
                        }
                    }
                }
            }
            catch (error) {
                logger_1.default.error('Error in TikTok interaction middleware', error, {
                    updateType: ctx.updateType
                });
                throw error;
            }
        };
    }
}
exports.TikTokTrackingMiddleware = TikTokTrackingMiddleware;
//# sourceMappingURL=TikTokTrackingMiddleware.js.map