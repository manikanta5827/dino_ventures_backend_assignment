import { bonus, purchaseCredits, spendCredits, getTransactionHistory } from "./src/helper";
import { Prisma } from "./generated/prisma/client";

// @ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

// @ts-ignore
Prisma.Decimal.prototype.toJSON = function () {
    return this.toString();
};

const PORT = Number(process.env.PORT) ?? 8080;

const server = Bun.serve({
    port: PORT,

    async fetch(req) {
        const url = new URL(req.url);
        const routes: { [key: string]: (req: Request) => Response | Promise<Response> } = {
            "POST /purchase-credits": purchaseCredits,
            "POST /spend-credits": spendCredits,
            "POST /bonus": bonus,
            "GET /transaction-history": getTransactionHistory,
        };

        const key = `${req.method} ${url.pathname}`;
        const handler = routes[key];

        return handler
            ? handler(req)
            : new Response("Not found", { status: 404 });
        },
    });

console.log(`server running on ${server.url}`)
