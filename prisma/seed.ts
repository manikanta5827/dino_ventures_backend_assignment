import { prisma } from "../src/db_config";

async function main() {

    // creating users
    await prisma.user.createMany({
        data: [
            { email: "treasury@test.com", name: "Treasury", isSystem: true },
            { email: "userx@test.com", name: "userx" },
            { email: "usery@test.com", name: "usery" },
        ]
    });

    // creating asset types like gold, diamond
    await prisma.assetType.createMany({
        data: [
            { name: "Gold Coins", description: "Gold coin asset" },
            { name: "Diamonds", description: "Diamond asset" },
            { name: "Loyalty Points", description: "Loyalty points" }
        ]
    });

    // adding system accounts and user accounts
    await prisma.wallet.createMany({
        data: [
            { userId: 1, assetTypeId: 1, balance: 1000000 },
            { userId: 1, assetTypeId: 2, balance: 1000000 },
            { userId: 1, assetTypeId: 3, balance: 1000000 },

            { userId: 2, assetTypeId: 1, balance: 1000 },
            { userId: 2, assetTypeId: 2, balance: 1000 },
            { userId: 2, assetTypeId: 3, balance: 1000 },

            { userId: 3, assetTypeId: 1, balance: 100 },
            { userId: 3, assetTypeId: 2, balance: 1000 },
            { userId: 3, assetTypeId: 3, balance: 100 },
        ]
    });

    // creating audit ledger records
    const transactionId = Bun.randomUUIDv7();
    await prisma.auditLedger.createMany({
        data: [
            { transactionId: transactionId, userId: 1, assetTypeId: 1, entryType: "credit", amount: 1000000, description: "Initial balance" },
            { transactionId: transactionId, userId: 1, assetTypeId: 2, entryType: "credit", amount: 1000000, description: "Initial balance" },
            { transactionId: transactionId, userId: 1, assetTypeId: 3, entryType: "credit", amount: 1000000, description: "Initial balance" },

            { transactionId: transactionId, userId: 2, assetTypeId: 1, entryType: "credit", amount: 1000, description: "Initial balance" },
            { transactionId: transactionId, userId: 2, assetTypeId: 2, entryType: "credit", amount: 1000, description: "Initial balance" },
            { transactionId: transactionId, userId: 2, assetTypeId: 3, entryType: "credit", amount: 1000, description: "Initial balance" },

            { transactionId: transactionId, userId: 3, assetTypeId: 1, entryType: "credit", amount: 100, description: "Initial balance" },
            { transactionId: transactionId, userId: 3, assetTypeId: 2, entryType: "credit", amount: 1000, description: "Initial balance" },
            { transactionId: transactionId, userId: 3, assetTypeId: 3, entryType: "credit", amount: 100, description: "Initial balance" },
        ]
    });

    console.log("Seed inserted");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
