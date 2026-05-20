const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Config ---
const ADMIN_USER = 'allisonparmann';
const ADMIN_HASH = '$2b$10$j/2J951qGCdKndsPN.fUIOv8NCFwXnDhqM.MounXBj6.4nrdqBSKy';
const DATA_DIR = path.join(__dirname, 'data');
const IMAGES_DIR = path.join(__dirname, 'images');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'ap-photo-session-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files
app.use(express.static(__dirname, {
  index: 'index.html',
  extensions: ['html']
}));

// --- Helpers ---
function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// --- Upload config ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.body.category || 'other';
    const dir = path.join(IMAGES_DIR, category);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .toLowerCase();
    const unique = Date.now().toString(36);
    cb(null, `${base}-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// =====================
// PUBLIC API
// =====================

// Contact form submission
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }

  const contacts = readJSON(CONTACTS_FILE);
  contacts.push({
    id: Date.now(),
    name,
    email,
    subject: subject || '(no subject)',
    message,
    date: new Date().toISOString(),
    read: false
  });
  writeJSON(CONTACTS_FILE, contacts);
  res.json({ success: true });
});

// Gallery data (public)
app.get('/api/gallery', (req, res) => {
  const gallery = readJSON(GALLERY_FILE);
  res.json(gallery);
});

// =====================
// AUTH
// =====================

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && await bcrypt.compare(password, ADMIN_HASH)) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth-check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// =====================
// ADMIN API (protected)
// =====================

// --- Contacts ---
app.get('/api/admin/contacts', requireAuth, (req, res) => {
  const contacts = readJSON(CONTACTS_FILE);
  res.json(contacts.reverse()); // newest first
});

app.put('/api/admin/contacts/:id/read', requireAuth, (req, res) => {
  const contacts = readJSON(CONTACTS_FILE);
  const contact = contacts.find(c => c.id === parseInt(req.params.id));
  if (contact) {
    contact.read = true;
    writeJSON(CONTACTS_FILE, contacts);
  }
  res.json({ success: true });
});

app.delete('/api/admin/contacts/:id', requireAuth, (req, res) => {
  let contacts = readJSON(CONTACTS_FILE);
  contacts = contacts.filter(c => c.id !== parseInt(req.params.id));
  writeJSON(CONTACTS_FILE, contacts);
  res.json({ success: true });
});

// --- Gallery ---
app.get('/api/admin/gallery', requireAuth, (req, res) => {
  const gallery = readJSON(GALLERY_FILE);
  res.json(gallery);
});

// Upload image
app.post('/api/admin/gallery/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const gallery = readJSON(GALLERY_FILE);
  const maxId = gallery.reduce((max, img) => Math.max(max, img.id), 0);
  const category = req.body.category || 'other';
  const title = req.body.title || req.file.originalname;

  const newImage = {
    id: maxId + 1,
    file: `images/${category}/${req.file.filename}`,
    title,
    category
  };

  gallery.push(newImage);
  writeJSON(GALLERY_FILE, gallery);
  res.json(newImage);
});

// Update image metadata
app.put('/api/admin/gallery/:id', requireAuth, (req, res) => {
  const gallery = readJSON(GALLERY_FILE);
  const image = gallery.find(img => img.id === parseInt(req.params.id));
  if (!image) return res.status(404).json({ error: 'Image not found' });

  const oldCategory = image.category;
  const oldFile = image.file;

  if (req.body.title) image.title = req.body.title;
  if (req.body.category && req.body.category !== oldCategory) {
    // Move file to new category folder
    const newDir = path.join(IMAGES_DIR, req.body.category);
    fs.mkdirSync(newDir, { recursive: true });
    const filename = path.basename(oldFile);
    const oldPath = path.join(__dirname, oldFile);
    const newPath = path.join(newDir, filename);

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }

    image.category = req.body.category;
    image.file = `images/${req.body.category}/${filename}`;
  }

  writeJSON(GALLERY_FILE, gallery);
  res.json(image);
});

// Delete image
app.delete('/api/admin/gallery/:id', requireAuth, (req, res) => {
  let gallery = readJSON(GALLERY_FILE);
  const image = gallery.find(img => img.id === parseInt(req.params.id));
  if (image) {
    // Delete the file
    const filePath = path.join(__dirname, image.file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    gallery = gallery.filter(img => img.id !== parseInt(req.params.id));
    writeJSON(GALLERY_FILE, gallery);
  }
  res.json({ success: true });
});

// --- Serve admin page ---
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin`);
});
