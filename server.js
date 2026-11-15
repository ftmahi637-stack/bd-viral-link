const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DB_FILE = path.join(DATA_DIR, "videos.json");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 }
}));

function readVideos() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch { return []; }
}
function writeVideos(videos) {
  fs.writeFileSync(DB_FILE, JSON.stringify(videos, null, 2));
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ error: "অনুমতি নেই। আগে Admin Login করুন।" });
}
const maxMb = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 500));
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(16).toString("hex") + ext);
  }
});
const upload = multer({
  storage, limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/ogg"];
    cb(allowed.includes(file.mimetype) ? null : new Error("শুধু MP4, WebM, MOV বা OGG ভিডিও আপলোড করুন।"), allowed.includes(file.mimetype));
  }
});

app.use("/uploads", express.static(UPLOAD_DIR, { fallthrough: false, maxAge: "1h" }));
app.use(express.static(path.join(ROOT, "public")));

app.get("/api/videos", (_req, res) => {
  const videos = readVideos().map(({ id, title, description, category, thumbnail, createdAt }) =>
    ({ id, title, description, category, thumbnail, createdAt }));
  res.json(videos.sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
});
app.get("/api/videos/:id", (req, res) => {
  const video = readVideos().find(v => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: "ভিডিও পাওয়া যায়নি।" });
  res.json({ id: video.id, title: video.title, description: video.description, category: video.category,
    thumbnail: video.thumbnail, videoUrl: video.videoUrl, createdAt: video.createdAt });
});
app.post("/api/admin/login", async (req, res) => {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "change-me";
  if (req.body.username !== username || !(await bcrypt.compare(req.body.password || "", await bcrypt.hash(password, 10)))) {
    return res.status(401).json({ error: "Username অথবা Password ভুল।" });
  }
  req.session.admin = true;
  res.json({ ok: true });
});
app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get("/api/admin/me", (req, res) => res.json({ admin: !!(req.session && req.session.admin) }));
app.post("/api/admin/videos", requireAdmin, upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "ভিডিও ফাইল নির্বাচন করুন।" });
  const title = String(req.body.title || "").trim();
  if (!title) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "ভিডিওর Title দিতে হবে।" });
  }
  const video = {
    id: crypto.randomBytes(7).toString("hex"),
    title: title.slice(0, 120),
    description: String(req.body.description || "").slice(0, 2000),
    category: String(req.body.category || "Uncategorized").slice(0, 60),
    thumbnail: String(req.body.thumbnail || "").slice(0, 1000),
    videoUrl: "/uploads/" + req.file.filename,
    createdAt: new Date().toISOString()
  };
  const videos = readVideos(); videos.push(video); writeVideos(videos);
  res.json({ ok: true, video, shareUrl: (process.env.BASE_URL || `${req.protocol}://${req.get("host")}`) + "/watch/" + video.id });
});
app.delete("/api/admin/videos/:id", requireAdmin, (req, res) => {
  const videos = readVideos();
  const video = videos.find(v => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: "ভিডিও পাওয়া যায়নি।" });
  const filename = path.basename(video.videoUrl);
  const filePath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  writeVideos(videos.filter(v => v.id !== req.params.id));
  res.json({ ok: true });
});
app.put("/api/admin/videos/:id", requireAdmin, (req, res) => {
  const videos = readVideos();
  const video = videos.find(v => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: "ভিডিও পাওয়া যায়নি।" });
  video.title = String(req.body.title || video.title).slice(0,120);
  video.description = String(req.body.description ?? video.description).slice(0,2000);
  video.category = String(req.body.category || video.category).slice(0,60);
  video.thumbnail = String(req.body.thumbnail ?? video.thumbnail).slice(0,1000);
  writeVideos(videos);
  res.json({ ok: true, video });
});

app.get("/watch/:id", (_req, res) => res.sendFile(path.join(ROOT, "public", "watch.html")));
app.get("/admin", (_req, res) => res.sendFile(path.join(ROOT, "public", "admin.html")));
app.use((err, _req, res, _next) => {
  const message = err.code === "LIMIT_FILE_SIZE" ? `ফাইল ${maxMb} MB-এর বেশি হতে পারবে না।` : (err.message || "Server error");
  res.status(400).json({ error: message });
});
app.listen(PORT, () => console.log(`BD VIRAL LINK চলছে: http://localhost:${PORT}`));
