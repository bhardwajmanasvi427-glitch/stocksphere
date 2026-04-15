const dbHelper = {
    query: (db, sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    run: (db, sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }
};

exports.addExpense = async (req, res) => {
    try {
        const { amount, description, date } = req.body;
        if (!amount || !description || !date) {
            return res.status(400).json({ error: "Amount, description and date are required" });
        }
        await dbHelper.run(req.db, 
            'INSERT INTO Expenses (amount, description, date) VALUES (?, ?, ?)', 
            [amount, description, date]
        );
        res.json({ success: true, message: "Expense added successfully" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getExpenses = async (req, res) => {
    try {
        const data = await dbHelper.query(req.db, 'SELECT * FROM Expenses ORDER BY date DESC');
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
