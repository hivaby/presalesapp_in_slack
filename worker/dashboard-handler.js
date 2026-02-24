
/**
 * Dashboard Handler
 * Serves the static dashboard files (HTML/JS) directly from the Worker
 */

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📊 Presalesapp 분석 대시보드</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
    .container { max-width: 1600px; margin: 0 auto; }
    header { background: white; border-radius: 16px; padding: 30px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    h1 { font-size: 28px; color: #2d3748; margin-bottom: 8px; }
    .subtitle { color: #718096; font-size: 14px; }
    .filters { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; display: flex; gap: 15px; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .filter-group { display: flex; flex-direction: column; gap: 5px; }
    .filter-group label { font-size: 12px; color: #718096; font-weight: 600; }
    select { padding: 10px 15px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; background: white; cursor: pointer; min-width: 150px; }
    .btn-primary { padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; margin-top: 20px; }
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .card { background: white; border-radius: 12px; padding: 20px; display: flex; gap: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .card-icon { width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; }
    .card-content h3 { font-size: 12px; color: #718096; margin-bottom: 8px; }
    .card-value { font-size: 28px; font-weight: 700; color: #2d3748; }
    .charts-section { display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .chart-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .chart-card h3 { font-size: 16px; color: #2d3748; margin-bottom: 15px; }
    canvas { max-height: 300px; }
    .logs-section { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .logs-section h2 { font-size: 18px; color: #2d3748; margin-bottom: 20px; }
    .table-container { overflow-x: auto; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f7fafc; padding: 12px; text-align: left; font-size: 12px; color: #718096; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #2d3748; }
    tr:hover { background: #f7fafc; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-DRM { background: #e0e7ff; color: #5a67d8; }
    .badge-DLP { background: #fef3c7; color: #d97706; }
    .badge-PrintSafer { background: #d1fae5; color: #059669; }
    .badge-ScreenSafer { background: #dbeafe; color: #2563eb; }
    .badge-AI.Sentinel { background: #fce7f3; color: #be185d; }
    .badge-General { background: #e5e7eb; color: #6b7280; }
    .status-success { color: #059669; font-weight: 600; }
    .status-error { color: #dc2626; font-weight: 600; }
    .question-cell, .answer-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pagination { display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
    .page-btn { padding: 8px 12px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .page-btn.active { background: #667eea; color: white; border-color: #667eea; }
    .loading, .no-data { text-align: center; padding: 40px; color: #718096; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><i class="fas fa-chart-line"></i> Presalesapp 질의응답 분석</h1>
      <p class="subtitle">AI 어시스턴트 사용 현황을 한눈에 확인하세요</p>
    </header>
    <div class="filters">
      <div class="filter-group">
        <label><i class="fas fa-calendar"></i> 기간</label>
        <select id="timeRange">
          <option value="today">오늘</option>
          <option value="week" selected>최근 7일</option>
          <option value="month">최근 30일</option>
        </select>
      </div>
      <div class="filter-group">
        <label><i class="fas fa-filter"></i> 제품 분류</label>
        <select id="categoryFilter">
          <option value="all">전체</option>
          <option value="DRM">DRM</option>
          <option value="DLP">DLP</option>
          <option value="PrintSafer">PrintSafer</option>
          <option value="ScreenSafer">ScreenSafer</option>
          <option value="AI Sentinel">AI Sentinel</option>
          <option value="General">기타</option>
        </select>
      </div>
      <button id="refreshBtn" class="btn-primary"><i class="fas fa-sync"></i> 새로고침</button>
    </div>
    <div class="summary-cards">
      <div class="card"><div class="card-icon" style="background: #667eea;"><i class="fas fa-comments"></i></div><div class="card-content"><h3>총 질문 수</h3><div class="card-value" id="totalQueries">-</div></div></div>
      <div class="card"><div class="card-icon" style="background: #f093fb;"><i class="fas fa-clock"></i></div><div class="card-content"><h3>평균 응답시간</h3><div class="card-value" id="avgResponseTime">-</div></div></div>
      <div class="card"><div class="card-icon" style="background: #4facfe;"><i class="fas fa-check-circle"></i></div><div class="card-content"><h3>성공률</h3><div class="card-value" id="successRate">-</div></div></div>
      <div class="card"><div class="card-icon" style="background: #43e97b;"><i class="fas fa-users"></i></div><div class="card-content"><h3>활성 사용자</h3><div class="card-value" id="activeUsers">-</div></div></div>
    </div>
    <div class="charts-section">
      <div class="chart-card"><h3><i class="fas fa-chart-pie"></i> 제품별 질문 분포</h3><canvas id="categoryChart"></canvas></div>
      <div class="chart-card"><h3><i class="fas fa-chart-line"></i> 일별 질문 추이</h3><canvas id="dailyChart"></canvas></div>
    </div>
    <div class="logs-section">
      <h2><i class="fas fa-list"></i> 상세 질의응답 내역</h2>
      <div class="table-container">
        <table>
          <thead><tr><th>번호</th><th>질의자</th><th>질의시간</th><th>응답시간</th><th>제품분류</th><th>질의내용</th><th>응답내용</th><th>상태</th></tr></thead>
          <tbody id="logsTableBody"><tr><td colspan="8" class="loading">데이터를 불러오는 중...</td></tr></tbody>
        </table>
      </div>
      <div class="pagination" id="pagination"></div>
    </div>
  </div>
  <script src="/dashboard/dashboard.js"></script>
</body>
</html>`;

const DASHBOARD_JS = `
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
      const response = await fetch(\`/api/analytics?range=\${this.timeRange}\`);
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
        \`/api/logs?range=\${this.timeRange}&category=\${this.category}&page=\${this.currentPage}\`
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
      metrics.avgResponseTime ? \`\${(metrics.avgResponseTime / 1000).toFixed(1)}초\` : '0초';
    
    document.getElementById('successRate').textContent = 
      metrics.successRate ? \`\${Math.round(metrics.successRate)}%\` : '0%';
    
    document.getElementById('activeUsers').textContent = 
      metrics.activeUsers?.toLocaleString() || '0';
  }

  setupCharts() {
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    this.charts.category = new Chart(categoryCtx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: ['#5a67d8', '#d97706', '#059669', '#2563eb', '#be185d', '#6b7280']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });

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
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  updateCharts(data) {
    if (data.keywords && this.charts.category) {
      const categoryCount = {};
      data.keywords.forEach(item => {
        const cat = this.categorizeKeyword(item.keyword);
        categoryCount[cat] = (categoryCount[cat] || 0) + item.count;
      });
      
      this.charts.category.data.labels = Object.keys(categoryCount);
      this.charts.category.data.datasets[0].data = Object.values(categoryCount);
      this.charts.category.update();
    }

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
    
    tbody.innerHTML = logs.map((log, index) => \`
      <tr>
        <td>\${(this.currentPage - 1) * 50 + index + 1}</td>
        <td>\${log.user_name || 'Anonymous'}</td>
        <td>\${this.formatDateTime(log.created_at)}</td>
        <td>\${this.formatResponseTime(log.response_time)}</td>
        <td><span class="badge badge-\${log.category}">\${log.category}</span></td>
        <td class="question-cell" title="\${this.escapeHtml(log.question_text || '')}">\${this.truncate(log.question_text, 50)}</td>
        <td class="answer-cell" title="\${this.escapeHtml(log.answer_text || '')}">\${this.truncate(log.answer_text, 50)}</td>
        <td>\${log.success ? '<span class="status-success">✓ 성공</span>' : '<span class="status-error">✗ 실패</span>'}</td>
      </tr>
    \`).join('');
  }

  renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!pagination || pagination.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    
    const { page, totalPages } = pagination;
    let html = '';
    
    if (page > 1) {
      html += \`<button class="page-btn" onclick="dashboard.goToPage(\${page - 1})">이전</button>\`;
    }
    
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      html += \`<button class="page-btn \${i === page ? 'active' : ''}" onclick="dashboard.goToPage(\${i})">\${i}</button>\`;
    }
    
    if (page < totalPages) {
      html += \`<button class="page-btn" onclick="dashboard.goToPage(\${page + 1})">다음</button>\`;
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
    return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  formatResponseTime(ms) {
    if (!ms) return '-';
    if (ms < 1000) return \`\${Math.round(ms)}ms\`;
    return \`\${(ms / 1000).toFixed(1)}초\`;
  }

  truncate(text, length) {
    if (!text) return '-';
    if (text.length <= length) return this.escapeHtml(text);
    return this.escapeHtml(text.substring(0, length)) + '...';
  }

  escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  startAutoRefresh() {
    setInterval(() => { this.loadData(); }, 30000);
  }
}

// Initialize dashboard
let dashboard;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { dashboard = new EnhancedDashboard(); });
} else {
  dashboard = new EnhancedDashboard();
}
`;

export function handleDashboardRequest(request) {
    const url = new URL(request.url);

    // Serve JavaScript
    if (url.pathname.endsWith('dashboard.js')) {
        return new Response(DASHBOARD_JS, {
            headers: { 'Content-Type': 'application/javascript' }
        });
    }

    // Serve HTML
    return new Response(DASHBOARD_HTML, {
        headers: { 'Content-Type': 'text/html' }
    });
}
