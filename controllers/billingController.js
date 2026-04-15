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

exports.getBillingByCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;
        const data = await dbHelper.query(req.db, 
            'SELECT * FROM Billing WHERE customerId = ? ORDER BY date DESC', 
            [customerId]
        );
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getAllBilling = async (req, res) => {
    try {
        const data = await dbHelper.query(req.db, 'SELECT * FROM Billing ORDER BY date DESC');
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
