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

const checkAndAutoOrder = async (db, productId) => {
    try {
        const productData = await dbHelper.query(db, 'SELECT * FROM Products WHERE ProductID = ?', [productId]);
        if (productData.length === 0) return;
        
        const product = productData[0];
        if (product.StockQuantity < 10) {
            console.log(`Low stock detected for ${product.ProductName}. Placing auto-order...`);
            
            const restockQty = 50;
            const totalAmount = restockQty * product.Price;
            const orderDate = new Date().toISOString().split('T')[0];
            
            // CustomerID = 0 represents the system/supplier for restock
            const result = await dbHelper.run(db, 
                'INSERT INTO Orders (CustomerID, OrderDate, TotalAmount, isAutoOrder) VALUES (?, ?, ?, ?)', 
                [0, orderDate, totalAmount, 1]
            );
            
            const orderId = result.lastID;
            
            // Add detail
            await dbHelper.run(db, 
                'INSERT INTO OrderDetails (OrderID, ProductID, Quantity, Price) VALUES (?, ?, ?, ?)', 
                [orderId, productId, restockQty, product.Price]
            );
            
            // Increase stock
            await dbHelper.run(db, 
                'UPDATE Products SET StockQuantity = StockQuantity + ? WHERE ProductID = ?', 
                [restockQty, productId]
            );
            
            console.log(`Auto-order placed for ${product.ProductName}. New stock: ${product.StockQuantity + restockQty}`);
        }
    } catch (e) {
        console.error('Auto-order error:', e);
    }
};

exports.placeOrder = async (req, res) => {
    try {
        const { productID, quantity, price } = req.body;
        const total = quantity * price;
        const role = req.session.user.role;
        const customerId = role === 'admin' ? 1 : (role === 'retailer' ? 1 : 1); // Mock mapping

        const orderDate = new Date().toISOString().split('T')[0];
        
        const result = await dbHelper.run(req.db, 
            'INSERT INTO Orders (CustomerID, OrderDate, TotalAmount, isAutoOrder) VALUES (?, ?, ?, 0)', 
            [customerId, orderDate, total]
        );
        const orderId = result.lastID;

        await dbHelper.run(req.db, 
            'INSERT INTO OrderDetails (OrderID, ProductID, Quantity, Price) VALUES (?, ?, ?, ?)', 
            [orderId, productID, quantity, price]
        );
        
        await dbHelper.run(req.db, 
            'UPDATE Products SET StockQuantity = StockQuantity - ? WHERE ProductID = ?', 
            [quantity, productID]
        );

        // TRIGGER AUTO ORDER CHECK
        await checkAndAutoOrder(req.db, productID);

        res.json({ success: true, message: 'Order placed successfully', orderId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getAutoOrders = async (req, res) => {
    try {
        const data = await dbHelper.query(req.db, `
            SELECT o.OrderID, p.ProductName, p.StockQuantity as CurrentStock, o.OrderDate, o.isAutoOrder 
            FROM Orders o 
            JOIN OrderDetails od ON o.OrderID = od.OrderID
            JOIN Products p ON od.ProductID = p.ProductID
            WHERE o.isAutoOrder = 1
            ORDER BY o.OrderDate DESC
        `);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.checkAndAutoOrder = checkAndAutoOrder; 
