const admin = require('firebase-admin');

// --- Setup ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const TOPIC = process.env.FCM_TOPIC || 'all_users';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

/**
 * True "every other day" check, independent of calendar/month boundaries.
 * Cron's `day-of-month */2` drifts around month transitions (e.g. day 31 -> 1
 * can both be "odd"), so instead we compute an absolute day count since a
 * fixed anchor date and check its parity. This guarantees a consistent
 * skip-one/run-one cadence forever, regardless of month length.
 *
 * Anchor: 2026-01-01 (Asia/Karachi) = day 0 = a "run" day.
 */
function isExpiryReminderDay() {
  const ANCHOR_DATE_UTC = Date.UTC(2026, 0, 1); // 2026-01-01
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
    console.log('Not a scheduled expiry-reminder day. Skipping — no notification sent.');
    return;
  }

  console.log('Today is a scheduled expiry-reminder day. Sending notification.');

  const message = {
    notification: {
      title: '⚠️ Check Expired Medicines',
      body: 'Please review the Expired Medicine list and remove or update items as needed.'
    },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      type: 'expiry_reminder'
    },
    topic: TOPIC
  };

  const response = await admin.messaging().send(message);
  console.log('✅ Expiry reminder sent:', response);
}

main()
  .then(() => {
    console.log('Done. Exiting.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
