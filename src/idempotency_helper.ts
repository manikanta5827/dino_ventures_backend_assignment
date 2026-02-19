import { prisma } from "./db_config";
import type { Context, Next } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import crypto from "crypto";

enum IdempotencyStatus {
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}

const IDEMPOTENCY_CONFIG = {
  inProgressTTL: 300, // storing for 5 minutes
  completedTTL: 86400, // storing for 1 day
};

function computePayloadHash(payload: any): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export async function idempotencyMiddleware(c: Context, next: Next) {
  const method = c.req.method;
  const path = c.req.path;

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return next();
  }

  const { userId, idempotencyKey, ...restPayload } = body;

  // if idempotency key does not exist then continue
  if (!idempotencyKey) {
    c.set("requestBody", body);
    return next();
  }

  if (!userId) {
    return c.json({ status: "error", message: "userId required" }, 400);
  }

  const payloadHash = computePayloadHash(body);
  const now = new Date();
  const inProgressUntil = new Date(now.getTime() + IDEMPOTENCY_CONFIG.inProgressTTL * 1000);
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_CONFIG.completedTTL * 1000);

  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: {
        userId_method_path_idempotencyKey: {
          userId,
          method,
          path,
          idempotencyKey,
        },
      },
    });

    // if idempotency key does not exist then create it
    if (!existing) {
      await prisma.idempotencyKey.create({
        data: {
          userId,
          method,
          path,
          idempotencyKey,
          status: IdempotencyStatus.IN_PROGRESS,
          payloadHash,
          inProgressUntil,
          expiresAt,
        },
      });

      c.set("requestBody", body);
      c.set("idempotency", { userId, method, path, idempotencyKey });

      return next();
    }

    // if idempotency key is expired then delete it and create a new one
    if (existing.expiresAt < now) {
      await prisma.idempotencyKey.delete({ where: { userId_method_path_idempotencyKey: { userId, method, path, idempotencyKey } } });
      await prisma.idempotencyKey.create({
        data: {
          userId,
          method,
          path,
          idempotencyKey,
          status: IdempotencyStatus.IN_PROGRESS,
          payloadHash,
          inProgressUntil,
          expiresAt,
        },
      });

      c.set("requestBody", body);
      c.set("idempotency", { userId, method, path, idempotencyKey });

      return next();
    }

    // if payload hash is different, return error
    if (existing.payloadHash !== payloadHash) {
      return c.json(
        { status: "error", message: "Idempotency key reused with different payload" },
        409
      );
    }

    // if request is in progress and inProgressUntil is not expired
    if (existing.status === IdempotencyStatus.IN_PROGRESS && existing.inProgressUntil > now) {
      return c.json(
        { status: "error", message: "Request already in progress, please retry later" },
        409
      );
    }

    // if request is in progress but inProgressUntil is expired
    if (existing.status === IdempotencyStatus.IN_PROGRESS && existing.inProgressUntil <= now) {
      await prisma.idempotencyKey.update({
        where: { userId_method_path_idempotencyKey: { userId, method, path, idempotencyKey } },
        data: { inProgressUntil: new Date(now.getTime() + IDEMPOTENCY_CONFIG.inProgressTTL * 1000) },
      });

      c.set("requestBody", body);
      c.set("idempotency", { userId, method, path, idempotencyKey });

      return next();
    }

    // if request is completed, return cached response
    if (existing.status === IdempotencyStatus.COMPLETED) {
      const cachedResponse = existing.responseBody ? JSON.parse(existing.responseBody) : {};
      return c.json(cachedResponse, (existing.responseStatus || 200) as ContentfulStatusCode);
    }

  } catch (error: any) {
    console.error("Idempotency middleware error:", error);
    throw error;
  }
}

export async function idempotencyResponseHook(c: Context, next: Next) {
  await next();

  const idempotency = c.get("idempotency");
  if (!idempotency) return;

  const { userId, method, path, idempotencyKey } = idempotency;
  const response = c.res;
  const status = response.status;

  if (status >= 200 && status < 300) {
    try {
      const clonedResponse = response.clone();
      const responseBody = await clonedResponse.json();

      await prisma.idempotencyKey.update({
        where: {
          userId_method_path_idempotencyKey: {
            userId,
            method,
            path,
            idempotencyKey,
          },
        },
        data: {
          status: IdempotencyStatus.COMPLETED,
          responseStatus: status,
          responseBody: JSON.stringify(responseBody),
        },
      });
    } catch (error) {
      console.error("Failed to save idempotency response:", error);
    }
  }
  else if (status >= 400) {
    try {
      await prisma.idempotencyKey.delete({
        where: {
          userId_method_path_idempotencyKey: {
            userId,
            method,
            path,
            idempotencyKey,
          },
        },
      });
    } catch (error) {
      console.error("Failed to cleanup idempotency:", error);
    }
  }
}