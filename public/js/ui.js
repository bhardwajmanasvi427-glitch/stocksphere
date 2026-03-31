const UI = {
    renderTable(headers, data, role, endpoint) {
        const headRow = document.getElementById('table-head');
        const body = document.getElementById('table-body');
        
        headRow.innerHTML = '';
        body.innerHTML = '';

        if (!data || data.length === 0) {
            body.innerHTML = '<tr><td colspan="100%">No records found.</td></tr>';
            return;
        }

        // Add extra action header if needed
        let hasActions = false;
        if ((role === 'retailer' && endpoint === 'products') || (role === 'wholesaler' && endpoint === 'delivery')) {
            hasActions = true;
        }

        // Setup headers
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            headRow.appendChild(th);
        });
        if (hasActions) {
            const th = document.createElement('th');
            th.textContent = 'Actions';
            headRow.appendChild(th);
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
                tr.appendChild(td);
            }

            body.appendChild(tr);
        });
    },

    async placeOrder(productID, basePrice, quantity) {
        if(!confirm('Place order for ' + quantity + ' units?')) return;
        try {
            const res = await API.get(''); // just to ensure api resolves relative
            // better way
            const rr = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productID, quantity, price: basePrice })
            });
            const data = await rr.json();
            alert(data.message || 'Order Placed');
            document.querySelector('a[data-target="orders"]').click();
        } catch(e) { alert('Error: ' + e.message); }
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
    }
};
