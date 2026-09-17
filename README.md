# Zontes Garage Management System

A deployable Google Apps Script web application for managing garage customers, motorcycles, repair orders, parts usage, and append-only repair history. It uses Google Sheets for storage and vanilla HTML, CSS, and JavaScript for the interface.

## Project structure

- `Code.gs` — web app entry point, HTML includes, bootstrap data, and global search.
- `Database.gs` — database schema, initialization, batched sheet reads/writes, and safe sequential ID generation.
- `Customers.gs` — customer create/update/search/detail functions.
- `Motorcycles.gs` — motorcycle create/update/search/detail functions.
- `Repairs.gs` — repair orders, dashboard, status changes, logs, parts, and history.
- `Utils.gs` — shared validation, sanitizing, serialization, and formatting helpers.
- `index.html` — application shell and accessible dialogs.
- `style.css` — standalone Apple-inspired stylesheet used by local/IDE browser previews.
- `Styles.html` — Apps Script-compatible stylesheet include (Apps Script only accepts client assets as HTML files).
- `Scripts.html` — navigation, rendering, forms, searches, and `google.script.run` calls; it also loads directly in local preview mode.
- `appsscript.json` — Apps Script manifest.
- `docs/` — static GitHub Pages shell that securely embeds the deployed Apps Script web app, preserving the live Google Sheets backend.

## Create and connect the Google Spreadsheet

1. Create a blank Google Spreadsheet for the garage.
2. Copy its ID from the URL. In `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`, the ID is the value between `/d/` and `/edit`.
3. Create a standalone Apps Script project at [script.google.com](https://script.google.com), then add every file in this folder. Use the same filenames. For HTML files, omit the `.html` suffix when naming them in the Apps Script editor.
4. In Apps Script, open **Project Settings → Script Properties** and add:

   - Property: `SPREADSHEET_ID`
   - Value: the copied spreadsheet ID

   Alternatively, this project may be created from **Extensions → Apps Script** inside the database spreadsheet. If it is spreadsheet-bound, the script uses the active spreadsheet when no `SPREADSHEET_ID` property is present.

## Initialize the database

1. Select `setupDatabase` in the Apps Script function picker.
2. Click **Run**.
3. Approve the requested permissions.

The function creates `Customers`, `Motorcycles`, `RepairOrders`, `RepairLogs`, `Parts`, and `Settings` sheets, adds their headers, freezes the header row, and adds the default garage name. Running it again is safe. If a sheet has incompatible headers, it stops instead of overwriting data.

## Required permissions

On first run, Google asks for permission to:

- View and manage the configured Google Spreadsheet.
- Run the web application as the deploying user.
- Store the spreadsheet ID in script properties if `setSpreadsheetId()` is used.

Only trusted garage administrators should own or edit the Apps Script project and source spreadsheet.

## Test the application

1. Run `setupDatabase()` successfully.
2. In Apps Script, choose **Deploy → Test deployments**.
3. Select **Web app**, open the test URL, and create a customer and repair.
4. Confirm the generated IDs and records in the spreadsheet.
5. Add a repair update and confirm a new row is appended to `RepairLogs` and the repair status is updated.
6. Test search and filters with customer names, phones, plates, VINs, models, and job numbers.

Opening `index.html` directly now shows the complete interface in local preview mode. Navigation, search surfaces, dialogs, and the multi-step intake UI can be inspected locally; writes and live records connect only from the deployed Apps Script URL because `google.script.run` exists only inside Apps Script.

## Deploy as a Web App

1. In Apps Script, click **Deploy → New deployment**.
2. Choose **Web app**.
3. Set **Execute as** to **Me** (the garage administrator/deployer).
4. Select the narrowest access option that includes all garage staff. For a Google Workspace garage account, prefer **Anyone within your organization**. Avoid public anonymous access for real customer data.
5. Click **Deploy**, approve permissions, and copy the Web App URL.

Although the included manifest provides deployable defaults, review access in the deployment dialog before publishing because Google Workspace policies and available access options vary.

## Update a deployment

After changing the code:

1. Click **Deploy → Manage deployments**.
2. Edit the active deployment.
3. Choose **New version**.
4. Add a short description and click **Deploy**.

The Web App URL remains the same when the existing deployment is updated.

## GitHub Pages hosting

The repository publishes the `docs/` directory with GitHub Pages. Its full-screen shell embeds the Apps Script deployment, because the garage interface relies on `google.script.run` and cannot connect to Google Sheets from a purely static site. Keep the Apps Script deployment restricted to the intended garage accounts; the Pages shell does not bypass Google authentication.

## Give garage staff access

- Share the Web App URL only with garage staff.
- If the deployment is restricted to your organization, staff sign in with their organization accounts.
- Keep the spreadsheet private to administrators unless staff genuinely need direct sheet access; normal application users only need the Web App URL.
- If staff receive an authorization or access error, confirm the deployment access setting and their Google account domain.

## Data integrity notes

Repair orders and logs are never hard-deleted. Repair logs are append-only, and every meaningful status change adds a timeline record. IDs are generated while holding an Apps Script lock so concurrent submissions cannot receive the same identifier. Server-side functions validate required fields and relationships before writing data.
