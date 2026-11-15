# BD VIRAL LINK

A responsive public video-sharing website with a private admin dashboard.

## Included
- Premium dark responsive design
- Public video library, search, category labels
- Individual shareable video pages (`/watch/VIDEO_ID`)
- Admin login at `/admin`
- Upload MP4, WebM, MOV and OGG files
- Delete videos and copy share links
- Optional thumbnail URL and description

## Run locally
1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env`.
3. Change `ADMIN_PASSWORD` and `SESSION_SECRET` in `.env`.
4. Run:
   ```bash
   npm install
   npm start
   ```
5. Open `http://localhost:3000`; admin panel is `http://localhost:3000/admin`.

Default username is `admin`; set a strong password in `.env` before use.

## Important before publishing
This is a starter deployment using local disk uploads and a JSON file database. It is suitable for a small test or a single-server deployment, not high-traffic production. Use persistent disk storage, HTTPS, a persistent session store, backups, and a managed video platform/CDN for reliable public streaming. Configure your host's upload/body-size limits too. Never commit `.env`, `data/`, or uploaded videos to a public Git repository.

For a real public launch, use a VPS or app host with persistent storage. Set `BASE_URL` to your final HTTPS domain, e.g. `https://yourdomain.com`. The server serves uploaded video files publicly by design, so anyone with a share link can watch them.
