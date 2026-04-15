const dbHelper = {
    query: (db, sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

exports.getPaymentsByRetailer = async (req, res) => {
    try {
        const { retailerId } = req.params;
        const data = await dbHelper.query(req.db, 
            'SELECT * FROM Payments WHERE retailerId = ? ORDER BY date DESC', 
            [retailerId]
        );
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getAllPayments = async (req, res) => {
    try {
        const data = await dbHelper.query(req.db, 'SELECT * FROM Payments ORDER BY date DESC');
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
