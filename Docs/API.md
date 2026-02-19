# API and DB Documentation

## Idempotency

For all `POST` requests, you can provide an `idempotencyKey` in the request body. This ensures that the same request isn't processed multiple times if retried.

- Key: `idempotencyKey` (string)
- Scope: Per `userId`, `method`, and `path`.

---

## Endpoints

### 1. Purchase Credits

Purchase a specific asset type for a user.

- **URL:** `/purchase-credits`
- **Method:** `POST`
- **Payload:**
    ```json
    {
        "userId": 2,
        "amount": 100,
        "assetTypeId": 2,
        "idempotencyKey": "unique-key-123"
    }
    ```
- **Success Response:**
    - **Code:** 200
    - **Content:** `{ "status": "success", "data": { "wallet": { ... }, "transactionId": "..." } }`
- **Error Responses:**
    - **400:** Missing required fields, amount <= 0, or insufficient treasury funds.
    - **404:** User or Asset Type not found.
    - **409:** Idempotency key conflict.

### 2. Spend Credits

Spend credits from a user's wallet.

- **URL:** `/spend-credits`
- **Method:** `POST`
- **Payload:**
    ```json
    {
        "userId": 2,
        "amount": 50,
        "assetTypeId": 2,
        "idempotencyKey": "unique-key-456"
    }
    ```
- **Success Response:**
    - **Code:** 200
    - **Content:** `{ "status": "success", "data": { "wallet": { ... }, "transactionId": "..." } }`
- **Error Responses:**
    - **400:** Insufficient user credits, system account check, or invalid asset type.

### 3. Issue Bonus

Issue bonus loyalty points to a user.

- **URL:** `/bonus`
- **Method:** `POST`
- **Payload:**
    ```json
    {
        "userId": 2,
        "amount": 10,
        "idempotencyKey": "unique-key-789"
    }
    ```
- **Success Response:**
    - **Code:** 200
    - **Content:** `{ "status": "success", "data": { "wallet": { ... }, "transactionId": "..." } }`
- **Error Responses:**
    - **400:** Treasury has insufficient loyalty points.

### 4. Get Balance

Retrieve all balances for a specific user.

- **URL:** `/balance`
- **Method:** `GET`
- **Query Params:** `userId` (required)
- **Success Response:**
    - **Code:** 200
    - **Content:**
        ```json
        {
            "status": "success",
            "data": {
                "userId": 2,
                "userName": "John Doe",
                "balances": [
                    { "assetTypeId": 1, "assetTypeName": "Gold Coins", "balance": "1000.00" },
                    { "assetTypeId": 3, "assetTypeName": "Loyalty Points", "balance": "10.00" }
                ]
            }
        }
        ```

### 5. Transaction History

Retrieve detailed transaction history for a user, grouped by asset type.

- **URL:** `/transaction-history`
- **Method:** `GET`
- **Query Params:** `userId` (required)
- **Success Response:**
    - **Code:** 200
    - **Content:** `{ "status": "success", "data": [ ... ] }`

---

## Common Error Format

All errors follow this structure:

```json
{
  "status": "error" | "failed",
  "message": "Description of the error"
}
```

## 2. Database Schema

### Users (`users`)

| Field       | What it is                          |
| :---------- | :---------------------------------- |
| `id`        | Unique ID.                          |
| `name`      | User's name.                        |
| `email`     | Unique identifier.                  |
| `isSystem`  | True for Treasury, False for users. |
| `createdAt` | When the account was created.       |

### Asset Types (`asset_types`)

| Field         | What it is          |
| :------------ | :------------------ |
| `id`          | Unique ID.          |
| `name`        | e.g., "Gold Coins". |
| `description` | Notes on usage.     |
| `createdAt`   | When added.         |

### Wallets (`wallets`)

| Field         | What it is     |
| :------------ | :------------- |
| `userId`      | Owner.         |
| `assetTypeId` | Currency type. |
| `balance`     | Current total. |
| `updatedAt`   | Last change.   |

### Audit Ledger (`audit_ledger`)

| Field           | What it is                  |
| :-------------- | :-------------------------- |
| `transactionId` | Links both sides of a move. |
| `userId`        | Whose balance changed.      |
| `entryType`     | `credit` or `debit`.        |
| `amount`        | Value moved.                |
| `createdAt`     | Exact timestamp.            |

### Idempotency Keys (`idempotency_keys`)

| Field             | What it is                    |
| :---------------- | :---------------------------- |
| `idempotencyKey`  | Unique key from frontend.     |
| `status`          | `IN_PROGRESS` or `COMPLETED`. |
| `responseBody`    | Cached result.                |
| `inProgressUntil` | Timeout for stuck requests.   |
| `expiresAt`       | Cleanup timestamp.            |
