let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    
    // Check Auth
    try {
        const session = await API.checkSession();
        if (session.authenticated) {
            currentUser = session.user;
            showApp();
        } else {
            showLogin();
        }
    } catch(e) {
        showLogin();
    }

    // Login Form Submit
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        const r = document.getElementById('role').value;
        
        try {
            const res = await API.login(u, p, r);
            if(res.success) {
                currentUser = res.user;
                showApp();
            } else {
                document.getElementById('login-error').innerText = res.message;
            }
        } catch(err) {
            document.getElementById('login-error').innerText = 'Server error. Please try again.';
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await API.logout();
        currentUser = null;
        showLogin();
    });

    // Navigation
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const target = link.getAttribute('data-target');
            document.getElementById('page-title').innerText = link.innerText;

            if (target === 'dashboard') {
                document.getElementById('dashboard').classList.add('active');
                document.getElementById('data-page').classList.remove('active');
                loadDashboard();
            } else {
                document.getElementById('dashboard').classList.remove('active');
                document.getElementById('data-page').classList.add('active');
                loadDataPage(target);
            }
        });
    });

    // Table Search Filter
    document.getElementById('table-search').addEventListener('keyup', (e) => {
        UI.filterTable(e.target.value);
    });

    // View Switching
    function showLogin() {
        document.getElementById('app-view').classList.remove('active');
        document.getElementById('login-view').classList.add('active');
        document.body.removeAttribute('data-role');
    }

    function showApp() {
        document.getElementById('login-view').classList.remove('active');
        document.getElementById('app-view').classList.add('active');
        
        document.body.setAttribute('data-role', currentUser.role);
        
        document.getElementById('user-role-badge').innerText = currentUser.role.toUpperCase();
        document.getElementById('welcome-msg').innerText = `Welcome, ${currentUser.username}`;
        
        // Auto click dashboard first
        document.querySelector('a[data-target="dashboard"]').click();
    }

    // Load Dashboard Stats
    async function loadDashboard() {
        try {
            const stats = await API.get('dashboard-stats');

            if (currentUser.role === 'admin') {
                document.getElementById('stat-products').innerText = stats.products;
                document.getElementById('stat-orders').innerText = stats.orders;
                document.getElementById('stat-revenue').innerText = UI.formatCurrency(stats.revenue);
                document.getElementById('stat-customers').innerText = stats.customers;
                document.getElementById('stat-low-stock').innerText = stats.lowStock;
                Charts.renderDashboardCharts();
                const adv = await API.get('advanced-analysis');
                const inc = document.getElementById('insights-container');
                inc.innerHTML = `
                    <div class="insight-item"><span>Estimated Profit</span><strong>${UI.formatCurrency(adv.estimatedProfit)}</strong></div>
                    <div class="insight-item"><span>Best Selling Product</span><strong>${adv.bestSellingProduct}</strong></div>
                    <div class="insight-item"><span>Least Selling Product</span><strong>${adv.leastSellingProduct}</strong></div>
                    <div class="insight-item"><span>Most Active Customer</span><strong>${adv.mostActiveCustomer}</strong></div>
                    <div class="insight-item"><span>Pending Deliveries</span><strong>${adv.pendingDeliveries}</strong></div>
                    <div class="insight-item"><span>Total Gross Revenue</span><strong>${UI.formatCurrency(adv.totalRevenue)}</strong></div>
                `;
            } else if (currentUser.role === 'retailer') {
                document.getElementById('ret-orders').innerText = stats.orders;
                document.getElementById('ret-spent').innerText = UI.formatCurrency(stats.spent);
                document.getElementById('ret-available').innerText = stats.availableProducts;
                Charts.renderDashboardCharts();
            } else if (currentUser.role === 'wholesaler') {
                document.getElementById('wh-deliveries').innerText = stats.totalDeliveries;
                document.getElementById('wh-pending').innerText = stats.pendingDeliveries;
                document.getElementById('wh-products').innerText = stats.totalProducts;
                Charts.renderDashboardCharts();
            }
        } catch(e) { console.error('Error loading dashboard', e); }
    }

    // Load Data Tables
    async function loadDataPage(endpoint) {
        document.getElementById('table-head').innerHTML = '';
        document.getElementById('table-body').innerHTML = '<tr><td colspan="100%">Loading...</td></tr>';
        document.getElementById('table-search').value = '';

        try {
            const data = await API.get(endpoint);
            if (data && data.length > 0) {
                const headers = Object.keys(data[0]);
                UI.renderTable(headers, data, currentUser.role, endpoint);
            } else {
                UI.renderTable([], [], currentUser.role, endpoint);
            }
        } catch(e) {
            document.getElementById('table-body').innerHTML = `<tr><td colspan="100%" style="color:red">Error loading data: ${e.message}</td></tr>`;
        }
    }

});
