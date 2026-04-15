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

exports.getAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: "startDate and endDate are required" });
        }

        const revenueResult = await dbHelper.query(req.db, 
            'SELECT SUM(TotalAmount) as sum FROM Orders WHERE OrderDate BETWEEN ? AND ?', 
            [startDate, endDate]
        );
        const expensesResult = await dbHelper.query(req.db, 
            'SELECT SUM(amount) as sum FROM Expenses WHERE date BETWEEN ? AND ?', 
            [startDate, endDate]
        );
        const salesCountResult = await dbHelper.query(req.db, 
            'SELECT COUNT(*) as count FROM Orders WHERE OrderDate BETWEEN ? AND ?', 
            [startDate, endDate]
        );

        const revenue = revenueResult[0].sum || 0;
        const expenses = expensesResult[0].sum || 0;
        const salesCount = salesCountResult[0].count || 0;
        const profit = revenue - expenses;

        res.json({
            revenue,
            expenses,
            profit,
            salesCount
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getCustomerFrequency = async (req, res) => {
    try {
        const sql = `
            SELECT c.Name, COUNT(o.OrderID) as orderCount, SUM(o.TotalAmount) as totalSpent 
            FROM Customers c 
            JOIN Orders o ON c.CustomerID = o.CustomerID 
            GROUP BY c.CustomerID 
            ORDER BY orderCount DESC 
            LIMIT 30
        `;
        const data = await dbHelper.query(req.db, sql);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getRecentPurchasers = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const sql = `
            SELECT c.Name, o.OrderDate, o.TotalAmount 
            FROM Customers c 
            JOIN Orders o ON c.CustomerID = o.CustomerID 
            ORDER BY o.OrderID DESC 
            LIMIT ?
        `;
        const data = await dbHelper.query(req.db, sql, [limit]);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};


