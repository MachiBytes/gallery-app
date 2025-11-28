require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// AWS S3 Configuration
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Database connection
let db;
async function connectDB() {
  try {
    // Connect without database to create it if needed
    const tempDb = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });
    
    // Create database if it doesn't exist
    await tempDb.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await tempDb.end();
    
    // Connect to the database
    db = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL database');
    
    // Create tables if they don't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        s3_key VARCHAR(255) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/gallery', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});

// User registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: 'Username already exists' });
  }
});

// User login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length > 0 && await bcrypt.compare(password, rows[0].password)) {
      req.session.userId = rows[0].id;
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    res.json({ success: false, error: 'Login failed' });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Upload image
app.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    const s3Key = `images/${req.session.userId}/${Date.now()}-${file.originalname}`;
    
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype
    };
    
    await s3.upload(uploadParams).promise();
    await db.execute('INSERT INTO images (user_id, filename, s3_key) VALUES (?, ?, ?)', 
      [req.session.userId, file.originalname, s3Key]);
    
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: 'Upload failed' });
  }
});

// Get user images
app.get('/images', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM images WHERE user_id = ? ORDER BY upload_date DESC', [req.session.userId]);
    const images = await Promise.all(rows.map(async (image) => {
      const url = s3.getSignedUrl('getObject', {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: image.s3_key,
        Expires: 3600
      });
      return { ...image, url };
    }));
    res.json(images);
  } catch (error) {
    res.json({ error: 'Failed to fetch images' });
  }
});

// Delete image
app.delete('/images/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM images WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
    if (rows.length > 0) {
      await s3.deleteObject({ Bucket: process.env.S3_BUCKET_NAME, Key: rows[0].s3_key }).promise();
      await db.execute('DELETE FROM images WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Image not found' });
    }
  } catch (error) {
    res.json({ success: false, error: 'Delete failed' });
  }
});

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});