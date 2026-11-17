# Legendary Kits POS: setup guide

This puts your till app on the internet (free, on GitHub Pages) and keeps all your records in a Google Sheet,
so your phone and your laptop always show the same sales, orders and expenses.

You do this once. It takes about 30 minutes. No coding is needed: you copy, paste and click.

**What you need:** a Google account (Gmail) and a free GitHub account (github.com → Sign up).

---

## Part 1: The Google Sheet (your database)

1. Go to **sheets.google.com** and create a **Blank spreadsheet**. Name it, e.g. *Legendary Kits POS*.
2. In the Sheet, click **Extensions → Apps Script**. A new tab opens with a code editor.
3. Delete everything in the editor (the few lines that are already there).
4. Open the file **backend/Code.gs** from this folder (with Notepad), select all (Ctrl+A), copy (Ctrl+C),
   and paste it into the Apps Script editor (Ctrl+V).
5. Click the **Save** icon (the floppy disk). Name the project *Kits POS* if it asks.
6. Go back to the Sheet tab and **reload the page** (F5). After a few seconds a new menu, **Kits POS**, appears
   next to Help.
7. Click **Kits POS → 1. Set up (run once)**.
   - Google asks for permission: click **Continue**, choose your account.
   - You'll see "Google hasn't verified this app". That's normal: it's your own script. Click **Advanced**,
     then **Go to Kits POS (unsafe)**, then **Allow**.
   - Click **Kits POS → 1. Set up** again if it didn't finish.
8. A box shows **your key** (a mix of letters and numbers). Copy it somewhere safe. You can see it again any time with
   **Kits POS → Show my key**.

Setup has made one tab per table (products, sales, salesOrders…), a Drive folder **Legendary Kits POS – Pictures**
for kit photos, a folder **Legendary Kits POS – Backups**, and a nightly backup (2am, last 30 days kept).

## Part 2: Turn the script into a web address

1. In the Apps Script tab, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - Description: *Kits POS*
   - Execute as: **Me**
   - Who has access: **Anyone**. The app needs this to reach it; nobody can read or change anything without your key.
4. Click **Deploy**, allow access again if asked, then copy the **Web app URL**. It starts with
   `https://script.google.com/macros/s/` and ends with `/exec`.

> If you ever paste a newer Code.gs, use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**
> so the same web address keeps working.

## Part 3: Put the app online (GitHub Pages)

1. Sign in at **github.com**. Click **+** (top right) → **New repository**.
2. Name: `legendary-kits-pos`. Choose **Public** (free GitHub Pages needs public; your data is NOT in it, only the
   app itself). Tick **Add a README file**. Click **Create repository**.
3. In the new repository click **Add file → Upload files**.
4. On your computer open the folder **docs** inside this project folder. Select **everything inside it**
   (Ctrl+A) and drag it onto the GitHub upload page. Wait until all files are listed, then click **Commit changes**.
5. Click **Settings** (top of the repository) → **Pages** (left menu).
   - Source: **Deploy from a branch**
   - Branch: **main**, folder **/ (root)** → **Save**
6. Wait 1–2 minutes and refresh. The page shows your link:
   **https://YOUR-GITHUB-NAME.github.io/legendary-kits-pos/**

## Part 4: Connect each phone and laptop

1. Open your link on the phone (Chrome or Safari).
2. Tap **More → Settings**. Paste the **Web app address** (Part 2) and the **Key** (Part 1). Tap **Connect**.
   You should see a green "Connected" message.
3. Add it to the home screen so it opens like an app:
   - Android Chrome: ⋮ menu → **Add to Home screen**
   - iPhone Safari: Share button → **Add to Home Screen**
4. Do the same on the laptop (Settings is in the menu on the left).

Everything you've already entered on a device goes up to the Sheet as soon as it connects.

---

## Daily use

- **Point of Sale**:
  - Phone: tap **Scan** to use the camera, or tap a kit.
  - PC: plug in a USB or Bluetooth barcode scanner and just scan; the cursor stays in the search box.
  - Tap a quantity to change it on the number pad.
- **Sales History**: every sale, by date. Tap one to see it, send the receipt on WhatsApp, or void it.
- **Sales Orders**: take an order with the kit pictures, then:
  - **WhatsApp picture/PDF** sends it to the customer.
  - **Supplier Excel** makes your supplier sheet.
  - On the list, tick Open orders → **Create Supplier Order** combines them, adding together identical lines.
  - Status goes Open → Ordered → Received → Delivered.
- **Expenses**: amount on the number pad, what it was for, which account paid it.
- **Accounts**: Cash, Bank, EcoCash, InnBucks… Add your own, see balances and move money between them.
- **Refresh** (↻ top right of every screen) gets the latest from the Sheet. The app also syncs by itself every
  minute and whenever you come back to it. It shows "Synced … ago".

Without signal the app keeps working; changes wait on the phone ("3 to send") and go up when you're back online.

## Backups

Every night at about 2am a full copy of the Sheet is saved to **Legendary Kits POS – Backups** in your Google Drive.
To take one now: **Kits POS → Back up now**. To restore, open a backup copy and copy its tabs back into the main Sheet
(or ask for help).

## Good to know

- **Don't edit the "json" column** in the Sheet; that's where the app keeps each full record. Other columns are
  there for you to read, sort and filter.
- **Pictures**: originals stay full size in Google Drive; the app shows small thumbnails so it's fast on mobile data.
  Excel exports and WhatsApp shares use the full-size pictures, so those take a few seconds.
- **Anyone with your key** could change your data, so only put it into your own devices.

## If something goes wrong

| What you see | What to do |
|---|---|
| "Wrong key" | Copy the key again: Sheet → Kits POS → Show my key. |
| "No connection to Google" | Check the internet. Your work is kept on the phone and sends later. |
| "Google sent back something unexpected" | The web address is wrong, or Part 2 "Who has access" isn't **Anyone**. |
| Camera doesn't open | Allow the camera for the site in the browser settings. The app must be opened from the https link. |
| A picture doesn't show on another phone | Wait for the next sync, or tap ↻. |
