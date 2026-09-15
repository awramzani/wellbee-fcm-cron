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

const TOPIC = process.env.FCM_TOPIC || 'all_users';

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (err) {
  console.error('Error initializing Firebase:', err.message);
  process.exit(1);
}

function isExpiryReminderDay() {
  const ANCHOR_DATE_UTC = Date.UTC(2026, 0, 1);
  const nowInKarachi = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })
  );
  const todayUTCMidnight = Date.UTC(
    nowInKarachi.getFullYear(),
    nowInKarachi.getMonth(),
    nowInKarachi.getDate()
  );

  const daysSinceAnchor = Math.round(
    (todayUTCMidnight - ANCHOR_DATE_UTC) / 86400000
  );

  return daysSinceAnchor % 2 === 0;
}

async function main() {
  if (!isExpiryReminderDay()) {
    console.log('Not a scheduled expiry-reminder day. Skipping.');
    return;
  }

  console.log('Today is a scheduled expiry-reminder day. Sending notification.');

  const message = {
    notification: {
      title: 'Check Expired Medicines',
      body: 'Please review the Expired Medicine list and remove or update items as needed.'
    },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      type: 'expiry_reminder'
    },
    topic: TOPIC
  };

  const response = await admin.messaging().send(message);
  console.log('Expiry reminder sent:', response);
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
