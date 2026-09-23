const admin = require('firebase-admin');

// --- Setup ---
let serviceAccount;
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
  }
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (err) {
  console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', err.message);
  process.exit(1);
}

const DB_URL = process.env.FIREBASE_DB_URL;

if (!DB_URL) {
  console.error('FIREBASE_DB_URL is not set.');
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DB_URL
  });
} catch (err) {
  console.error('Error initializing Firebase:', err.message);
  process.exit(1);
}

async function main() {
  const snapshot = await admin.database().ref('orders').once('value');
  const orders = snapshot.val() || {};

  const keysToDelete = Object.keys(orders).filter(
    (key) => orders[key] && orders[key].isOrderReceived === true
  );

  if (keysToDelete.length === 0) {
    console.log('No received orders found. Nothing to delete.');
    return;
  }

  console.log(`Found ${keysToDelete.length} received order(s) to delete:`, keysToDelete);

  // Multi-path update: setting a key to null deletes that node.
  // This does it in a single network call instead of one .remove() per order.
  const updates = {};
  for (const key of keysToDelete) {
    updates[key] = null;
  }

  await admin.database().ref('orders').update(updates);
  console.log(`Deleted ${keysToDelete.length} order(s) successfully.`);
}

main()
  .then(() => {
    console.log('Done. Exiting.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
