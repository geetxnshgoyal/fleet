# FleetFox Device Inventory Front-End

This static web app lets you compare incoming and installed device spreadsheets directly in the browser and highlights any devices still in stock. All processing happens on the client side—no data is uploaded to a server.

## Quick Start

1. Open a terminal in the project root and launch a simple web server:
   ```bash
   python3 -m http.server --directory frontend 5173
   ```
2. Visit `http://localhost:5173` in your browser.
3. Upload the latest `incoming.xlsx` and `installed.xls` files using the form controls.
4. Use the action buttons to switch views or download the stock list as CSV.

> You can also double-click `frontend/index.html` to open the page directly, but some browsers block local file access for uploads. A lightweight server avoids that issue.

## Publishing to `fleetfox.co.in`

You only need the three files in this folder (`index.html`, `app.js`, `styles.css`). Deploy them with any static hosting service (for example, Netlify, Vercel, GitHub Pages, Cloudflare Pages, or your existing cPanel host), then point the domain to that service. A typical workflow:

1. Zip the `frontend` folder or upload the files through your hosting provider’s file manager.
2. If you have cPanel or similar shared hosting:
   - Upload the files to `public_html/` (or the document root configured for `fleetfox.co.in`), keeping the filenames the same.
   - Ensure `index.html` is at the root so it loads by default.
3. If you use a static host (Netlify/Vercel/etc.):
   - Create a new site and drag-and-drop the `frontend` folder.
   - Configure a custom domain within the host’s dashboard and set the DNS `A`/`CNAME` records at your registrar to point to the host.

After DNS propagates, opening `https://fleetfox.co.in` should load the app. Refreshing the browser or uploading new spreadsheets resets the view with the latest data.
