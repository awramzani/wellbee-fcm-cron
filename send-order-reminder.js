const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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
const TOPIC = process.env.FCM_TOPIC || 'all_users';

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

// Supplier -> day-of-week mapping. Edit supplier-config.json to add/change suppliers.
// Days must be short form: Mon, Tue, Wed, Thu, Fri, Sat, Sun
const supplierConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'supplier-config.json'), 'utf8')
);

// Get today's short weekday name (Mon/Tue/Wed...) in Pakistan time
function getTodayWeekday() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    weekday: 'short'
  }).format(new Date());
}

function matchesSupplier(order, supplierName) {
  const trimmedName = supplierName.trim();
  const code = (order.supplierCode || '').trim();
  const name = (order.supplierName || '').trim();
  return code === trimmedName || name === trimmedName;
}

async function main() {
  const today = getTodayWeekday();
  console.log(`Today (Pakistan time): ${today}`);

  const suppliersToday = supplierConfig.filter((s) => s.days.includes(today));

  if (suppliersToday.length === 0) {
    console.log('No suppliers scheduled for today. Nothing to check.');
    return;
  }

  console.log(
    'Suppliers scheduled today:',
    suppliersToday.map((s) => s.name).join(', ')
  );

  const snapshot = await admin.database().ref('orders').once('value');
  const orders = snapshot.val() || {};
  const allOrders = Object.values(orders);

  for (const supplier of suppliersToday) {
    const pendingItems = allOrders.filter(
      (order) =>
        order &&
        order.isDeleted === false &&
        order.isOrderSent === false &&
        matchesSupplier(order, supplier.name)
    );

    if (pendingItems.length === 0) {
      console.log(`No pending orders for ${supplier.name}. Skipping — no notification sent.`);
      continue;
    }

    const previewNames = pendingItems.slice(0, 3).map((i) => i.itemName).join(', ');
    const extraCount = pendingItems.length - 3;
    const extraText = extraCount > 0 ? ` and ${extraCount} more item(s)` : '';

    const title = `Order Due Today — ${supplier.name}`;
    const body = `${pendingItems.length} item(s) pending: ${previewNames}${extraText}. Please place today's order.`;

    const message = {
      notification: { title, body },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        type: 'order',
        supplierName: supplier.name
      },
      topic: TOPIC
    };

    try {
      const response = await admin.messaging().send(message);
      console.log(`Reminder sent for ${supplier.name}:`, response);
    } catch (error) {
      console.error(`Failed to send reminder for ${supplier.name}:`, error);
    }
  }
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
