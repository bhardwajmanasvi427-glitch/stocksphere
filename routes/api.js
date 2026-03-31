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

// Role Middleware
const requireRole = (roles) => (req, res, next) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
};

const RETAILER_MOCK_ID = 1;

// 1. DASHBOARD STATS
router.get('/dashboard-stats', async (req, res) => {
    try {
        const role = req.session?.user?.role || 'admin';
        let stats = {};

        if (role === 'admin') {
            const productsCount = await query(req, 'SELECT COUNT(*) as count FROM Products');
            const ordersCount = await query(req, 'SELECT COUNT(*) as count FROM Orders');
            const revenue = await query(req, 'SELECT SUM(TotalAmount) as sum FROM Orders');
            const customersCount = await query(req, 'SELECT COUNT(*) as count FROM Customers');
            const lowStockCount = await query(req, 'SELECT COUNT(*) as count FROM Products WHERE StockQuantity < 10');

            stats = {
                role: 'admin',
                products: productsCount[0].count,
                orders: ordersCount[0].count,
                revenue: revenue[0].sum || 0,
                customers: customersCount[0].count,
                lowStock: lowStockCount[0].count
            };
        } else if (role === 'retailer') {
            const ordersCount = await query(req, 'SELECT COUNT(*) as count FROM Orders WHERE CustomerID = ?', [RETAILER_MOCK_ID]);
            const spent = await query(req, 'SELECT SUM(TotalAmount) as sum FROM Orders WHERE CustomerID = ?', [RETAILER_MOCK_ID]);
            const availableProducts = await query(req, 'SELECT COUNT(*) as count FROM Products WHERE StockQuantity > 0');

            stats = {
                role: 'retailer',
                orders: ordersCount[0].count,
                spent: spent[0].sum || 0,
                availableProducts: availableProducts[0].count
            };
        } else if (role === 'wholesaler') {
            const deliveries = await query(req, 'SELECT COUNT(*) as count FROM Delivery');
            const pendingDeliveries = await query(req, 'SELECT COUNT(*) as count FROM Delivery WHERE DeliveryStatus = "Pending"');
            const productsCount = await query(req, 'SELECT COUNT(*) as count FROM Products');

            stats = {
                role: 'wholesaler',
                totalDeliveries: deliveries[0].count,
                pendingDeliveries: pendingDeliveries[0].count,
                totalProducts: productsCount[0].count
            };
        }

        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. ANALYTICS (Graphs data) - Admin/Wholesaler
router.get('/analytics', requireRole(['admin', 'wholesaler']), async (req, res) => {
    try {
        const role = req.session.user.role;
        
        let salesTrend = [], topSelling = [], categorySales = [], paymentMethods = [], deliveryStatus = [], stockLevels = [];
        
        if (role === 'admin' || role === 'wholesaler') {
            salesTrend = await query(req, 'SELECT OrderDate, SUM(TotalAmount) as Total FROM Orders GROUP BY OrderDate ORDER BY OrderDate');
            topSelling = await query(req, `SELECT p.ProductName, SUM(od.Quantity) as TotalSold FROM OrderDetails od JOIN Products p ON od.ProductID = p.ProductID GROUP BY p.ProductID ORDER BY TotalSold DESC LIMIT 5`);
            categorySales = await query(req, `SELECT p.Category, SUM(od.Price * od.Quantity) as TotalRev FROM OrderDetails od JOIN Products p ON od.ProductID = p.ProductID GROUP BY p.Category`);
            deliveryStatus = await query(req, 'SELECT DeliveryStatus, COUNT(*) as count FROM Delivery GROUP BY DeliveryStatus');
            stockLevels = await query(req, 'SELECT ProductName, StockQuantity FROM Products LIMIT 10');
        }
        
        if (role === 'admin') {
             paymentMethods = await query(req, 'SELECT PaymentMethod, COUNT(*) as count FROM Payment GROUP BY PaymentMethod');
        }

        res.json({ salesTrend, topSelling, categorySales, paymentMethods, deliveryStatus, stockLevels });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. ADVANCED ANALYSIS (Admin only)
router.get('/advanced-analysis', requireRole(['admin']), async (req, res) => {
    try {
        const revenue = await query(req, 'SELECT SUM(TotalAmount) as sum FROM Orders');
        const profit = (revenue[0].sum || 0) * 0.3; 

        const bestProduct = await query(req, `SELECT p.ProductName, SUM(od.Quantity) as q FROM OrderDetails od JOIN Products p ON p.ProductID = od.ProductID GROUP BY p.ProductID ORDER BY q DESC LIMIT 1`);
        const worstProduct = await query(req, `SELECT p.ProductName, SUM(od.Quantity) as q FROM OrderDetails od JOIN Products p ON p.ProductID = od.ProductID GROUP BY p.ProductID ORDER BY q ASC LIMIT 1`);
        const bestCtx = await query(req, `SELECT c.Name, COUNT(o.OrderID) as oCount FROM Orders o JOIN Customers c ON c.CustomerID = o.CustomerID GROUP BY o.CustomerID ORDER BY oCount DESC LIMIT 1`);
        const pendingDel = await query(req, 'SELECT COUNT(*) as count FROM Delivery WHERE DeliveryStatus = "Pending"');

        res.json({
            totalRevenue: revenue[0].sum || 0,
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


// 4. ACTION ENDPOINTS

// Retailer placing order
router.post('/orders', requireRole(['admin', 'retailer']), async (req, res) => {
    try {
        const { productID, quantity, price } = req.body;
        const total = quantity * price;
        const customerId = req.session.user.role === 'admin' ? 1 : RETAILER_MOCK_ID; 

        const orderDate = new Date().toISOString().split('T')[0];
        
        // Insert order
        const insertOrder = await runQuery(req, `INSERT INTO Orders (CustomerID, OrderDate, TotalAmount) VALUES (?, ?, ?)`, [customerId, orderDate, total]);
        const orderId = insertOrder.lastID;

        // Insert OD
        await runQuery(req, `INSERT INTO OrderDetails (OrderID, ProductID, Quantity, Price) VALUES (?, ?, ?, ?)`, [orderId, productID, quantity, price]);
        
        // Reduce stock
        await runQuery(req, `UPDATE Products SET StockQuantity = StockQuantity - ? WHERE ProductID = ?`, [quantity, productID]);

        // Add pending delivery
        await runQuery(req, `INSERT INTO Delivery (OrderID, DeliveryStatus, DeliveryDate) VALUES (?, 'Pending', '')`, [orderId]);

        res.json({ success: true, message: 'Order created successfully!' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Wholesaler updating delivery
router.put('/delivery/:id', requireRole(['admin', 'wholesaler']), async (req, res) => {
    try {
        const { status } = req.body;
        const date = status === 'Delivered' ? new Date().toISOString().split('T')[0] : '';
        await runQuery(req, `UPDATE Delivery SET DeliveryStatus = ?, DeliveryDate = ? WHERE DeliveryID = ?`, [status, date, req.params.id]);
        res.json({ success: true, message: 'Delivery updated' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Generic Read filters
router.get('/products', async (req, res) => {
    try {
        const data = await query(req, `SELECT * FROM Products`);
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/orders', async (req, res) => {
    try {
        const role = req.session?.user?.role;
        let data = [];
        if (role === 'retailer') {
            data = await query(req, `SELECT * FROM Orders WHERE CustomerID = ?`, [RETAILER_MOCK_ID]);
        } else {
            data = await query(req, `SELECT * FROM Orders`);
        }
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Everything else 
const otherTables = ['Customers', 'Suppliers', 'Payment', 'Delivery', 'Retailer', 'Wholesaler'];
otherTables.forEach(table => {
    router.get(`/${table.toLowerCase()}`, async (req, res) => {
        try {
            const data = await query(req, `SELECT * FROM ${table}`);
            res.json(data);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
});
// Special plural map for payment for the user's previously added route
router.get('/payment', async (req, res) => {
    try {
        const data = await query(req, 'SELECT * FROM Payment');
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
