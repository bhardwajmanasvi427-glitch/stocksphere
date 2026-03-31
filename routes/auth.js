const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
    const { username, password, role } = req.body;
    // Simple mock logic for different users
    if (password === `${role}123` || password === 'admin123') { // admin123 works for anything for demo
        req.session.user = { username, role };
        return res.json({ success: true, message: 'Logged in successfully', user: req.session.user });
    }
    res.status(401).json({ success: false, message: 'Invalid credentials' });
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});

router.get('/session', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

module.exports = router;
