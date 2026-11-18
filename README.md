# SynFlow

Till, sales orders and supplier orders for a football kit business. Mobile first; works on a PC with a
barcode scanner. Hosted on GitHub Pages, data in Google Sheets (Apps Script), pictures in Google Drive.

- **Setup for the owner:** see [SETUP-GUIDE.md](SETUP-GUIDE.md).
- **Backend:** `backend/Code.gs` (paste into the Sheet's Apps Script and deploy as a web app).
- **App source:** `src/`. Build with `npm install` then `npm run build`; the site is written to `docs/`.

How the data flows: every screen reads the copy on the device (IndexedDB) so it opens instantly and works offline.
Saves go into an outbox and are pushed to the Sheet in the background. Changes from other devices are pulled every
minute, on returning to the app and on ↻ Refresh. The server stamps each row with `syncedAt`; a device asks for
rows newer than its last pull. Sales, payments, expenses and transfers load from the start of the month; older ones
load when a date filter reaches back.
