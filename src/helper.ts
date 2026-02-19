import { prisma } from "./db_config";
import { Prisma } from "../generated/prisma/client";

interface CreditRequest {
    userId: number;
    amount: number;
    assetTypeId: number;
}

const TREASURY_ACCOUNT_ID = 1;
const BONUS_ASSET_TYPE_ID = 3;

enum EntryType {
    CREDIT = 'credit',
    DEBIT = 'debit',
}

export const purchaseCredits = async (req: Request): Promise<Response> => {
    try {
        const { userId, amount, assetTypeId } = await req.json() as CreditRequest;

        if (!userId || !amount || !assetTypeId) {
            return Response.json({ status: "error", message: "Missing required fields" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return Response.json({ status: "error", message: "User not found" }, { status: 404 });
        if (userId === TREASURY_ACCOUNT_ID) return Response.json({ status: "error", message: "Treasury cannot purchase" }, { status: 400 });

        const assetType = await prisma.assetType.findUnique({ where: { id: assetTypeId } });
        if (!assetType) return Response.json({ status: "error", message: "Asset type not found" }, { status: 404 });
        if (amount < 0) return Response.json({ status: "error", message: "Invalid amount" }, { status: 400 });
        if (assetTypeId === BONUS_ASSET_TYPE_ID) return Response.json({ status: "error", message: "Loyalty points cannot be purchased" }, { status: 400 });

        const result = await prisma.$transaction(async (tx) => {
            // Locking rows in a consistent order (Treasury then User) to prevent deadlocks
            await tx.$executeRaw`SELECT * FROM wallets WHERE user_id = ${TREASURY_ACCOUNT_ID} AND asset_type_id = ${assetTypeId} FOR UPDATE`;
            await tx.$executeRaw`SELECT * FROM wallets WHERE user_id = ${userId} AND asset_type_id = ${assetTypeId} FOR UPDATE`;

            const treasuryWallet = await tx.wallet.findUnique({
                where: { userId_assetTypeId: { userId: TREASURY_ACCOUNT_ID, assetTypeId } }
            });

            if (!treasuryWallet || treasuryWallet.balance.lt(amount)) {
                throw new Error("Treasury has insufficient funds");
            }

            await tx.wallet.update({
                where: { userId_assetTypeId: { userId: TREASURY_ACCOUNT_ID, assetTypeId } },
                data: { balance: { decrement: amount } },
            });

            const wallet = await tx.wallet.upsert({
                where: { userId_assetTypeId: { userId, assetTypeId } },
                update: { balance: { increment: amount } },
                create: { userId, assetTypeId, balance: amount },
            });

            const transactionId = Bun.randomUUIDv7();
            await tx.auditLedger.create({
                data: {
                    transactionId,
                    userId: TREASURY_ACCOUNT_ID,
                    assetTypeId,
                    entryType: EntryType.DEBIT,
                    amount: new Prisma.Decimal(amount),
                    description: `Debited for user ${userId} purchase`,
                }
            });

            const userLedger = await tx.auditLedger.create({
                data: {
                    transactionId,
                    userId,
                    assetTypeId,
                    entryType: EntryType.CREDIT,
                    amount: new Prisma.Decimal(amount),
                    description: "Purchased credits",
                }
            });

            return { wallet, userLedger };
        });

        return Response.json({ status: "success", data: result }, { status: 200 });
    } catch (error: any) {
        console.error(error);
        return Response.json({ status: "failed", message: error.message || "Internal server error" }, { status: 500 });
    }
};

export const spendCredits = async (req: Request): Promise<Response> => {
    try {
        const { userId, amount, assetTypeId } = await req.json() as CreditRequest;

        if (!userId || !amount || !assetTypeId) {
            return Response.json({ status: "error", message: "Missing required fields" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return Response.json({ status: "error", message: "User not found" }, { status: 404 });
        if (userId === TREASURY_ACCOUNT_ID) return Response.json({ status: "error", message: "Treasury cannot spend" }, { status: 400 });

        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT * FROM wallets WHERE user_id = ${TREASURY_ACCOUNT_ID} AND asset_type_id = ${assetTypeId} FOR UPDATE`;
            await tx.$executeRaw`SELECT * FROM wallets WHERE user_id = ${userId} AND asset_type_id = ${assetTypeId} FOR UPDATE`;

            const userWallet = await tx.wallet.findUnique({
                where: { userId_assetTypeId: { userId, assetTypeId } }
            });

            if (!userWallet || userWallet.balance.lt(amount)) {
                throw new Error("User has insufficient credits");
            }

            const wallet = await tx.wallet.update({
                where: { userId_assetTypeId: { userId, assetTypeId } },
                data: { balance: { decrement: amount } },
            });

            await tx.wallet.update({
                where: { userId_assetTypeId: { userId: TREASURY_ACCOUNT_ID, assetTypeId } },
                data: { balance: { increment: amount } },
            });

            const transactionId = Bun.randomUUIDv7();
            const userLedger = await tx.auditLedger.create({
                data: {
                    transactionId,
                    userId,
                    assetTypeId,
                    entryType: EntryType.DEBIT,
                    amount: new Prisma.Decimal(amount),
                    description: "Spent credits",
                }
            });

            await tx.auditLedger.create({
                data: {
                    transactionId,
                    userId: TREASURY_ACCOUNT_ID,
                    assetTypeId,
                    entryType: EntryType.CREDIT,
                    amount: new Prisma.Decimal(amount),
                    description: `Credits received from user ${userId}`,
                }
            });

            return { wallet, userLedger };
        });

        return Response.json({ status: "success", data: result }, { status: 200 });
    } catch (error: any) {
        console.error(error);
        return Response.json({ status: "failed", message: error.message || "Internal server error" }, { status: 500 });
    }
};

export const bonus = async (req: Request): Promise<Response> => {
    try {
        const { userId, amount } = await req.json() as { userId: number, amount: number };

        if (!userId || !amount) {
            return Response.json({ status: "error", message: "Missing required fields" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return Response.json({ status: "error", message: "User not found" }, { status: 404 });

        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT * FROM wallets WHERE user_id = ${TREASURY_ACCOUNT_ID} AND asset_type_id = ${BONUS_ASSET_TYPE_ID} FOR UPDATE`;
            await tx.$executeRaw`SELECT * FROM wallets WHERE user_id = ${userId} AND asset_type_id = ${BONUS_ASSET_TYPE_ID} FOR UPDATE`;

            const treasuryWallet = await tx.wallet.findUnique({
                where: { userId_assetTypeId: { userId: TREASURY_ACCOUNT_ID, assetTypeId: BONUS_ASSET_TYPE_ID } }
            });

            if (!treasuryWallet || treasuryWallet.balance.lt(amount)) {
                throw new Error("Treasury has insufficient funds for bonus");
            }

            await tx.wallet.update({
                where: { userId_assetTypeId: { userId: TREASURY_ACCOUNT_ID, assetTypeId: BONUS_ASSET_TYPE_ID } },
                data: { balance: { decrement: amount } },
            });

            const wallet = await tx.wallet.upsert({
                where: { userId_assetTypeId: { userId, assetTypeId: BONUS_ASSET_TYPE_ID } },
                update: { balance: { increment: amount } },
                create: { userId, assetTypeId: BONUS_ASSET_TYPE_ID, balance: amount },
            });

            const transactionId = Bun.randomUUIDv7();
            await tx.auditLedger.create({
                data: {
                    transactionId,
                    userId: TREASURY_ACCOUNT_ID,
                    assetTypeId: BONUS_ASSET_TYPE_ID,
                    entryType: EntryType.DEBIT,
                    amount: new Prisma.Decimal(amount),
                    description: `Bonus debited for user ${userId}`,
                }
            });

            const userLedger = await tx.auditLedger.create({
                data: {
                    transactionId,
                    userId,
                    assetTypeId: BONUS_ASSET_TYPE_ID,
                    entryType: EntryType.CREDIT,
                    amount: new Prisma.Decimal(amount),
                    description: "Bonus credits",
                }
            });

            return { wallet, userLedger };
        });

        return Response.json({ status: "success", data: result }, { status: 200 });
    } catch (error: any) {
        console.error(error);
        return Response.json({ status: "failed", message: error.message || "Internal server error" }, { status: 500 });
    }
};

export const getTransactionHistory = async (req: Request): Promise<Response> => {
    try {
        const url = new URL(req.url);

        let userId: number | undefined = url.searchParams.get("userId") ? parseInt(url.searchParams.get("userId")!) : undefined;
        if (!userId) return Response.json({ status: "error", message: "Missing userId" }, { status: 400 });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return Response.json({ status: "error", message: "User not found" }, { status: 404 });

        const query = Prisma.sql`
            WITH user_wallets AS (
                SELECT user_id, asset_type_id, balance 
                FROM wallets 
                WHERE user_id = ${userId}
            ),
            asset_history AS (
                SELECT 
                    al.asset_type_id,
                    json_agg(
                        json_build_object(
                            'id', al.id,
                            'transactionId', al.transaction_id,
                            'entryType', al.entry_type,
                            'amount', al.amount,
                            'description', al.description,
                            'createdAt', al.created_at
                        ) ORDER BY al.created_at DESC, al.id DESC
                    ) as history
                FROM audit_ledger al
                WHERE al.user_id = ${userId}
                GROUP BY al.asset_type_id
            )
            SELECT 
                at.id as "assetTypeId",
                at.name as "assetTypeName",
                uw.balance as "balance",
                COALESCE(ah.history, '[]'::json) as "history"
            FROM asset_types at
            JOIN user_wallets uw ON at.id = uw.asset_type_id
            LEFT JOIN asset_history ah ON at.id = ah.asset_type_id
        `;

        const result = await prisma.$queryRaw(query);
        return Response.json({ status: "success", data: result }, { status: 200 });
    } catch (error: any) {
        console.error(error);
        return Response.json({ status: "failed", message: error.message || "Internal server error" }, { status: 500 });
    }
};
