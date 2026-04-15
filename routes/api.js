const express = require('express');
const router = express.Router();

// Controllers
const analyticsCtrl = require('../controllers/analyticsController');
const expenseCtrl = require('../controllers/expenseController');
const paymentCtrl = require('../controllers/paymentController');
const orderCtrl = require('../controllers/orderController');
const billCtrl = require('../controllers/billController');


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

// 2. ANALYTICS (Graphs data) - Admin/Wholesaler/Retailer
router.get('/analytics', requireRole(['admin', 'wholesaler', 'retailer']), async (req, res) => {
    try {
        const role = req.session.user.role;
        
        let salesTrend = [], topSelling = [], categorySales = [], paymentMethods = [], deliveryStatus = [], stockLevels = [];
        let spendingTrend = [], topPurchases = [];
        
        if (role === 'admin' || role === 'wholesaler') {
            salesTrend = await query(req, 'SELECT OrderDate, SUM(TotalAmount) as Total FROM Orders GROUP BY OrderDate ORDER BY OrderDate');
            topSelling = await query(req, `SELECT p.ProductName, SUM(od.Quantity) as TotalSold FROM OrderDetails od JOIN Products p ON od.ProductID = p.ProductID GROUP BY p.ProductID ORDER BY TotalSold DESC LIMIT 5`);
            categorySales = await query(req, `SELECT p.Category, SUM(od.Price * od.Quantity) as TotalRev FROM OrderDetails od JOIN Products p ON od.ProductID = p.ProductID GROUP BY p.Category`);
            deliveryStatus = await query(req, 'SELECT DeliveryStatus, COUNT(*) as count FROM Delivery GROUP BY DeliveryStatus');
            stockLevels = await query(req, 'SELECT ProductName, StockQuantity FROM Products LIMIT 10');
        }
        
        if (role === 'retailer') {
            spendingTrend = await query(req, 'SELECT OrderDate, SUM(TotalAmount) as Total FROM Orders WHERE CustomerID = ? GROUP BY OrderDate ORDER BY OrderDate', [RETAILER_MOCK_ID]);
            topPurchases = await query(req, `SELECT p.ProductName, SUM(od.Quantity) as TotalSold FROM OrderDetails od JOIN Products p ON od.ProductID = p.ProductID JOIN Orders o ON o.OrderID = od.OrderID WHERE o.CustomerID = ? GROUP BY p.ProductID ORDER BY TotalSold DESC LIMIT 5`, [RETAILER_MOCK_ID]);
        }

        if (role === 'admin') {
             paymentMethods = await query(req, 'SELECT PaymentMethod, COUNT(*) as count FROM Payment GROUP BY PaymentMethod');
        }

        res.json({ salesTrend, topSelling, categorySales, paymentMethods, deliveryStatus, stockLevels, spendingTrend, topPurchases, role });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// FEATURE 1: PROFIT & REVENUE ANALYTICS REPORT
router.get('/analytics/report', requireRole(['admin']), analyticsCtrl.getAnalytics);


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

// FEATURE 2: EXPENSE MANAGEMENT
router.get('/expenses', requireRole(['admin']), expenseCtrl.getExpenses);
router.post('/expenses', requireRole(['admin']), expenseCtrl.addExpense);

// FEATURE 3: BILL GENERATION (PDF)
router.post('/generate-bill/:orderId', requireRole(['admin', 'retailer', 'wholesaler']), billCtrl.generateBill);

// FEATURE 4: PAYMENTS SECTION
router.get('/payments/:retailerId', requireRole(['admin', 'retailer']), paymentCtrl.getPaymentsByRetailer);
router.get('/payments', requireRole(['admin']), paymentCtrl.getAllPayments);

// FEATURE 5: AUTO STOCK MANAGEMENT (VISIBILITY)
router.get('/auto-orders', requireRole(['admin']), orderCtrl.getAutoOrders);



// 4. ACTION ENDPOINTS

// Retailer placing order (Now handles auto-stock)
router.post('/orders', requireRole(['admin', 'retailer']), orderCtrl.placeOrder);


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
// Special plural map for payment for the user's previously added route
router.get('/payment', async (req, res) => {
    try {
        const data = await query(req, 'SELECT * FROM Payment');
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. EXPORT ENDPOINT
router.get('/export/:type/:timeframe', requireRole(['admin', 'wholesaler', 'retailer']), async (req, res) => {
    try {
        const { type, timeframe } = req.params;
        const role = req.session.user.role;
        let dateCondition = "";
        
        if (timeframe === 'daily') dateCondition = "AND OrderDate >= date((SELECT MAX(OrderDate) FROM Orders), '-1 day')";
        else if (timeframe === 'weekly') dateCondition = "AND OrderDate >= date((SELECT MAX(OrderDate) FROM Orders), '-7 days')";
        else if (timeframe === 'monthly') dateCondition = "AND OrderDate >= date((SELECT MAX(OrderDate) FROM Orders), '-1 month')";

        let data = [];
        if (type === 'sales') {
            let userCondition = role === 'retailer' ? `AND CustomerID = ${RETAILER_MOCK_ID}` : "";
            data = await query(req, `SELECT * FROM Orders WHERE 1=1 ${userCondition} ${dateCondition}`);
        } else if (type === 'stock') {
            data = await query(req, `SELECT * FROM Products`);
        }

        if (data.length === 0) {
            return res.status(404).send("No data found for export.");
        }

        const keys = Object.keys(data[0]);
        let csv = keys.join(',') + '\n';
        data.forEach(row => {
            csv += keys.map(k => {
                let v = row[k] === null ? '' : String(row[k]);
                v = v.replace(/"/g, '""');
                return `"${v}"`;
            }).join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${timeframe}.csv"`);
        res.send(csv);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// 6. GENERIC CRUD (Admin only)
router.post('/generic/:table', requireRole(['admin']), async (req, res) => {
    try {
        const { table } = req.params;
        const fields = Object.keys(req.body);
        const values = Object.values(req.body);
        const placeholders = fields.map(() => '?').join(',');
        await runQuery(req, `INSERT INTO ${table} (${fields.join(',')}) VALUES (${placeholders})`, values);
        res.json({ success: true, message: 'Record added successfully' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/generic/:table/:idField/:idValue', requireRole(['admin']), async (req, res) => {
    try {
        const { table, idField, idValue } = req.params;
        const fields = Object.keys(req.body);
        const values = Object.values(req.body);
        const updates = fields.map(f => `${f} = ?`).join(',');
        await runQuery(req, `UPDATE ${table} SET ${updates} WHERE ${idField} = ?`, [...values, idValue]);
        res.json({ success: true, message: 'Record updated successfully' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/generic/:table/:idField/:idValue', requireRole(['admin']), async (req, res) => {
    try {
        const { table, idField, idValue } = req.params;
        await runQuery(req, `DELETE FROM ${table} WHERE ${idField} = ?`, [idValue]);
        res.json({ success: true, message: 'Record deleted successfully' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
