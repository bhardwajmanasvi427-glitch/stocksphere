const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Initializing database at:', dbPath);

db.serialize(() => {
    // Drop existing
    const tables = ['Admin', 'Products', 'Suppliers', 'Customers', 'Orders', 'OrderDetails', 'Payment', 'Delivery', 'Retailer', 'Wholesaler'];
    tables.forEach(t => db.run(`DROP TABLE IF EXISTS ${t}`));

    // CREATE TABLES
    db.run(`CREATE TABLE Admin (AdminID INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT, Password TEXT)`);
    db.run(`CREATE TABLE Products (ProductID INTEGER PRIMARY KEY AUTOINCREMENT, ProductName TEXT, Category TEXT, Price REAL, StockQuantity INTEGER)`);
    db.run(`CREATE TABLE Suppliers (SupplierID INTEGER PRIMARY KEY, SupplierName TEXT, Contact TEXT, Email TEXT, Address TEXT)`);
    db.run(`CREATE TABLE Customers (CustomerID INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT, Contact TEXT, Address TEXT)`);
    db.run(`CREATE TABLE Orders (OrderID INTEGER PRIMARY KEY AUTOINCREMENT, CustomerID INTEGER, OrderDate TEXT, TotalAmount REAL)`);
    db.run(`CREATE TABLE OrderDetails (OrderDetailID INTEGER PRIMARY KEY AUTOINCREMENT, OrderID INTEGER, ProductID INTEGER, Quantity INTEGER, Price REAL)`);
    db.run(`CREATE TABLE Payment (PaymentID INTEGER PRIMARY KEY, OrderID INTEGER, PaymentMethod TEXT, PaymentStatus TEXT)`);
    db.run(`CREATE TABLE Delivery (DeliveryID INTEGER PRIMARY KEY AUTOINCREMENT, OrderID INTEGER, DeliveryStatus TEXT, DeliveryDate TEXT)`);
    db.run(`CREATE TABLE Retailer (RetailerID INTEGER PRIMARY KEY AUTOINCREMENT, RetailerName TEXT, Contact TEXT, Address TEXT)`);
    db.run(`CREATE TABLE Wholesaler (WholesalerID INTEGER PRIMARY KEY, WholesalerName TEXT, Contact TEXT, Address TEXT, GSTNumber TEXT)`);

    // Insert Default admin user
    db.run(`INSERT INTO Admin (Name, Password) VALUES ('admin', 'admin123')`);
    db.run(`INSERT INTO Admin (Name, Password) VALUES ('retailer', 'retailer123')`);
    db.run(`INSERT INTO Admin (Name, Password) VALUES ('wholesaler', 'wholesaler123')`);

    function loadExcel(filename, sheetName, table, columns, mapFn) {
        try {
            const filepath = path.resolve(__dirname, '..', filename);
            if (fs.existsSync(filepath)) {
                const workbook = xlsx.readFile(filepath);
                const sheet = workbook.Sheets[sheetName];
                if (sheet) {
                    const data = xlsx.utils.sheet_to_json(sheet);
                    const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
                    data.forEach(row => {
                        const mapped = mapFn(row);
                        stmt.run(...mapped, err => { if (err) console.log(err.message) });
                    });
                    stmt.finalize();
                    console.log(`Loaded ${data.length} records into ${table} from ${filename} (${sheetName})`);
                }
            }
        } catch (e) { console.error('Error loading excel', filename, sheetName, e); }
    }

    // Load ALL exact Excel Data
    loadExcel('StockSphere_200Rows (1).xlsx', 'Suppliers', 'Suppliers', ['SupplierID', 'SupplierName', 'Contact', 'Email', 'Address'], r => [r.SupplierID, r.SupplierName, r.Contact, r.Email, r.Address]);
    loadExcel('StockSphere_200Rows (1).xlsx', 'Products', 'Products', ['ProductID', 'ProductName', 'Category', 'Price', 'StockQuantity'], r => [r.ProductID, r.ProductName, r.Category, r.Price, r.Stock]);
    loadExcel('StockSphere_200Rows (1).xlsx', 'Customers', 'Customers', ['CustomerID', 'Name', 'Contact', 'Address'], r => [r.CustomerID, r.CustomerName, r.Phone, r.Address]);
    loadExcel('StockSphere_200Rows (1).xlsx', 'Orders', 'Orders', ['OrderID', 'CustomerID', 'OrderDate', 'TotalAmount'], r => [r.OrderID, r.CustomerID, r.OrderDate, r.TotalAmount]);
    loadExcel('StockSphere_200Rows (1).xlsx', 'OrderDetails', 'OrderDetails', ['OrderDetailID', 'OrderID', 'ProductID', 'Quantity', 'Price'], r => [r.OrderDetailID, r.OrderID, r.ProductID, r.Quantity, r.Price]);

    loadExcel('StockSphere_Payment_Delivery_FIXED.xlsx', 'Payment', 'Payment', ['PaymentID', 'OrderID', 'PaymentMethod', 'PaymentStatus'], r => [r.PaymentID, r.OrderID, r.PaymentMethod, r.PaymentStatus]);
    loadExcel('StockSphere_Payment_Delivery_FIXED.xlsx', 'Delivery', 'Delivery', ['DeliveryID', 'OrderID', 'DeliveryStatus', 'DeliveryDate'], r => [r.DeliveryID, r.OrderID, r.DeliveryStatus, r.DeliveryDate]);

    loadExcel('StockSphere_Retailer_Wholesaler.xlsx', 'Wholesaler', 'Wholesaler', ['WholesalerID', 'WholesalerName', 'Contact', 'Address', 'GSTNumber'], r => [r.WholesalerID, r.WholesalerName, r.Contact, r.Address, r.GSTNumber]);
    loadExcel('StockSphere_Retailer_Wholesaler.xlsx', 'Retailer', 'Retailer', ['RetailerID', 'RetailerName', 'Contact', 'Address'], r => [r.RetailerID, r.RetailerName, r.Contact, r.Address]);

    // Guarantee that the Retailer persona (CustomerID = 1) has beautiful historical records for charting
    db.run(`INSERT INTO Orders (CustomerID, OrderDate, TotalAmount) VALUES (1, '2026-03-01', 1200.50)`);
    db.run(`INSERT INTO Orders (CustomerID, OrderDate, TotalAmount) VALUES (1, '2026-03-02', 805.00)`);
    db.run(`INSERT INTO Orders (CustomerID, OrderDate, TotalAmount) VALUES (1, '2026-03-12', 450.25)`);
    db.run(`INSERT INTO Orders (CustomerID, OrderDate, TotalAmount) VALUES (1, '2026-03-15', 3400.00)`);
    db.run(`INSERT INTO Orders (CustomerID, OrderDate, TotalAmount) VALUES (1, '2026-03-22', 1700.75)`);
    db.run(`INSERT INTO Orders (CustomerID, OrderDate, TotalAmount) VALUES (1, '2026-03-28', 890.00)`);
    
    // Inject detail links dynamically using last orders logic
    db.run(`INSERT INTO OrderDetails (OrderID, ProductID, Quantity, Price) 
            SELECT OrderID, 1, 5, 240.10 FROM Orders WHERE CustomerID = 1 AND OrderDate = '2026-03-01'`);
    db.run(`INSERT INTO OrderDetails (OrderID, ProductID, Quantity, Price) 
            SELECT OrderID, 2, 8, 100.62 FROM Orders WHERE CustomerID = 1 AND OrderDate = '2026-03-02'`);
    db.run(`INSERT INTO OrderDetails (OrderID, ProductID, Quantity, Price) 
            SELECT OrderID, 5, 10, 45.02 FROM Orders WHERE CustomerID = 1 AND OrderDate = '2026-03-12'`);
    db.run(`INSERT INTO OrderDetails (OrderID, ProductID, Quantity, Price) 
            SELECT OrderID, 3, 20, 170.00 FROM Orders WHERE CustomerID = 1 AND OrderDate = '2026-03-15'`);
    db.run(`INSERT INTO OrderDetails (OrderID, ProductID, Quantity, Price) 
            SELECT OrderID, 6, 12, 141.72 FROM Orders WHERE CustomerID = 1 AND OrderDate = '2026-03-22'`);
    db.run(`INSERT INTO OrderDetails (OrderID, ProductID, Quantity, Price) 
            SELECT OrderID, 1, 3, 296.66 FROM Orders WHERE CustomerID = 1 AND OrderDate = '2026-03-28'`);

    setTimeout(() => { console.log('Database seeded and ready.'); }, 500);
});
db.close();
