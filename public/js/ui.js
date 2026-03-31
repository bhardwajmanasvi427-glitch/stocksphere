// UI building functions
const UI = {
    renderTable(headers, data) {
        const headRow = document.getElementById('table-head');
        const body = document.getElementById('table-body');
        
        headRow.innerHTML = '';
        body.innerHTML = '';

        if (!data || data.length === 0) {
            body.innerHTML = '<tr><td colspan="100%">No records found.</td></tr>';
            return;
        }

        // Setup headers
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            headRow.appendChild(th);
        });

        // Setup rows
        data.forEach(row => {
            const tr = document.createElement('tr');
            headers.forEach(h => {
                const td = document.createElement('td');
                // Format price if key implies price
                if (h.toLowerCase().includes('price') || h.toLowerCase().includes('amount') || h.toLowerCase().includes('revenue')) {
                    td.textContent = '$' + Number(row[h]).toFixed(2);
                } else {
                    td.textContent = row[h];
                }
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });
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
        return '$' + Number(val).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2});
    }
};
