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

const TOPIC = process.env.FCM_TOPIC || 'all_users';

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (err) {
  console.error('Error initializing Firebase:', err.message);
  process.exit(1);
}

// Medicine list — edit medicine-list.json to add/remove items
const medicines = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'medicine-list.json'), 'utf8')
);

function pickRandomMedicine() {
  const index = Math.floor(Math.random() * medicines.length);
  return medicines[index];
}

async function main() {
  if (!medicines || medicines.length === 0) {
    console.error('medicine-list.json is empty. Nothing to send.');
    process.exit(1);
  }

  const medicine = pickRandomMedicine();
  console.log(`Picked medicine: ${medicine}`);

  const message = {
    notification: {
      title: '📋 Check Stock & Order',
      body: `Please check stock and order: ${medicine}`
    },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      type: 'random_stock_check',
      medicineName: medicine
    },
    topic: TOPIC
  };

  const response = await admin.messaging().send(message);
  console.log('Notification sent:', response);
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
