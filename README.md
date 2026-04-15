# RealTrack Inventory System

RealTrack is a small full-stack starter for a live inventory dashboard powered by React, Express, Firestore, and Socket.io.

## Firestore schema

Use a single `products` collection where each document represents one inventory item:

```json
{
  "category": "Canned Goods",
  "productName": "Wireless Mouse",
  "stockLevel": 24,
  "lastUpdated": "Firestore server timestamp"
}
```

Recommended collection layout:

```text
products/{productId}
```

Example document:

```text
products/abc123
  category: "Beverages"
  productName: "Notebook"
  stockLevel: 18
  lastUpdated: serverTimestamp()
```

## Backend responsibilities

- Connects to Firestore using the Firebase Admin SDK
- Exposes REST endpoints for reading products and deducting stock
- Emits Socket.io events to all connected clients
- Rebroadcasts Firestore changes through a realtime collection listener

### API routes

- `GET /api/health`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id/deduct`

## Frontend responsibilities

- Loads the current product list from the API
- Opens a Socket.io connection to the backend
- Replaces dashboard data whenever `products:snapshot` arrives
- Calls the stock deduction endpoint from the dashboard UI

## Environment setup

1. Copy `backend/.env.example` to `backend/.env`
2. Copy `frontend/.env.example` to `frontend/.env`
3. Choose one backend Firebase credential option:
4. Either set `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json` and place your downloaded service-account file in `backend/serviceAccountKey.json`
5. Or put your Firebase service account JSON on one line into `FIREBASE_SERVICE_ACCOUNT_KEY`
6. Install dependencies in both `backend` and `frontend`

Using `FIREBASE_SERVICE_ACCOUNT_PATH` is usually easier and less error-prone on Windows.

## Run locally

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:4000`, and the backend allows the Vite dev server at `http://localhost:5173`.

## Seed sample products

Once your Firebase credentials are configured, you can preload sample inventory:

```bash
cd backend
npm run seed
```

This creates these starter documents in `products`:

- `notebook-a5`
- `wireless-mouse`
- `barcode-labels`
- `receipt-paper`

If you rerun the seed command, those same document IDs are overwritten with fresh sample values instead of creating duplicates.

## Firestore security guidance

Because this app uses the Firebase Admin SDK on the backend, the safest setup is to keep direct client access to Firestore disabled and let your Express API be the only path to inventory updates.

Recommended production posture:

- Keep the service account file only on the backend
- Never expose the Admin SDK or service-account credentials to the frontend
- Route stock updates through backend endpoints like `PATCH /api/products/:id/deduct`
- Lock Firestore rules down so browser clients cannot read or write inventory data directly

The repo includes a starter rules file at `firestore.rules` that denies all direct client access by default. That is a good fit for this architecture because your backend bypasses rules through the Admin SDK.

If you later decide to read Firestore directly from the frontend, you should switch to Firebase Authentication first and then replace the deny-all rules with role-based access rules.

## Plugging in your real Firebase config

The easiest way is:

1. In Firebase Console, go to Project Settings > Service accounts
2. Generate a new private key
3. Save the JSON file as `backend/serviceAccountKey.json`
4. Set `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json` in `backend/.env`
5. Start the backend with `npm run dev`

If you prefer the env-only approach, paste the full JSON onto one line into `FIREBASE_SERVICE_ACCOUNT_KEY` and remove or blank out `FIREBASE_SERVICE_ACCOUNT_PATH`.

## Realtime deduction flow

1. A user clicks `Deduct 1` in the React dashboard
2. The frontend sends `PATCH /api/products/:id/deduct`
3. The backend runs a Firestore transaction to prevent negative stock
4. Firestore is updated with a new `stockLevel` and `lastUpdated`
5. Socket.io emits `stock:deducted`
6. The Firestore snapshot listener emits `products:snapshot` so every client refreshes instantly
