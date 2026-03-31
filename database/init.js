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
            if(fs.existsSync(filepath)) {
                const workbook = xlsx.readFile(filepath);
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = xlsx.utils.sheet_to_json(sheet);
                const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
                data.forEach(row => {
                    const mapped = mapFn(row);
                    stmt.run(...mapped, err => { if(err) console.log(err.message) });
                });
                stmt.finalize();
                console.log(`Loaded ${data.length} records into ${table} from ${filename}`);
            }
        } catch(e) { console.error('Error loading excel', filename, e); }
    }

    // Load Excel Data
    loadExcel('StockSphere_200Rows (1).xlsx', 'Suppliers', ['SupplierID', 'SupplierName', 'Contact', 'Email', 'Address'], r => [r.SupplierID, r.SupplierName, r.Contact, r.Email, r.Address]);
    loadExcel('StockSphere_Payment_Delivery_FIXED.xlsx', 'Payment', ['PaymentID', 'OrderID', 'PaymentMethod', 'PaymentStatus'], r => [r.PaymentID, r.OrderID, r.PaymentMethod, r.PaymentStatus]);
    loadExcel('StockSphere_Retailer_Wholesaler.xlsx', 'Wholesaler', ['WholesalerID', 'WholesalerName', 'Contact', 'Address', 'GSTNumber'], r => [r.WholesalerID, r.WholesalerName, r.Contact, r.Address, r.GSTNumber]);

    // Sample Products
    const prodStmt = db.prepare(`INSERT INTO Products (ProductName, Category, Price, StockQuantity) VALUES (?, ?, ?, ?)`);
    const products = [
        ['Organic Milk', 'Dairy', 50, 150], ['Whole Wheat Bread', 'Bakery', 40, 50],
        ['Premium Coffee', 'Beverages', 450, 5], ['Green Tea', 'Beverages', 200, 45],
        ['Almonds', 'Snacks', 600, 8], ['Olive Oil', 'Pantry', 800, 30],
        ['Apple Juice', 'Beverages', 120, 100], ['Dark Chocolate', 'Snacks', 150, 2]
    ];
    products.forEach(p => prodStmt.run(...p));
    prodStmt.finalize();

    // Sample Customers
    const custStmt = db.prepare(`INSERT INTO Customers (Name, Contact, Address) VALUES (?, ?, ?)`);
    custStmt.run('Alice Smith', '9876543210', '123 Main St');
    custStmt.run('Bob Jones', '9876543211', '456 Oak Ave');
    custStmt.run('Charlie Brown', '9876543212', '789 Pine Road');
    custStmt.finalize();

    // Sample Orders
    const ordStmt = db.prepare(`INSERT INTO Orders (CustomerID, OrderDate, TotalAmount) VALUES (?, ?, ?)`);
    ordStmt.run(1, '2026-03-01', 500);
    ordStmt.run(2, '2026-03-05', 1250);
    ordStmt.run(3, '2026-03-10', 800);
    ordStmt.run(1, '2026-03-15', 300);
    ordStmt.run(2, '2026-03-20', 2100);
    ordStmt.finalize();
    
    // Sample Order Details
    const odStmt = db.prepare(`INSERT INTO OrderDetails (OrderID, ProductID, Quantity, Price) VALUES (?, ?, ?, ?)`);
    odStmt.run(1, 1, 10, 50);
    odStmt.run(2, 3, 2, 450);
    odStmt.run(2, 4, 1, 200);
    odStmt.run(3, 2, 20, 40);
    odStmt.run(4, 8, 2, 150);
    odStmt.finalize();

    // Sample Deliveries
    const delStmt = db.prepare(`INSERT INTO Delivery (OrderID, DeliveryStatus, DeliveryDate) VALUES (?, ?, ?)`);
    delStmt.run(1, 'Delivered', '2026-03-03');
    delStmt.run(2, 'Delivered', '2026-03-07');
    delStmt.run(3, 'Pending', '');
    delStmt.run(4, 'Pending', '');
    delStmt.run(5, 'Pending', '');
    delStmt.finalize();

    // Sample Retailers
    const retStmt = db.prepare(`INSERT INTO Retailer (RetailerName, Contact, Address) VALUES (?, ?, ?)`);
    retStmt.run('City Supermart', '555-0192', 'Downtown Square');
    retStmt.run('QuickMart', '555-1111', 'Uptown Blvd');
    retStmt.finalize();

    console.log('Database seeded and ready.');
});
db.close();
