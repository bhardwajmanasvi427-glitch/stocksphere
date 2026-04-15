const UI = {
    currentSort: { column: null, direction: 1 },
    lastTableData: [],
    lastHeaders: [],
    lastRole: '',
    lastEndpoint: '',
    
    renderTable(headers, data, role, endpoint, isSorting = false) {
        if (!isSorting) {
            this.lastTableData = [...data];
            this.lastHeaders = headers;
            this.lastRole = role;
            this.lastEndpoint = endpoint;
            this.currentSort = { column: null, direction: 1 };
        }
        
        const headRow = document.getElementById('table-head');
        const body = document.getElementById('table-body');
        
        headRow.innerHTML = '';
        body.innerHTML = '';

        // Add extra action header if needed
        let hasActions = false;
        if ((role === 'retailer' && endpoint === 'products') || (role === 'wholesaler' && endpoint === 'delivery') || role === 'admin') {
            hasActions = true;
        }

        // Setup headers
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            
            if (this.currentSort.column === h) {
                th.textContent += this.currentSort.direction === 1 ? ' ▲' : ' ▼';
            }
            
            th.style.cursor = 'pointer';
            th.style.userSelect = 'none';
            th.title = "Click to sort";
            th.onclick = () => {
                if (this.currentSort.column === h) {
                    this.currentSort.direction *= -1;
                } else {
                    this.currentSort.column = h;
                    this.currentSort.direction = 1;
                }
                document.getElementById('sort-column').value = this.currentSort.column;
                document.getElementById('sort-direction').value = this.currentSort.direction;
                UI.triggerSort();
            };
            
            headRow.appendChild(th);
        });
        if (hasActions) {
            const th = document.createElement('th');
            th.textContent = 'Actions';
            headRow.appendChild(th);
        }

        if (!data || data.length === 0) {
            body.innerHTML = '<tr><td colspan="100%">No records found.</td></tr>';
            return;
        }

        // Setup rows
        data.forEach(row => {
            const tr = document.createElement('tr');
            headers.forEach(h => {
                const td = document.createElement('td');
                // Format price if key implies price
                if (h.toLowerCase().includes('price') || h.toLowerCase().includes('amount') || h.toLowerCase().includes('revenue')) {
                    td.textContent = '₹ ' + Number(row[h]).toFixed(2);
                } else {
                    td.textContent = row[h];
                }
                tr.appendChild(td);
            });

            if (hasActions) {
                const td = document.createElement('td');
                
                if (endpoint === 'billing') {
                    const billBtn = document.createElement('button');
                    billBtn.className = 'btn btn-small btn-success';
                    billBtn.style.marginRight = '5px';
                    billBtn.textContent = '📄 Bill';
                    // We link to downloadBill using row.orderId which is now part of the schema
                    billBtn.onclick = () => UI.downloadBill(row.orderId);
                    td.appendChild(billBtn);
                }

                if (role === 'retailer' && endpoint === 'products') {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-small btn-success';
                    btn.textContent = 'Order 10 Units';
                    btn.onclick = () => UI.placeOrder(row.ProductID, row.Price, 10);
                    td.appendChild(btn);
                }
                else if (role === 'wholesaler' && endpoint === 'delivery') {
                    const select = document.createElement('select');
                    select.className = 'status-select';
                    ['Pending', 'In Transit', 'Delivered'].forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s;
                        opt.textContent = s;
                        if (row.DeliveryStatus === s) opt.selected = true;
                        select.appendChild(opt);
                    });
                    select.onchange = (e) => UI.updateDelivery(row.DeliveryID, e.target.value);
                    td.appendChild(select);
                }
                else if (role === 'admin') {
                    if (endpoint === 'orders') {
                        const billBtn = document.createElement('button');
                        billBtn.className = 'btn btn-small btn-success';
                        billBtn.style.marginRight = '5px';
                        billBtn.textContent = '📄 Bill';
                        billBtn.onclick = () => UI.downloadBill(row.OrderID);
                        td.appendChild(billBtn);
                    }

                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn btn-small btn-primary';
                    editBtn.style.marginRight = '5px';
                    editBtn.textContent = '✏️ Edit';
                    editBtn.onclick = () => UI.showCrudModal(row);
                    td.appendChild(editBtn);

                    const delBtn = document.createElement('button');
                    delBtn.className = 'btn btn-small btn-danger';
                    delBtn.textContent = '🗑️ Delete';
                    // Utilize numeric index 0 key for dynamic PK mapping 
                    const idField = Object.keys(row)[0]; 
                    delBtn.onclick = () => UI.deleteRecord(idField, row[idField]);
                    td.appendChild(delBtn);
                }
                tr.appendChild(td);
            }

            body.appendChild(tr);
        });
    },

    triggerSort() {
        const col = document.getElementById('sort-column').value;
        const dir = parseInt(document.getElementById('sort-direction').value);
        if(!col) return;
        
        this.currentSort.column = col;
        this.currentSort.direction = dir;
        
        this.lastTableData.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];
            
            if (!isNaN(valA) && !isNaN(valB) && valA !== null && valB !== null && valA !== "" && valB !== "") {
                return (Number(valA) - Number(valB)) * dir;
            }
            return String(valA || "").localeCompare(String(valB || "")) * dir;
        });
        
        this.renderTable(this.lastHeaders, this.lastTableData, this.lastRole, this.lastEndpoint, true);
    },

    async placeOrder(productID, basePrice, quantity) {
        if(!confirm('Place order for ' + quantity + ' units?')) return;
        try {
            const rr = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productID, quantity, price: basePrice })
            });
            const data = await rr.json();
            if (data.success) {
                alert(data.message || 'Order Placed');
                // AUTO DOWNLOAD PDF
                if (data.orderId) this.downloadBill(data.orderId);
                
                // REFRESH AUTO ORDERS LIST
                this.loadAutoOrders();
                
                document.querySelector('a[data-target="orders"]').click();
            } else {
                throw new Error(data.error || 'Failed to place order');
            }
        } catch(e) { alert('Order Error: ' + e.message); }
    },

    async updateDelivery(id, status) {
        try {
            const res = await fetch('/api/delivery/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const data = await res.json();
        } catch(e) { alert('Error: ' + e.message); }
    },

    filterTable(query) {
        const rows = document.querySelectorAll('#table-body tr');
        query = query.toLowerCase();
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },

    formatCurrency(val) {
        return '₹ ' + Number(val).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits:2});
    },

    showCrudModal(row = null) {
        const table = document.querySelector('.sidebar-nav a.active').getAttribute('data-target').toLowerCase();
        const properTable = table.charAt(0).toUpperCase() + table.slice(1);
        
        document.getElementById('modalTable').value = properTable;
        document.getElementById('modalTitle').textContent = row ? `Edit Record - ${properTable}` : `Add Record - ${properTable}`;
        document.getElementById('modalAction').value = row ? 'edit' : 'add';
        
        const fieldsDiv = document.getElementById('modalFields');
        fieldsDiv.innerHTML = '';
        
        const headerNodes = document.querySelectorAll('#table-head th');
        const headers = Array.from(headerNodes).map(th => th.textContent).filter(h => h !== 'Actions');
        
        if (row) {
            document.getElementById('modalIdField').value = headers[0];
            document.getElementById('modalIdValue').value = row[headers[0]];
        }

        headers.forEach((h, index) => {
             // Skip Primary Key in Add mode if it's named 'id' or 'ID' or is the first column
             if (!row && (h.toLowerCase() === 'id' || index === 0)) return;

             const group = document.createElement('div');
             group.className = 'input-group';
             const label = document.createElement('label');
             label.textContent = h;
             const input = document.createElement('input');
             input.type = 'text';
             input.name = h;
             input.style.boxSizing = "border-box";
             if (row) input.value = row[h];
             // Bind ReadOnly to dynamic PK logic on existing edits
             if (row && h === headers[0]) input.readOnly = true;

             group.appendChild(label);
             group.appendChild(input);
             fieldsDiv.appendChild(group);
        });

        document.getElementById('crudModal').classList.add('active');
    },

    async submitCrudForm(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        let params = {};
        for (let [key, val] of formData.entries()) {
            if (key !== 'modalTable' && key !== 'modalAction' && key !== 'modalIdField' && key !== 'modalIdValue') {
                params[key] = val;
            }
        }

        const table = document.getElementById('modalTable').value;
        const action = document.getElementById('modalAction').value;
        const idField = document.getElementById('modalIdField').value;
        const idValue = document.getElementById('modalIdValue').value;

        try {
            let url = `/api/generic/${table}`;
            let method = 'POST';

            if (action === 'edit') {
                url = `/api/generic/${table}/${idField}/${idValue}`;
                method = 'PUT';
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Request failed");
            
            document.getElementById('crudModal').classList.remove('active');
            document.querySelector('.sidebar-nav a.active').click();
        } catch (error) {
            alert("Error: " + error.message);
        }
    },

    async deleteRecord(idField, idValue) {
        if (!confirm(`Are you sure you want to completely erase ${idField}: ${idValue}?`)) return;
        const table = document.querySelector('.sidebar-nav a.active').getAttribute('data-target').toLowerCase();
        const properTable = table.charAt(0).toUpperCase() + table.slice(1);
        
        try {
            const res = await fetch(`/api/generic/${properTable}/${idField}/${idValue}`, {
                method: 'DELETE'
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            document.querySelector('.sidebar-nav a.active').click();
        } catch (error) {
            alert("Error: " + error.message);
        }
    },

    exportReport() {
        const type = document.getElementById('exportType').value;
        const timeframe = document.getElementById('exportTimeframe').value;
        window.open(`/api/export/${type}/${timeframe}`, '_blank');
    },

    async fetchProfitReport() {
        const start = document.getElementById('ana-start-date').value;
        const end = document.getElementById('ana-end-date').value;
        if (!start || !end) return alert('Select both start and end dates');

        try {
            const res = await fetch(`/api/analytics/report?startDate=${start}&endDate=${end}`);
            const data = await res.json();
            if(!res.ok) throw new Error(data.error);

            const container = document.getElementById('analytics-report-result');
            container.style.display = 'grid';
            container.innerHTML = `
                <div class="insight-item"><span>Total Revenue</span><strong>${this.formatCurrency(data.revenue)}</strong></div>
                <div class="insight-item"><span>Total Expenses</span><strong style="color: #EF4444">${this.formatCurrency(data.expenses)}</strong></div>
                <div class="insight-item"><span>Net Profit</span><strong style="color: #10B981">${this.formatCurrency(data.profit)}</strong></div>
                <div class="insight-item"><span>Sales Count</span><strong>${data.salesCount}</strong></div>
            `;
        } catch(e) { alert('Report Error: ' + e.message); }
    },

    async downloadBill(orderId) {
        try {
            const response = await fetch(`/api/generate-bill/${orderId}`, { method: 'POST' });
            if (!response.ok) throw new Error('Could not generate bill');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bill_${orderId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch(e) { alert(e.message); }
    },

    async loadAutoOrders() {
        try {
            // PROACTIVE SCAN ON LOAD
            await fetch('/api/auto-orders/scan', { method: 'POST' });
            
            const res = await fetch('/api/auto-orders');
            const data = await res.json();
            const body = document.getElementById('auto-order-list');
            if (data.length === 0) {
                body.innerHTML = '<tr><td colspan="4">No auto-orders placed yet.</td></tr>';
                return;
            }
            body.innerHTML = data.map(o => `
                <tr>
                    <td>${o.ProductName}</td>
                    <td style="color:#EF4444">${o.CurrentStock}</td>
                    <td><span class="role-badge" style="background:#10B981"> Restocked (100) </span></td>
                    <td>${o.OrderDate}</td>
                </tr>
            `).join('');
        } catch(e) { console.error('Auto-order list error', e); }
    },

    async loadRecentPurchasers(limit = 10) {
        try {
            const res = await fetch(`/api/analytics/recent-purchasers?limit=${limit}`);
            const data = await res.json();
            const body = document.getElementById('recent-purchasers-list');
            if (data.length === 0) {
                body.innerHTML = '<tr><td colspan="3">No purchase history yet.</td></tr>';
                return;
            }
            body.innerHTML = data.map(o => `
                <tr>
                    <td>${o.Name}</td>
                    <td>${o.OrderDate}</td>
                    <td style="color:#10B981">${this.formatCurrency(o.TotalAmount)}</td>
                </tr>
            `).join('');
        } catch(e) { console.error('Recent purchasers list error', e); }
    }
};



