# Architecture & Database Schema

This document explains how the system is designed and how the data is structured.

## 1. Design Choices

### Tech Stack
- **Bun:** High-performance runtime for fast async I/O.
- **Postgres & Prisma:** Reliable database with type-safe queries and easy migrations.

### Preventing Deadlocks
To avoid circular wait conditions, I implemented **Ordered Locking**. Every transaction always acquires locks in the same order:
1. **Treasury account** first.
2. **User account** second.
This ensures requests queue up instead of getting stuck.

### Idempotency (Safe Retries)
Ensures duplicate requests don't result in duplicate charges.
- **`inProgressUntil`:** Handles crashed requests. If a request stays "pending," this timeout allows a new attempt to take over.
- **`expiresAt`:** Automatically cleans up old cached responses.
- **Payload Safety:** If the request data changes but the key is the same, the system returns a `409 Conflict`.

### Immutable Ledger
Instead of just updating a balance, we use a double-entry system:
- Every transaction creates two records (debit and credit) sharing a `transactionId`.
- **Database Triggers:** Prevent any updates or deletes on the ledger table. Once written, it's permanent.

---

## 2. Database Schema

### Users (`users`)
| Field | What it is |
| :--- | :--- |
| `id` | Unique ID. |
| `name` | User's name. |
| `email` | Unique identifier. |
| `isSystem` | True for Treasury, False for users. |
| `createdAt` | When the account was created. |

### Asset Types (`asset_types`)
| Field | What it is |
| :--- | :--- |
| `id` | Unique ID. |
| `name` | e.g., "Gold Coins". |
| `description` | Notes on usage. |
| `createdAt` | When added. |

### Wallets (`wallets`)
| Field | What it is |
| :--- | :--- |
| `userId` | Owner. |
| `assetTypeId` | Currency type. |
| `balance` | Current total. |
| `updatedAt` | Last change. |

### Audit Ledger (`audit_ledger`)
| Field | What it is |
| :--- | :--- |
| `transactionId` | Links both sides of a move. |
| `userId` | Whose balance changed. |
| `entryType` | `credit` or `debit`. |
| `amount` | Value moved. |
| `createdAt` | Exact timestamp. |

### Idempotency Keys (`idempotency_keys`)
| Field | What it is |
| :--- | :--- |
| `idempotencyKey` | Unique key from frontend. |
| `status` | `IN_PROGRESS` or `COMPLETED`. |
| `responseBody` | Cached result. |
| `inProgressUntil` | Timeout for stuck requests. |
| `expiresAt` | Cleanup timestamp. |
