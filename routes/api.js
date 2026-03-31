const express = require('express');
const router = express.Router();

function query(req, sql, params = []) {
    return new Promise((resolve, reject) => {
        req.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function runQuery(req, sql, params = []) {
    return new Promise((resolve, reject) => {
        req.db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// 1. DASHBOARD STATS
router.get('/dashboard-stats', async (req, res) => {
    try {
        const productsCount = await query(req, 'SELECT COUNT(*) as count FROM Products');
        const ordersCount = await query(req, 'SELECT COUNT(*) as count FROM Orders');
        const revenue = await query(req, 'SELECT SUM(TotalAmount) as sum FROM Orders');
        const customersCount = await query(req, 'SELECT COUNT(*) as count FROM Customers');
        const lowStockCount = await query(req, 'SELECT COUNT(*) as count FROM Products WHERE StockQuantity < 10');

        res.json({
            products: productsCount[0].count,
            orders: ordersCount[0].count,
            revenue: revenue[0].sum || 0,
            customers: customersCount[0].count,
            lowStock: lowStockCount[0].count
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. ANALYTICS (Graphs data)
router.get('/analytics', async (req, res) => {
    try {
        // Sales Trend (line chart by date)
        const salesTrend = await query(req, 'SELECT OrderDate, SUM(TotalAmount) as Total FROM Orders GROUP BY OrderDate ORDER BY OrderDate');
        // Top Selling Products
        const topSelling = await query(req, `
            SELECT p.ProductName, SUM(od.Quantity) as TotalSold 
            FROM OrderDetails od 
            JOIN Products p ON od.ProductID = p.ProductID 
            GROUP BY p.ProductID 
            ORDER BY TotalSold DESC LIMIT 5`);
        // Category-wise Sales
        const categorySales = await query(req, `
            SELECT p.Category, SUM(od.Price * od.Quantity) as TotalRev 
            FROM OrderDetails od 
            JOIN Products p ON od.ProductID = p.ProductID 
            GROUP BY p.Category`);
        const paymentMethods = await query(req, 'SELECT PaymentMethod, COUNT(*) as count FROM Payment GROUP BY PaymentMethod');
        const deliveryStatus = await query(req, 'SELECT DeliveryStatus, COUNT(*) as count FROM Delivery GROUP BY DeliveryStatus');
        const stockLevels = await query(req, 'SELECT ProductName, StockQuantity FROM Products LIMIT 10');

        res.json({ salesTrend, topSelling, categorySales, paymentMethods, deliveryStatus, stockLevels });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. ADVANCED ANALYSIS
router.get('/advanced-analysis', async (req, res) => {
    try {
        const revenue = await query(req, 'SELECT SUM(TotalAmount) as sum FROM Orders');
        const totalRev = revenue[0].sum || 0;
        const profit = totalRev * 0.3; // Cost = 70%, Profit = 30%

        const bestProduct = await query(req, `
            SELECT p.ProductName, SUM(od.Quantity) as q FROM OrderDetails od 
            JOIN Products p ON p.ProductID = od.ProductID 
            GROUP BY p.ProductID ORDER BY q DESC LIMIT 1`);
        
        const worstProduct = await query(req, `
            SELECT p.ProductName, SUM(od.Quantity) as q FROM OrderDetails od 
            JOIN Products p ON p.ProductID = od.ProductID 
            GROUP BY p.ProductID ORDER BY q ASC LIMIT 1`);

        const bestCtx = await query(req, `
            SELECT c.Name, COUNT(o.OrderID) as oCount FROM Orders o 
            JOIN Customers c ON c.CustomerID = o.CustomerID 
            GROUP BY o.CustomerID ORDER BY oCount DESC LIMIT 1`);
            
        const pendingDel = await query(req, 'SELECT COUNT(*) as count FROM Delivery WHERE DeliveryStatus = "Pending"');

        res.json({
            totalRevenue: totalRev,
            estimatedProfit: profit,
            bestSellingProduct: bestProduct[0]? bestProduct[0].ProductName : 'N/A',
            leastSellingProduct: worstProduct[0]? worstProduct[0].ProductName : 'N/A',
            mostActiveCustomer: bestCtx[0]? bestCtx[0].Name : 'N/A',
            pendingDeliveries: pendingDel[0]? pendingDel[0].count : 0
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. GENERIC CRUD ENDPOINTS
const tables = ['Products', 'Orders', 'Customers', 'Suppliers', 'Payment', 'Delivery', 'Retailer', 'Wholesaler'];

tables.forEach(table => {
    router.get(`/${table.toLowerCase()}`, async (req, res) => {
        try {
            const data = await query(req, `SELECT * FROM ${table}`);
            res.json(data);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    // Detailed Orders logic
    if (table === 'Orders') {
        router.get(`/orders/:id`, async (req, res) => {
            try {
                const order = await query(req, `SELECT * FROM Orders WHERE OrderID = ?`, [req.params.id]);
                const details = await query(req, `
                    SELECT od.*, p.ProductName 
                    FROM OrderDetails od 
                    JOIN Products p ON od.ProductID = p.ProductID 
                    WHERE od.OrderID = ?`, [req.params.id]);
                res.json({ order: order[0], details });
            } catch(e) { res.status(500).json({error: e.message}); }
        });
    }
});

module.exports = router;
