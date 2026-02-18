import { prisma } from "./db_config";
import type { User, AssetType, Wallet, AuditLedger, EntryType } from "../generated/prisma/client";

export async function createUser(name: string, email: string, isSystem: boolean = false): Promise<User> {
    try {
        const user = await prisma.user.create({
            data: {
                name,
                email,
                isSystem,
            },
        });
        return user;
    } catch (error) {
        console.error("Error creating user:", error);
        throw new Error("Could not create user.");
    }
}

export async function createAssetType(
    name: string,
    description: string | null = null,
    isActive: boolean = true
): Promise<AssetType> {
    try {
        const assetType = await prisma.assetType.create({
            data: {
                name,
                description,
                isActive,
            },
        });
        return assetType;
    } catch (error) {
        console.error("Error creating asset type:", error);
        throw new Error("Could not create asset type.");
    }
}

export async function createWallet(userId: number, assetTypeId: number): Promise<Wallet> {
    try {
        const wallet = await prisma.wallet.create({
            data: {
                userId,
                assetTypeId,
                balance: 0,
            },
        });
        return wallet;
    } catch (error) {
        console.error("Error creating wallet:", error);
        throw new Error("Could not create wallet.");
    }
}

export async function createAuditLedgerEntry(
    transactionId: string,
    userId: number,
    assetTypeId: number,
    entryType: EntryType,
    amount: number,
    description: string | null = null
): Promise<AuditLedger> {
    try {
        const auditLedgerEntry = await prisma.auditLedger.create({
            data: {
                transactionId,
                userId,
                assetTypeId,
                entryType,
                amount,
                description,
            },
        });
        return auditLedgerEntry;
    } catch (error) {
        console.error("Error creating audit ledger entry:", error);
        throw new Error("Could not create audit ledger entry.");
    }
}
