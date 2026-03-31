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

    function loadExcel(filename, table, columns, mapFn) {
        try {
            const filepath = path.resolve(__dirname, '..', filename);
            if (fs.existsSync(filepath)) {
                const workbook = xlsx.readFile(filepath);
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = xlsx.utils.sheet_to_json(sheet);
                const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
                data.forEach(row => {
                    const mapped = mapFn(row);
                    stmt.run(...mapped, err => { if (err) console.log(err.message) });
                });
                stmt.finalize();
                console.log(`Loaded ${data.length} records into ${table} from ${filename}`);
            }
        } catch (e) { console.error('Error loading excel', filename, e); }
    }

    // Load Excel Data
    loadExcel('StockSphere_200Rows (1).xlsx', 'Suppliers', ['SupplierID', 'SupplierName', 'Contact', 'Email', 'Address'], r => [r.SupplierID, r.SupplierName, r.Contact, r.Email, r.Address]);
    loadExcel('StockSphere_Payment_Delivery_FIXED.xlsx', 'Payment', ['PaymentID', 'OrderID', 'PaymentMethod', 'PaymentStatus'], r => [r.PaymentID, r.OrderID, r.PaymentMethod, r.PaymentStatus]);
    loadExcel('StockSphere_Retailer_Wholesaler.xlsx', 'Wholesaler', ['WholesalerID', 'WholesalerName', 'Contact', 'Address', 'GSTNumber'], r => [r.WholesalerID, r.WholesalerName, r.Contact, r.Address, r.GSTNumber]);

    // Programmatically Generate 200 Records for each remaining table
    const categories = ['Dairy', 'Bakery', 'Beverages', 'Snacks', 'Pantry'];
    const statuses = ['Delivered', 'Pending', 'In Transit'];

    // 200 Products
    const prodStmt = db.prepare(`INSERT INTO Products (ProductName, Category, Price, StockQuantity) VALUES (?, ?, ?, ?)`);
    for (let i = 1; i <= 200; i++) {
        prodStmt.run(
            `Product ${i}`,
            categories[Math.floor(Math.random() * categories.length)],
            parseFloat((Math.random() * 900 + 10).toFixed(2)),
            Math.floor(Math.random() * 200)
        );
    }
    prodStmt.finalize();

    // 200 Customers
    const custStmt = db.prepare(`INSERT INTO Customers (Name, Contact, Address) VALUES (?, ?, ?)`);
    for (let i = 1; i <= 200; i++) {
        custStmt.run(`Customer ${i}`, `98765${i.toString().padStart(5, '0')}`, `${i} Main St`);
    }
    custStmt.finalize();

    // 200 Orders
    const ordStmt = db.prepare(`INSERT INTO Orders (CustomerID, OrderDate, TotalAmount) VALUES (?, ?, ?)`);
    for (let i = 1; i <= 200; i++) {
        const month = String(Math.floor(Math.random() * 12 + 1)).padStart(2, '0');
        const day = String(Math.floor(Math.random() * 28 + 1)).padStart(2, '0');
        ordStmt.run(
            Math.floor(Math.random() * 200) + 1,
            `2026-${month}-${day}`,
            parseFloat((Math.random() * 4950 + 50).toFixed(2))
        );
    }
    ordStmt.finalize();

    // 200 Order Details
    const odStmt = db.prepare(`INSERT INTO OrderDetails (OrderID, ProductID, Quantity, Price) VALUES (?, ?, ?, ?)`);
    for (let i = 1; i <= 200; i++) {
        odStmt.run(
            Math.floor(Math.random() * 200) + 1,
            Math.floor(Math.random() * 200) + 1,
            Math.floor(Math.random() * 20) + 1,
            parseFloat((Math.random() * 900 + 10).toFixed(2))
        );
    }
    odStmt.finalize();

    // 200 Deliveries
    const delStmt = db.prepare(`INSERT INTO Delivery (OrderID, DeliveryStatus, DeliveryDate) VALUES (?, ?, ?)`);
    for (let i = 1; i <= 200; i++) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const date = status === 'Delivered' ? `2026-03-${String(Math.floor(Math.random() * 28 + 1)).padStart(2, '0')}` : '';
        delStmt.run(Math.floor(Math.random() * 200) + 1, status, date);
    }
    delStmt.finalize();

    // 200 Retailers
    const retStmt = db.prepare(`INSERT INTO Retailer (RetailerName, Contact, Address) VALUES (?, ?, ?)`);
    for (let i = 1; i <= 200; i++) {
        retStmt.run(`Retailer ${i}`, `555-${i.toString().padStart(4, '0')}`, `Address ${i}`);
    }
    retStmt.finalize();

    console.log('Database seeded and ready.');
});
db.close();
