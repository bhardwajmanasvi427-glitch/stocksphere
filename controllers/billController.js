const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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

exports.generateBill = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Fetch Order details
        const orderData = await dbHelper.query(req.db, 
            'SELECT o.*, c.Name as CustomerName FROM Orders o JOIN Customers c ON o.CustomerID = c.CustomerID WHERE o.OrderID = ?', 
            [orderId]
        );
        
        if (orderData.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }
        
        const order = orderData[0];
        const products = await dbHelper.query(req.db, 
            'SELECT od.*, p.ProductName FROM OrderDetails od JOIN Products p ON od.ProductID = p.ProductID WHERE od.OrderID = ?', 
            [orderId]
        );

        const doc = new PDFDocument();
        const fileName = `invoice_${orderId}.pdf`;
        const filePath = path.join(__dirname, '..', 'bills', fileName);
        
        // Pipe to file
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        // PDF Content
        doc.fontSize(25).text('StockSphere - Inventory System', { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).text(`Invoice for Order ID: ${orderId}`);
        doc.text(`Date: ${order.OrderDate}`);
        doc.text(`Customer: ${order.CustomerName}`);
        doc.moveDown();
        
        doc.text('Products:', { underline: true });
        products.forEach(p => {
            doc.text(`${p.ProductName} - Qty: ${p.Quantity} x ₹${p.Price} = ₹${p.Quantity * p.Price}`);
        });
        
        doc.moveDown();
        doc.fontSize(20).text(`Total Amount: ₹${order.TotalAmount}`, { align: 'right' });

        doc.end();

        writeStream.on('finish', () => {
            // Optional: Stream back to user
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
            fs.createReadStream(filePath).pipe(res);
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
