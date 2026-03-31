let instances = {};

const Charts = {
    async renderDashboardCharts() {
        try {
            const data = await API.get('analytics');
            
            Chart.defaults.color = '#94A3B8';
            Chart.defaults.font.family = 'Inter';

            // 1. Sales Trend
            this.createLineChart('salesTrendChart', 
                data.salesTrend.map(d => d.OrderDate), 
                data.salesTrend.map(d => d.Total), 
                'Revenue (₹)', '#10B981'
            );

            // 2. Top Selling (Bar)
            this.createBarChart('topSellingChart', 
                data.topSelling.map(d => d.ProductName), 
                data.topSelling.map(d => d.TotalSold), 
                'Total Sold', '#4F46E5'
            );

            // 3. Category Sales (Pie)
            this.createDoughnutChart('categorySalesChart',
                data.categorySales.map(d => d.Category),
                data.categorySales.map(d => d.TotalRev),
                ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6']
            );

            // 4. Payment Methods (Pie)
            this.createDoughnutChart('paymentMethodChart',
                data.paymentMethods.map(d => d.PaymentMethod),
                data.paymentMethods.map(d => d.count),
                ['#10B981', '#3B82F6', '#F59E0B']
            );

            // 5. Delivery Status (Bar)
            this.createBarChart('deliveryStatusChart',
                data.deliveryStatus.map(d => d.DeliveryStatus),
                data.deliveryStatus.map(d => d.count),
                'Deliveries', '#F59E0B'
            );

            // 6. Stock Levels (Bar)
            this.createBarChart('stockLevelsChart',
                data.stockLevels.map(d => d.ProductName),
                data.stockLevels.map(d => d.StockQuantity),
                'Current Stock', '#EF4444'
            );

        } catch (e) {
            console.error('Error rendering charts:', e);
        }
    },

    createLineChart(id, labels, data, label, color) {
        if(instances[id]) instances[id].destroy();
        const ctx = document.getElementById(id).getContext('2d');
        instances[id] = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ label, data, borderColor: color, backgroundColor: color + '33', fill: true, tension: 0.4 }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    },

    createBarChart(id, labels, data, label, color) {
        if(instances[id]) instances[id].destroy();
        const ctx = document.getElementById(id).getContext('2d');
        instances[id] = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label, data, backgroundColor: color, borderRadius: 5 }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    },

    createDoughnutChart(id, labels, data, colors) {
        if(instances[id]) instances[id].destroy();
        const ctx = document.getElementById(id).getContext('2d');
        instances[id] = new Chart(ctx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
            options: { responsive: true, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
        });
    }
};
