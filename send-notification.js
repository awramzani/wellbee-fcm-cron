const admin = require('firebase-admin');

// Load service account credentials from the GitHub Secret (injected as env var)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// You can customize the title/body here, or later load them from a JSON/CSV
// file in the repo if you want different messages on different days.
const NOTIFICATION_TITLE = process.env.NOTIFICATION_TITLE || 'Reminder';
const NOTIFICATION_BODY = process.env.NOTIFICATION_BODY || 'This is your scheduled notification.';
const TOPIC = process.env.FCM_TOPIC || 'all_users';

async function sendNotification() {
  const message = {
    notification: {
      title: NOTIFICATION_TITLE,
      body: NOTIFICATION_BODY
    },
    // Optional: custom data payload your Flutter app can read on tap
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      type: 'scheduled_reminder'
    },
    topic: TOPIC
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent successfully:', response);
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    process.exit(1); // make sure GitHub Actions marks the run as failed
  }
}

sendNotification();
