import { PrismaClient } from '@prisma/client';
declare class DatabaseConnection {
    private prisma;
    initialize(): Promise<PrismaClient>;
    close(): Promise<void>;
    getPrisma(): PrismaClient;
    checkConnection(): Promise<boolean>;
}
declare const _default: DatabaseConnection;
export default _default;
//# sourceMappingURL=connection.d.ts.map