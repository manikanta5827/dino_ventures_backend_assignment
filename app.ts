import { Hono } from "hono";
import { Prisma } from "./generated/prisma/client";
import routes from "./src/routes";

// @ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

// @ts-ignore
Prisma.Decimal.prototype.toJSON = function () {
    return this.toString();
};

const app = new Hono();

app.route("/", routes);

const PORT = Number(process.env.PORT) || 8080;

export default {
    port: PORT,
    fetch: app.fetch,
};