# FCM Scheduled Notifications (GitHub Actions)

Sends a Firebase Cloud Messaging (FCM) push notification to the `all_users`
topic on a daily schedule, using GitHub Actions cron — no server required.

## Setup

1. **Get your Firebase service account key**
   Firebase Console → Project Settings → Service Accounts →
   "Generate new private key". This downloads a JSON file.

2. **Add it as a GitHub Secret**
   In this repo: Settings → Secrets and variables → Actions →
   "New repository secret"
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: paste the **entire contents** of the downloaded JSON file

3. **Confirm the topic name matches your Flutter app**
   The workflow sends to topic `all_users` (set in `notify.yml`).
   Your Flutter app must call:
   ```dart
   await FirebaseMessaging.instance.subscribeToTopic('all_users');
   ```

4. **Adjust the schedule**
   Edit the `cron` line in `.github/workflows/notify.yml`.
   Cron time is in **UTC**. Pakistan is UTC+5, so:
   - 9:00 AM PKT → `0 4 * * *`
   - 6:00 PM PKT → `0 13 * * *`

5. **Test it manually**
   Go to the "Actions" tab in this repo → select
   "Send Scheduled Notification" → "Run workflow".
   You can optionally type a custom title/body for that test run.
   Check the run logs to confirm it succeeded.

## Files

- `send-notification.js` — sends the FCM message via Admin SDK
- `package.json` — dependencies (`firebase-admin`)
- `.github/workflows/notify.yml` — the cron schedule + manual trigger

## Customizing the message

Right now the title/body are hardcoded defaults in `send-notification.js`
(overridable via `workflow_dispatch` inputs for manual test runs). If you
want different messages on different days automatically, you could later
read them from a JSON file in the repo, keyed by date.

## Security notes

- Never commit the service account JSON file directly to the repo —
  it must only live in GitHub Secrets.
- This repo can be private; that doesn't affect GitHub Actions' free tier
  for scheduled workflows (2,000 minutes/month free).
