import { Context, MiddlewareFn } from 'telegraf';
export declare class LoggingMiddleware {
    static createRequestLoggingMiddleware(): MiddlewareFn<Context>;
    static createDetailedLoggingMiddleware(): MiddlewareFn<Context>;
    static createPerformanceLoggingMiddleware(slowThreshold?: number): MiddlewareFn<Context>;
    static createSecurityLoggingMiddleware(): MiddlewareFn<Context>;
}
export default LoggingMiddleware;
//# sourceMappingURL=LoggingMiddleware.d.ts.map