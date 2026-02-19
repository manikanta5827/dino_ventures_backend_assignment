# Load Test Results

This document shows the performance of the application under high load. The tests were performed using [Autocannon](https://github.com/mcollina/autocannon) with 100 concurrent connections across 10 workers for 30 seconds.

## 1. Purchase Credits (`/purchase-credits`)

**Command:**

```bash
autocannon -w 10 -c 100 -d 30 -m POST -H 'Content-Type: application/json' -b '{"userId": 3, "amount": 10, "assetTypeId" : 1}' http://localhost:8080/purchase-credits
```

**Results:**

- **Total Requests:** 16,000
- **Duration:** 30.06s
- **Average Latency:** 186.4 ms
- **Throughput:** ~532 req/sec

| Stat    | 2.5%   | 50%    | 97.5%  | 99%    | Avg      | Max    |
| :------ | :----- | :----- | :----- | :----- | :------- | :----- |
| Latency | 164 ms | 179 ms | 260 ms | 350 ms | 186.4 ms | 447 ms |

---

## 2. Spend Credits (`/spend-credits`)

**Command:**

```bash
autocannon -w 10 -c 100 -d 30 -m POST -H 'Content-Type: application/json' -b '{"userId": 3, "amount": 10, "assetTypeId" : 1}' http://localhost:8080/spend-credits
```

**Results:**

- **Total Requests:** 15,000
- **Duration:** 30.05s
- **Average Latency:** 194.48 ms
- **Throughput:** ~500 req/sec

| Stat    | 2.5%   | 50%    | 97.5%  | 99%    | Avg       | Max    |
| :------ | :----- | :----- | :----- | :----- | :-------- | :----- |
| Latency | 168 ms | 182 ms | 314 ms | 349 ms | 194.48 ms | 453 ms |

---

## 3. Bonus Credits (`/bonus`)

**Command:**

```bash
autocannon -w 10 -c 100 -d 30 -m POST -H 'Content-Type: application/json' -b '{"userId": 3, "amount": 10}' http://localhost:8080/bonus
```

**Results:**

- **Total Requests:** 17,000
- **Duration:** 30.1s
- **Average Latency:** 175.98 ms
- **Throughput:** ~565 req/sec

| Stat    | 2.5%   | 50%    | 97.5%  | 99%    | Avg       | Max    |
| :------ | :----- | :----- | :----- | :----- | :-------- | :----- |
| Latency | 162 ms | 172 ms | 217 ms | 226 ms | 175.98 ms | 355 ms |
