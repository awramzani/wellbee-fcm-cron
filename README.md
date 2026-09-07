# FCM Scheduled Notifications (GitHub Actions)

Two independent, serverless notification systems for the pharmacy app, both
running on GitHub Actions cron — no backend server needed.

---

## 1. Expire Medicine Reminder

Sends a simple reminder to check the Expired Medicine list, **twice a day,
every 2 days**.

- Workflow: `.github/workflows/notify-expiry.yml`
- Schedule: 9:00 AM and 6:00 PM (Pakistan time), every other day
- Uses: `send-notification.js` (generic sender)

No configuration needed — just make sure `FIREBASE_SERVICE_ACCOUNT` secret
is set (see setup below).

**Note on "every 2 days":** GitHub Actions cron doesn't support calendar-based
"every 2 days" natively, so this uses `*/2` on the day-of-month field, which
sends on odd calendar days (1, 3, 5, 7...). This is a close approximation —
around month boundaries it may occasionally send on two days in a row instead
of skipping.

---

## 2. Supplier Order Reminder (smart, database-driven)

Checks your Firebase Realtime Database every **3 hours**. For each supplier
whose order-day matches today (Pakistan time), it looks for pending orders
(`isDeleted: false` and `isOrderSent: false`). If any are found, it sends a
notification naming that supplier and the pending items. **Once `isOrderSent`
becomes `true` for that supplier's items, the next check will find nothing
pending and will automatically stop notifying** — no manual reset needed.

- Workflow: `.github/workflows/notify-orders.yml`
- Schedule: every 3 hours, all day
- Script: `send-order-reminder.js`
- Config: `supplier-config.json` — **edit this to add all your suppliers**

### Editing `supplier-config.json`

```json
[
  { "supplierCode": "AR PHARMA", "supplierName": "AR Pharma", "days": ["Monday"] },
  { "supplierCode": "AL QAMAR", "supplierName": "Al Qamar", "days": ["Wednesday", "Saturday"] }
]
```

- `supplierCode` must exactly match the `supplierCode` field stored in your
  Firebase `orders` node (case-sensitive).
- `days` is a list — a supplier can have one day or several (e.g. Al Qamar
  has both Wednesday and Saturday). If an order isn't sent by Wednesday, the
  Saturday check will pick it up again automatically.
- Add one object per supplier. Commit the change and it takes effect on the
  next scheduled run (no redeploy needed).

---

## Setup

1. **Firebase service account key**
   Firebase Console → Project Settings → Service Accounts →
   "Generate new private key" → downloads a JSON file.

2. **Add it as a GitHub Secret**
   Repo → Settings → Secrets and variables → Actions →
   "New repository secret"
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: paste the **entire contents** of the downloaded JSON file

3. **Database URL** is already set in `notify-orders.yml`:
   ```
   https://well-bee-pharmacy-default-rtdb.asia-southeast1.firebasedatabase.app
   ```
   If this ever changes, update it in that workflow file.

4. **Fill in `supplier-config.json`** with your full supplier list and days.

5. **Test manually**
   Actions tab → select either workflow → "Run workflow" → check the logs.
   For the order reminder, the logs will tell you which suppliers matched
   today and whether any pending orders were found.

## Files

- `send-notification.js` — generic sender (used by the expiry reminder, and
  reusable for ad-hoc test notifications via manual trigger)
- `send-order-reminder.js` — checks Firebase RTDB and sends per-supplier
  reminders
- `supplier-config.json` — supplier → order-day mapping (edit this)
- `package.json` — dependencies (`firebase-admin`)
- `.github/workflows/notify-expiry.yml` — expiry reminder schedule
- `.github/workflows/notify-orders.yml` — order reminder schedule

## Security notes

- Never commit the service account JSON directly — only via GitHub Secrets.
- The Realtime Database URL itself isn't a secret (it's just an endpoint),
  but access to it is protected by your Firebase security rules and the
  service account credential.
