# Design Choices

This document explains why I chose this tech stack and how the system handles tricky problems like deadlocks and duplicates.

## 1. Tech Stack

- **Bun:** I chose Bun because I am familiar with it and it’s an incredibly fast, async, non-blocking I/O runtime. It makes the API very responsive.
- **Postgres & Prisma:** Postgres is the industry standard for data integrity. I used Prisma to write safe queries and manage database migrations easily without the risk of breaking things.

## 2. Concurrency & Deadlock Prevention

Deadlocks happen in edge cases—for example, if a user hits the "Purchase" and "Spend" APIs at the exact same time. One request might lock the Treasury first, while the other locks the User first, causing them to wait on each other forever.

To fix this, I used **Ordered Locking**:

- Every transaction always acquires locks in **ascending order of User IDs**.
- Since the **Treasury (ID: 1)** is always the smallest ID, it is always locked first, followed by the User.
- This ensures that concurrent requests queue up for the same lock instead of getting stuck in a circular wait.
- **DB Transactions:** I used strict database transactions to ensure "Atomicity"—meaning every action (balance update + ledger entry) either fully succeeds or fully fails.

## 3. Idempotency (Duplicate Request Handling)

I implemented a custom idempotency layer based on the AWS Idempotency PowerTools logic to handle network retries safely.

- **The Flow:**
    - **No Record:** Create a new entry as `IN_PROGRESS`.
    - **IN_PROGRESS (not expired):** If a second request hits while the first is running, it rejects it with a 429 so the user can retry later.
    - **IN_PROGRESS (expired):** If a request crashes and stays pending, the `inProgressUntil` field allows a new request to "takeover" so the user isn't blocked forever.
    - **COMPLETED:** If the request already succeeded, we return the cached response immediately.
    - **Payload Mismatch:** If the same key is sent with different data, we return a `409 Conflict`.
- **Cleanup:** The `expiresAt` field ensures we don't store these records forever; they are cleaned up after 24 hours.

## 4. Ledger-Based Architecture

Instead of just updating a single "balance" column, I used a **Double-Entry Ledger** for auditability.

- Every transaction (Purchase, Spend, or Bonus) creates **two records** in the `audit_ledger` table:
    1. A debit from the source (e.g., Treasury).
    2. A credit to the destination (e.g., User).
- Both records share the same `transactionId`, making it very easy to track exactly where the money went.
- **Immutable Ledger:** I added **Database Triggers** that prevent anyone from updating or deleting ledger records. Once a transaction is recorded, it's permanent.

## 5. Performance & Logic

- **DB-Side Calculations:** For routes like `/balance` and `/transaction-history`, the system calculates directly on the database side using optimized SQL queries. This is faster than doing the math in the application code.
- **Dockerization:** I created a `Dockerfile` and `docker-compose.yml` to ensure the app runs in a consistent environment. The setup steps are placed in the `README.md`.

## 6. Future Roadmap (Feature Requests)

- **Admin Notifications:** Set up alerts to email the admin if the **Treasury balance** drops to zero or goes negative.
- **Security Alerts:** Send an email to the admin if the database trigger detects an attempt to modify or delete a ledger record.
- **Cron Job:** Run a cron job on every day midnight 12 and remove the rows from idempotency table which have expires_at field less than current time, so this ensures completed requests will be removed
