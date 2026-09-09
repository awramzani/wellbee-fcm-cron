const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- Setup ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const DB_URL = process.env.FIREBASE_DB_URL;
const TOPIC = process.env.FCM_TOPIC || 'all_users';

if (!DB_URL) {
  console.error('❌ FIREBASE_DB_URL is not set.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DB_URL
});

// Supplier -> day-of-week mapping. Edit supplier-config.json to add/change suppliers.
// Days must be short form: Mon, Tue, Wed, Thu, Fri, Sat, Sun
const supplierConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'supplier-config.json'), 'utf8')
);

// Get today's short weekday name (Mon/Tue/Wed...) in Pakistan time
// (GitHub Actions runners run in UTC, so we must convert)
function getTodayWeekday() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    weekday: 'short'
  }).format(new Date()); // returns e.g. "Wed"
}

function matchesSupplier(order, supplierName) {
  const trimmedName = supplierName.trim();
  const code = (order.supplierCode || '').trim();
  const name = (order.supplierName || '').trim();
  // Case-sensitive exact match against either field, since some supplier
  // names in the DB differ only by casing and represent distinct suppliers
  // (e.g. "AHBAB" vs "Ahbab").
  return code === trimmedName || name === trimmedName;
}

async function main() {
  const today = getTodayWeekday();
  console.log(`Today (Pakistan time): ${today}`);

  // Only check suppliers whose order-day matches today
  const suppliersToday = supplierConfig.filter((s) => s.days.includes(today));

  if (suppliersToday.length === 0) {
    console.log('No suppliers scheduled for today. Nothing to check.');
    return;
  }

  console.log(
    'Suppliers scheduled today:',
    suppliersToday.map((s) => s.name).join(', ')
  );

  // Fetch all orders from Firebase Realtime Database
  const snapshot = await admin.database().ref('orders').once('value');
  const orders = snapshot.val() || {};
  const allOrders = Object.values(orders);

  for (const supplier of suppliersToday) {
    // Pending = not deleted AND order not yet sent
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

    const title = `📦 Order Due Today — ${supplier.name}`;
    const body = `${pendingItems.length} item(s) pending: ${previewNames}${extraText}. Please place today's order.`;

    const message = {
      notification: { title, body },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        type: 'order_reminder',
        supplierName: supplier.name
      },
      topic: TOPIC
    };

    try {
      const response = await admin.messaging().send(message);
      console.log(`✅ Reminder sent for ${supplier.name}:`, response);
    } catch (error) {
      console.error(`❌ Failed to send reminder for ${supplier.name}:`, error);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
