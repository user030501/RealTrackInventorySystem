import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import admin from "firebase-admin";

function normalizeServiceAccount(serviceAccount) {
  if (serviceAccount.private_key) {
    return {
      ...serviceAccount,
      private_key: serviceAccount.private_key.replace(/\\n/g, "\n")
    };
  }

  return serviceAccount;
}

function loadServiceAccountFromFile(filePath) {
  const resolvedPath = resolve(process.cwd(), filePath);
  const rawFile = readFileSync(resolvedPath, "utf8");
  return normalizeServiceAccount(JSON.parse(rawFile));
}

function getServiceAccount() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountPath) {
    const resolvedPath = resolve(process.cwd(), serviceAccountPath);

    if (existsSync(resolvedPath)) {
      return loadServiceAccountFromFile(serviceAccountPath);
    }
  }

  if (!rawKey) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_KEY."
    );
  }

  return normalizeServiceAccount(JSON.parse(rawKey));
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(getServiceAccount())
  });
}

const db = admin.firestore();
const productsCollection = db.collection("products");
const salesCollection = db.collection("sales");
const timestamp = admin.firestore.FieldValue.serverTimestamp;

export { admin, db, productsCollection, salesCollection, timestamp };
