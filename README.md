# Dino Ventures Backend

A high-performance credit management system built with Bun, Hono, and Prisma.

## 🚀 Main Features

- **Purchase Credits:** Validates treasury funds and moves assets to the user.
- **Spend Credits:** Validates user funds and returns assets to the treasury.
- **Issue Bonus:** Adds loyalty points to user accounts from the treasury.
- **Balance & History:** Real-time balance tracking and full audit trails.

## 🛡️ Technical Safeguards

- **Deadlock Prevention:** Uses Ordered Locking (Treasury then User) to prevent circular waits.
- **Idempotency:** Custom middleware to handle retries safely using `inProgressUntil` and `expiresAt`.
- **Immutable Ledger:** Database triggers prevent any modifications to transaction history.
- **High-Concurrency:** Tested to handle **500+ requests/sec** with **~185ms** latency.
- **Cloud-Deployed-Url:** [cloud_link](https://dino-ventures-backend-assignment.onrender.com)

---

## 🛠️ Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed.
- PostgreSQL database.

### Setup

1. **Env Setup:** Create a `.env` file (see `.env.example`).
2. **Install:** `bun install`
3. **Database:**
    ```bash
    bun run db:generate
    bun run db:migrate
    bun run db:seed
    ```
4. **Run:**
    - Dev: `bun run dev`
    - Prod: `bun start`

### Docker

```bash
docker-compose up --build
```

---

## 📖 Documentation Reference

- **[API Reference](./Docs/API.md)**: Endpoints and payloads.
- **[Architecture & Schema](./Docs/ARCHITECTURE.md)**: Design choices and DB structure.
- **[Benchmarks](./Docs/BENCHMARKS.md)**: Full load test results.
