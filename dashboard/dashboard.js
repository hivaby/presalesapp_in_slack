/**
 * Enhanced Presalesapp Analytics Dashboard
 * 
 * User-friendly dashboard with detailed logs and visualizations
 */

class EnhancedDashboard {
    constructor() {
        this.currentPage = 1;
        this.timeRange = 'week';
        this.category = 'all';
        this.charts = {};
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadData();
        this.setupCharts();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        document.getElementById('timeRange').addEventListener('change', (e) => {
            this.timeRange = e.target.value;
            this.currentPage = 1;
            this.loadData();
        });

        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.category = e.target.value;
            this.currentPage = 1;
            this.loadData();
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadData();
        });
    }

    async loadData() {
        await Promise.all([
            this.loadMetrics(),
            this.loadLogs()
        ]);
    }

    async loadMetrics() {
        try {
            const response = await fetch(`/api/analytics?range=${this.timeRange}`);
            const data = await response.json();
            this.updateMetrics(data.metrics);
            this.updateCharts(data.charts);
        } catch (error) {
            console.error('Failed to load metrics:', error);
        }
    }

    async loadLogs() {
        try {
            const response = await fetch(
                `/api/logs?range=${this.timeRange}&category=${this.category}&page=${this.currentPage}`
            );
            const data = await response.json();
            this.renderLogsTable(data.logs);
            this.renderPagination(data.pagination);
        } catch (error) {
            console.error('Failed to load logs:', error);
            document.getElementById('logsTableBody').innerHTML =
                '<tr><td colspan="8" class="no-data">데이터를 불러올 수 없습니다</td></tr>';
        }
    }

    updateMetrics(metrics) {
        document.getElementById('totalQueries').textContent =
            metrics.totalQueries?.toLocaleString() || '0';

        document.getElementById('avgResponseTime').textContent =
            metrics.avgResponseTime ? `${(metrics.avgResponseTime / 1000).toFixed(1)}초` : '0초';

        document.getElementById('successRate').textContent =
            metrics.successRate ? `${Math.round(metrics.successRate)}%` : '0%';

        document.getElementById('activeUsers').textContent =
            metrics.activeUsers?.toLocaleString() || '0';
    }

    setupCharts() {
        // Category distribution - Pie chart
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');
        this.charts.category = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#5a67d8',
                        '#d97706',
                        '#059669',
                        '#2563eb',
                        '#be185d',
                        '#6b7280'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        // Daily queries - Line chart
        const dailyCtx = document.getElementById('dailyChart').getContext('2d');
        this.charts.daily = new Chart(dailyCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '질문 수',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    updateCharts(data) {
        // Update category chart
        if (data.keywords && this.charts.category) {
            // Group by category from keywords data
            const categoryCount = {};
            data.keywords.forEach(item => {
                const cat = this.categorizeKeyword(item.keyword);
                categoryCount[cat] = (categoryCount[cat] || 0) + item.count;
            });

            this.charts.category.data.labels = Object.keys(categoryCount);
            this.charts.category.data.datasets[0].data = Object.values(categoryCount);
            this.charts.category.update();
        }

        // Update daily chart
        if (data.queries && this.charts.daily) {
            this.charts.daily.data.labels = data.queries.map(d => d.date);
            this.charts.daily.data.datasets[0].data = data.queries.map(d => d.count);
            this.charts.daily.update();
        }
    }

    categorizeKeyword(keyword) {
        const text = keyword.toLowerCase();
        if (text.includes('drm') || text.includes('디알엠')) return 'DRM';
        if (text.includes('dlp') || text.includes('디엘피')) return 'DLP';
        if (text.includes('printsafer') || text.includes('프린트')) return 'PrintSafer';
        if (text.includes('screensafer') || text.includes('화면')) return 'ScreenSafer';
        if (text.includes('ai') || text.includes('센티넬')) return 'AI Sentinel';
        return 'General';
    }

    renderLogsTable(logs) {
        const tbody = document.getElementById('logsTableBody');

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">데이터가 없습니다</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map((log, index) => `
      <tr>
        <td>${(this.currentPage - 1) * 50 + index + 1}</td>
        <td>${log.user_name || 'Anonymous'}</td>
        <td>${this.formatDateTime(log.created_at)}</td>
        <td>${this.formatResponseTime(log.response_time)}</td>
        <td><span class="badge badge-${log.category}">${log.category}</span></td>
        <td class="question-cell" title="${this.escapeHtml(log.question_text || '')}">${this.truncate(log.question_text, 50)}</td>
        <td class="answer-cell" title="${this.escapeHtml(log.answer_text || '')}">${this.truncate(log.answer_text, 50)}</td>
        <td>${log.success ? '<span class="status-success">✓ 성공</span>' : '<span class="status-error">✗ 실패</span>'}</td>
      </tr>
    `).join('');
    }

    renderPagination(pagination) {
        const container = document.getElementById('pagination');

        if (!pagination || pagination.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        const { page, totalPages } = pagination;
        let html = '';

        // Previous button
        if (page > 1) {
            html += `<button class="page-btn" onclick="dashboard.goToPage(${page - 1})">이전</button>`;
        }

        // Page numbers
        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(totalPages, page + 2);

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="dashboard.goToPage(${i})">${i}</button>`;
        }

        // Next button
        if (page < totalPages) {
            html += `<button class="page-btn" onclick="dashboard.goToPage(${page + 1})">다음</button>`;
        }

        container.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadLogs();
    }

    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatResponseTime(ms) {
        if (!ms) return '-';
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(1)}초`;
    }

    truncate(text, length) {
        if (!text) return '-';
        if (text.length <= length) return this.escapeHtml(text);
        return this.escapeHtml(text.substring(0, length)) + '...';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    startAutoRefresh() {
        // Refresh every 30 seconds
        setInterval(() => {
            this.loadData();
        }, 30000);
    }
}

// Initialize dashboard
let dashboard;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        dashboard = new EnhancedDashboard();
    });
} else {
    dashboard = new EnhancedDashboard();
}
