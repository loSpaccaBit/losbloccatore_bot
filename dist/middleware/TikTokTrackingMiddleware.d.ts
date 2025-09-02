import { Context } from 'telegraf';
export declare class TikTokTrackingMiddleware {
    static createTikTokTrackingMiddleware(): (ctx: Context, next: () => Promise<void>) => Promise<void>;
    static createTikTokInteractionMiddleware(): (ctx: Context, next: () => Promise<void>) => Promise<void>;
}
//# sourceMappingURL=TikTokTrackingMiddleware.d.ts.map