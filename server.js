const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'stocksphere-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const dbPath = path.join(__dirname, 'database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// Pass db instance to routes
app.use((req, res, next) => {
    req.db = db;
    next();
});

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

// routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// ✅ ADD THIS HERE (BEFORE listen)
app.get('/api/payments', (req, res) => {
    db.all("SELECT * FROM Payment", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ✅ THEN START SERVER
app.listen(PORT, () => {
    console.log(`StockSphere Server running on http://localhost:${PORT}`);
});

