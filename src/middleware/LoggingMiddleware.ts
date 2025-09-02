import { Context, MiddlewareFn } from 'telegraf';
import logger from '../utils/logger';

export class LoggingMiddleware {
  static createRequestLoggingMiddleware(): MiddlewareFn<Context> {
    return async (ctx: Context, next) => {
      const startTime = Date.now();
      
      // Extract request information
      const requestInfo = {
        updateId: ctx.update.update_id,
        updateType: ctx.updateType,
        chatId: ctx.chat?.id,
        chatType: ctx.chat?.type,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        messageId: 'message' in ctx.update ? ctx.update.message?.message_id : undefined,
        callbackQueryId: 'callback_query' in ctx.update ? ctx.update.callback_query?.id : undefined
      };

      logger.info('Incoming Telegram update', requestInfo);

      try {
        await next();
        
        const duration = Date.now() - startTime;
        
        logger.info('Request processed successfully', {
          ...requestInfo,
          duration,
          success: true
        });
        
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error('Request processing failed', error as Error, {
          ...requestInfo,
          duration,
          success: false
        });
        
        throw error; // Re-throw to let error handler middleware catch it
      }
    };
  }

  static createDetailedLoggingMiddleware(): MiddlewareFn<Context> {
    return async (ctx: Context, next) => {
      const startTime = Date.now();
      
      // Log detailed information based on update type
      switch (ctx.updateType) {
        case 'chat_join_request':
          if ('chat_join_request' in ctx.update) {
            const joinRequest = ctx.update.chat_join_request;
            logger.info('Chat join request received', {
              userId: joinRequest.from.id,
              username: joinRequest.from.username,
              firstName: joinRequest.from.first_name,
              chatId: joinRequest.chat.id,
              chatTitle: joinRequest.chat.title,
              date: new Date(joinRequest.date * 1000).toISOString()
            });
          }
          break;

        case 'chat_member':
          if ('chat_member' in ctx.update) {
            const memberUpdate = ctx.update.chat_member;
            logger.info('Chat member status changed', {
              userId: memberUpdate.new_chat_member.user.id,
              username: memberUpdate.new_chat_member.user.username,
              firstName: memberUpdate.new_chat_member.user.first_name,
              chatId: memberUpdate.chat.id,
              chatTitle: 'title' in memberUpdate.chat ? memberUpdate.chat.title : 'Unknown',
              oldStatus: memberUpdate.old_chat_member.status,
              newStatus: memberUpdate.new_chat_member.status,
              date: new Date(memberUpdate.date * 1000).toISOString()
            });
          }
          break;

        default:
          // Handle left_chat_member and new_chat_members in message updates  
          if ('message' in ctx.update) {
            const message = ctx.update.message;
            
            if ('left_chat_member' in message && message.left_chat_member) {
              const leftMember = (message as any).left_chat_member;
              logger.info('User left chat', {
                userId: leftMember.id,
                username: leftMember.username,
                firstName: leftMember.first_name,
                chatId: message.chat.id,
                chatTitle: 'title' in message.chat ? message.chat.title : undefined,
                date: new Date(message.date * 1000).toISOString()
              });
            }
            
            if ('new_chat_members' in message && (message as any).new_chat_members) {
              const newMembers = (message as any).new_chat_members;
              logger.info('New members joined chat', {
                newMembers: newMembers.map((member: any) => ({
                  userId: member.id,
                  username: member.username,
                  firstName: member.first_name,
                  isBot: member.is_bot
                })),
                chatId: message.chat.id,
                chatTitle: 'title' in message.chat ? message.chat.title : undefined,
                date: new Date(message.date * 1000).toISOString()
              });
            }
          }
          break;

        case 'message':
          if ('message' in ctx.update) {
            const message = ctx.update.message;
            logger.debug('Message received', {
              messageId: message.message_id,
              userId: message.from?.id,
              username: message.from?.username,
              chatId: message.chat.id,
              chatType: message.chat.type,
              text: 'text' in message ? message.text?.substring(0, 100) + (message.text && message.text.length > 100 ? '...' : '') : undefined,
              hasPhoto: !!(message as any).photo,
              hasDocument: !!(message as any).document,
              hasVideo: !!(message as any).video,
              date: new Date(message.date * 1000).toISOString()
            });
          }
          break;

        case 'callback_query':
          if ('callback_query' in ctx.update) {
            const callbackQuery = ctx.update.callback_query;
            logger.debug('Callback query received', {
              callbackQueryId: callbackQuery.id,
              userId: callbackQuery.from.id,
              username: callbackQuery.from.username,
              data: 'data' in callbackQuery ? callbackQuery.data : undefined,
              messageId: callbackQuery.message ? 'message_id' in callbackQuery.message ? callbackQuery.message.message_id : undefined : undefined,
              chatId: callbackQuery.message ? callbackQuery.message.chat?.id : undefined
            });
          }
          break;

          // Other update types
          logger.debug('Other update type received', {
            updateType: ctx.updateType,
            updateId: ctx.update.update_id
          });
      }

      await next();

      const duration = Date.now() - startTime;
      logger.debug('Update processing completed', {
        updateId: ctx.update.update_id,
        updateType: ctx.updateType,
        duration
      });
    };
  }

  static createPerformanceLoggingMiddleware(slowThreshold: number = 1000): MiddlewareFn<Context> {
    return async (ctx: Context, next) => {
      const startTime = Date.now();
      
      await next();
      
      const duration = Date.now() - startTime;
      
      if (duration > slowThreshold) {
        logger.warn('Slow request detected', {
          updateId: ctx.update.update_id,
          updateType: ctx.updateType,
          duration,
          threshold: slowThreshold,
          userId: ctx.from?.id,
          chatId: ctx.chat?.id
        });
      } else {
        logger.debug('Request performance', {
          updateId: ctx.update.update_id,
          updateType: ctx.updateType,
          duration
        });
      }
    };
  }

  static createSecurityLoggingMiddleware(): MiddlewareFn<Context> {
    return async (ctx: Context, next) => {
      // Log potential security concerns
      const securityInfo: any = {
        updateId: ctx.update.update_id,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        chatId: ctx.chat?.id,
        chatType: ctx.chat?.type
      };

      // Check for suspicious patterns
      if ('message' in ctx.update && 'text' in ctx.update.message && ctx.update.message.text) {
        const text = ctx.update.message.text;
        
        // Check for potential spam patterns
        if (text.length > 1000) {
          logger.warn('Long message detected', {
            ...securityInfo,
            messageLength: text.length,
            messageId: ctx.update.message.message_id
          });
        }

        // Check for URLs
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        const urls = text.match(urlPattern);
        if (urls) {
          logger.info('Message contains URLs', {
            ...securityInfo,
            urls,
            messageId: ctx.update.message.message_id
          });
        }

        // Check for mentions
        const mentionPattern = /@\w+/g;
        const mentions = text.match(mentionPattern);
        if (mentions) {
          logger.debug('Message contains mentions', {
            ...securityInfo,
            mentions,
            messageId: ctx.update.message.message_id
          });
        }
      }

      // Log first-time users
      if (ctx.from && !ctx.from.username) {
        logger.info('User without username', {
          ...securityInfo,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name
        });
      }

      // Log admin actions
      if ('chat_member' in ctx.update) {
        const memberUpdate = ctx.update.chat_member;
        if (['administrator', 'creator'].includes(memberUpdate.new_chat_member.status)) {
          logger.info('Admin status change detected', {
            ...securityInfo,
            targetUserId: memberUpdate.new_chat_member.user.id,
            targetUsername: memberUpdate.new_chat_member.user.username,
            oldStatus: memberUpdate.old_chat_member.status,
            newStatus: memberUpdate.new_chat_member.status
          });
        }
      }

      await next();
    };
  }
}

export default LoggingMiddleware;