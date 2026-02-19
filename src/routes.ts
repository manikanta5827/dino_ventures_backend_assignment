import { Hono } from "hono";
import { prisma } from "./db_config";
import { Prisma } from "../generated/prisma/client";
import { logger } from "hono/logger";
import { idempotencyMiddleware, idempotencyResponseHook } from "./idempotency_helper";

type Variables = {
    requestBody: any;
    idempotency: {
        userId: number;
        method: string;
        path: string;
        idempotencyKey: string;
    };
};

const app = new Hono<{ Variables: Variables }>();

const TREASURY_ACCOUNT_ID = 1;
const BONUS_ASSET_TYPE_ID = 3;

enum EntryType {
    CREDIT = "credit",
    DEBIT = "debit",
}

// idempotency middleware globally
app.use(logger());
app.use("*", idempotencyMiddleware);
app.use("*", idempotencyResponseHook);

// health check
app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// purchase credits handler
app.post("/purchase-credits", async (c) => {
    try {
        const body = c.get("requestBody");
        const { userId, amount, assetTypeId } = body;

        // validating payload
        if (!userId || !amount || !assetTypeId) {
            return c.json({ status: "error", message: "Missing required fields: userId, amount, assetTypeId" }, 400);
        }

        if (amount <= 0) {
            return c.json({ status: "error", message: "Amount must be greater than 0" }, 400);
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return c.json({ status: "error", message: "User not found" }, 404);
        if (user.isSystem) return c.json({ status: "error", message: "System accounts cannot purchase credits" }, 400);

        const assetType = await prisma.assetType.findUnique({ where: { id: assetTypeId } });
        if (!assetType) return c.json({ status: "error", message: "Asset type not found" }, 404);
        if (assetTypeId === BONUS_ASSET_TYPE_ID) {
            return c.json({ status: "error", message: "Loyalty points cannot be purchased" }, 400);
        }

        // transaction logic
        const result = await prisma.$transaction(async (tx) => {

            // locking rows
            await tx.$executeRaw`
            SELECT * FROM wallets 
            WHERE user_id = ${TREASURY_ACCOUNT_ID} AND asset_type_id = ${assetTypeId} 
            FOR UPDATE
        `;
            await tx.$executeRaw`
            SELECT * FROM wallets 
            WHERE user_id = ${userId} AND asset_type_id = ${assetTypeId} 
            FOR UPDATE
        `;

            // check treasury balance
            const treasuryWallet = await tx.wallet.findUnique({
                where: { userId_assetTypeId: { userId: TREASURY_ACCOUNT_ID, assetTypeId } },
            });

            if (!treasuryWallet || treasuryWallet.balance < amount) {
                throw new Error("Treasury has insufficient funds");
            }

            // debit treasury
            await tx.wallet.update({
                where: { userId_assetTypeId: { userId: TREASURY_ACCOUNT_ID, assetTypeId } },
                data: { balance: { decrement: amount } },
            });

            // credit user
            const wallet = await tx.wallet.upsert({
                where: { userId_assetTypeId: { userId, assetTypeId } },
                update: { balance: { increment: amount } },
                create: { userId, assetTypeId, balance: amount },
            });

            // create ledger entries
            const transactionId = Bun.randomUUIDv7();

            await tx.auditLedger.create({
                data: {
                    transactionId,
                    userId: TREASURY_ACCOUNT_ID,
                    assetTypeId,
                    entryType: EntryType.DEBIT,
                    amount: new Prisma.Decimal(amount),
                    description: `Purchase by user ${userId}`,
                },
            });

            await tx.auditLedger.create({
                data: {
                    transactionId,
                    userId,
                    assetTypeId,
                    entryType: EntryType.CREDIT,
                    amount: new Prisma.Decimal(amount),
                    description: "Purchased credits",
                },
            });

            return { wallet, transactionId };
        });

        return c.json({ status: "success", data: result }, 200);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error in /purchase-credits:", errorMessage);
        return c.json({ status: "failed", message: "Internal server error" }, 500);
    }
});

// spend credits handler
app.post("/spend-credits", async (c) => {
    try {
        const body = c.get("requestBody");
        const { userId, amount, assetTypeId } = body;

        if (!userId || !amount || !assetTypeId) {
            return c.json({ status: "error", message: "Missing required fields: userId, amount, assetTypeId" }, 400);
        }

        if (amount <= 0) {
            return c.json({ status: "error", message: "Amount must be greater than 0" }, 400);
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return c.json({ status: "error", message: "User not found" }, 404);
        if (user.isSystem) return c.json({ status: "error", message: "System accounts cannot spend credits" }, 400);

        const assetType = await prisma.assetType.findUnique({ where: { id: assetTypeId } });
        if (!assetType) return c.json({ status: "error", message: "Asset type not found" }, 404);
        if (assetTypeId === BONUS_ASSET_TYPE_ID) {
            return c.json({ status: "error", message: "Loyalty points cannot be spend" }, 400);
        }

        const result = await prisma.$transaction(async (tx) => {
            // locking rows
            await tx.$executeRaw`
            SELECT * FROM wallets 
            WHERE user_id = ${TREASURY_ACCOUNT_ID} AND asset_type_id = ${assetTypeId} 
            FOR UPDATE
        `;
            await tx.$executeRaw`
            SELECT * FROM wallets 
            WHERE user_id = ${userId} AND asset_type_id = ${assetTypeId} 
            FOR UPDATE
        `;

            const userWallet = await tx.wallet.findUnique({
                where: { userId_assetTypeId: { userId, assetTypeId } },
            });

            if (!userWallet || userWallet.balance < amount) {
                throw new Error("User has insufficient credits");
            }

            // debit user
            const wallet = await tx.wallet.update({
                where: { userId_assetTypeId: { userId, assetTypeId } },
                data: { balance: { decrement: amount } },
            });

            // credit treasury
            await tx.wallet.update({
                where: { userId_assetTypeId: { userId: TREASURY_ACCOUNT_ID, assetTypeId } },
                data: { balance: { increment: amount } },
            });

            // create ledger entries
            const transactionId = Bun.randomUUIDv7();

            await tx.auditLedger.create({
                data: {
                    transactionId,
                    userId,
                    assetTypeId,
                    entryType: EntryType.DEBIT,
                    amount: new Prisma.Decimal(amount),
                    description: "Spent credits",
                },
            });

            await tx.auditLedger.create({
                data: {
                    transactionId,
                    userId: TREASURY_ACCOUNT_ID,
                    assetTypeId,
                    entryType: EntryType.CREDIT,
                    amount: new Prisma.Decimal(amount),
                    description: `Received from user ${userId}`,
                },
            });

            return { wallet, transactionId };
        });

        return c.json({ status: "success", data: result }, 200);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error in /spend-credits:", errorMessage);
        return c.json({ status: "failed", message: "Internal server error" }, 500);
    }
});

// bonus credits handler
app.post("/bonus", async (c) => {
    try {
        const body = c.get("requestBody");
        const { userId, amount } = body;

        if (!userId || !amount) {
            return c.json({ status: "error", message: "Missing required fields: userId, amount" }, 400);
        }

        if (amount <= 0) {
            return c.json({ status: "error", message: "Amount must be greater than 0" }, 400);
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return c.json({ status: "error", message: "User not found" }, 404);
        if (user.isSystem) return c.json({ status: "error", message: "System accounts cannot receive bonuses" }, 400);

        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`
            SELECT * FROM wallets 
            WHERE user_id = ${TREASURY_ACCOUNT_ID} AND asset_type_id = ${BONUS_ASSET_TYPE_ID} 
            FOR UPDATE
        `;
            await tx.$executeRaw`
            SELECT * FROM wallets 
            WHERE user_id = ${userId} AND asset_type_id = ${BONUS_ASSET_TYPE_ID} 
            FOR UPDATE
        `;

            const treasuryWallet = await tx.wallet.findUnique({
                where: { userId_assetTypeId: { userId: TREASURY_ACCOUNT_ID, assetTypeId: BONUS_ASSET_TYPE_ID } },
            });

            if (!treasuryWallet || treasuryWallet.balance < amount) {
                throw new Error("Treasury has insufficient loyalty points for bonus");
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
                    description: `Bonus issued to user ${userId}`,
                },
            });

            await tx.auditLedger.create({
                data: {
                    transactionId,
                    userId,
                    assetTypeId: BONUS_ASSET_TYPE_ID,
                    entryType: EntryType.CREDIT,
                    amount: new Prisma.Decimal(amount),
                    description: "Bonus loyalty points",
                },
            });

            return { wallet, transactionId };
        });

        return c.json({ status: "success", data: result }, 200);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error in /bonus:", errorMessage);
        return c.json({ status: "failed", message: "Internal server error" }, 500);
    }
});

// get balance handler
app.get("/balance", async (c) => {
    try {
        const userId = parseInt(c.req.query("userId") || "");

        if (!userId) {
            return c.json({ status: "error", message: "Missing userId parameter" }, 400);
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return c.json({ status: "error", message: "User not found" }, 404);

        const wallets = await prisma.wallet.findMany({
            where: { userId },
            include: { assetType: true },
        });

        return c.json({
            status: "success",
            data: {
                userId,
                userName: user.name,
                balances: wallets.map((w) => ({
                    assetTypeId: w.assetTypeId,
                    assetTypeName: w.assetType.name,
                    balance: w.balance.toString(),
                })),
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error in /balance:", errorMessage);
        return c.json({ status: "failed", message: "Internal server error" }, 500);
    }
});

// get transaction history handler
app.get("/transaction-history", async (c) => {
    try {
        const userId = parseInt(c.req.query("userId") || "");

        if (!userId) {
            return c.json({ status: "error", message: "Missing userId parameter" }, 400);
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return c.json({ status: "error", message: "User not found" }, 404);

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
        return c.json({ status: "success", data: result }, 200);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error in /transaction-history:", errorMessage);
        return c.json({ status: "failed", message: "Internal server error" }, 500);
    }
});

export default app;