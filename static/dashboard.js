// static/dashboard.js
let overallMetricsChart = null;
let currentData = null;

document.addEventListener('DOMContentLoaded', () => loadDashboardData());

async function loadDashboardData() {
    try {
        const response = await fetch('/api/metrics');
        currentData = await response.json();
        renderDashboard(currentData);
    } catch (error) {
        document.getElementById('models-container').innerHTML = '<div class="alert alert-danger">Failed to load data</div>';
    }
}

function renderDashboard(data) {
    renderRankings(data.rankings);
    renderModelCards(data.models, data.classes);
    renderOverallMetricsChart(data.models);
}

function renderRankings(rankings) {
    const medals = ['🥇', '🥈', '🥉'];
    const html = `
        <div class="ranking-container">
            ${rankings.map((r, i) => `
                <div class="ranking-item rank-${i+1}">
                    <div class="ranking-medal">${medals[i] || '📊'}</div>
                    <div><strong>${r.model}</strong></div>
                    <div class="ranking-score">${(r.average_score * 100).toFixed(2)}%</div>
                    <small>Avg. Performance</small>
                </div>
            `).join('')}
        </div>
    `;
    document.getElementById('ranking-container').innerHTML = html;
}

function renderModelCards(models, classes) {
    const html = Object.entries(models).map(([name, data]) => {
        const m = data.overall;
        const cm = data.confusion_matrix;
        
        return `
            <div class="col-md-4 mb-4">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="bi bi-cpu"></i> ${name}</h3>
                    </div>
                    <div class="card-body">
                        <div class="metrics-grid">
                            ${createMetric('Accuracy', m.accuracy, '%')}
                            ${createMetric('Precision', m.precision, '%')}
                            ${createMetric('Recall', m.recall, '%')}
                            ${createMetric('F1 Score', m.f1_score, '%')}
                            ${createMetric('MCC', m.mcc, '')}
                        </div>
                        <h5>Per-Class Performance</h5>
                        <canvas id="chart-${name.replace(/\s/g, '')}"></canvas>
                        <h5>Confusion Matrix</h5>
                        <div class="confusion-matrix-container">
                            <table class="confusion-matrix">
                                <thead>
                                    <tr>
                                        <th>True \\ Pred</th>
                                        ${classes.map(c => `<th>${c}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${cm.map((row, i) => `
                                        <tr>
                                            <th>${classes[i]}</th>
                                            ${row.map((v, j) => `<td class="${i===j?'diagonal':''}">${v}</td>`).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('models-container').innerHTML = html;
    Object.entries(models).forEach(([name, data]) => createPerClassChart(name, data.per_class));
}

function createMetric(label, value, suffix) {
    const display = suffix === '%' ? (value * 100).toFixed(2) + '%' : value.toFixed(3);
    return `<div class="metric-item"><div class="metric-label">${label}</div><div class="metric-value">${display}</div></div>`;
}

function createPerClassChart(modelName, perClassMetrics) {
    const ctx = document.getElementById(`chart-${modelName.replace(/\s/g, '')}`);
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: currentData.classes,
            datasets: [
                { 
                    label: 'Precision', 
                    data: perClassMetrics.precision.map(v => v * 100), 
                    borderColor: '#2196F3', 
                    backgroundColor: 'rgba(33,150,243,0.1)', 
                    borderWidth: 2, 
                    pointRadius: 3 
                },
                { 
                    label: 'Recall', 
                    data: perClassMetrics.recall.map(v => v * 100), 
                    borderColor: '#4CAF50', 
                    backgroundColor: 'rgba(76,175,80,0.1)', 
                    borderWidth: 2, 
                    pointRadius: 3 
                },
                { 
                    label: 'F1 Score', 
                    data: perClassMetrics.f1_score.map(v => v * 100), 
                    borderColor: '#FF9800', 
                    backgroundColor: 'rgba(255,152,0,0.1)', 
                    borderWidth: 2, 
                    pointRadius: 3 
                }
            ]
        },
        options: { 
            responsive: true, 
            scales: { 
                r: { 
                    beginAtZero: true, 
                    max: 100, 
                    ticks: { 
                        stepSize: 20, 
                        callback: v => v + '%' 
                    } 
                } 
            } 
        }
    });
}

function renderOverallMetricsChart(models) {
    const ctx = document.getElementById('overallMetricsChart').getContext('2d');
    const modelNames = Object.keys(models);
    const metrics = ['accuracy', 'precision', 'recall', 'f1_score', 'mcc'];
    const labels = ['Accuracy', 'Precision', 'Recall', 'F1 Score', 'MCC'];
    
    const datasets = modelNames.map((name, i) => {
        const colors = ['rgba(76,175,80,0.8)', 'rgba(33,150,243,0.8)', 'rgba(255,152,0,0.8)'];
        const data = metrics.map(m => parseFloat((models[name].overall[m] * 100).toFixed(2)));
        return { 
            label: name, 
            data, 
            backgroundColor: colors[i], 
            borderColor: colors[i], 
            borderWidth: 2, 
            borderRadius: 4, 
            barPercentage: 0.7 
        };
    });
    
    if (overallMetricsChart) overallMetricsChart.destroy();
    
    overallMetricsChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { 
                legend: { 
                    position: 'top', 
                    labels: { font: { size: 11 } } 
                }, 
                tooltip: { 
                    callbacks: { 
                        label: ctx => `${ctx.dataset.label}: ${ctx.raw}%` 
                    } 
                } 
            },
            scales: { 
                y: { 
                    beginAtZero: true, 
                    max: 100, 
                    title: { display: true, text: 'Score (%)' }, 
                    ticks: { callback: v => v + '%', stepSize: 20 } 
                } 
            },
            layout: { padding: { top: 30 } },
            animation: {
                onComplete: function() {
                    const chart = this;
                    const ctx = chart.ctx;
                    ctx.font = 'bold 10px Arial';
                    ctx.fillStyle = '#2c3e50';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    chart.data.datasets.forEach((dataset, i) => {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach((bar, j) => {
                            const value = dataset.data[j];
                            if (value > 0) {
                                ctx.fillText(value.toFixed(1) + '%', bar.x, bar.y - 5);
                            }
                        });
                    });
                }
            }
        }
    });
}

async function exportAsPNG() {
    try {
        // Hide buttons
        const btns = document.querySelectorAll('.export-buttons .btn');
        btns.forEach(btn => btn.style.display = 'none');
        
        // Wait for charts to be fully rendered with values
        await new Promise(r => setTimeout(r, 200));
        
        // Capture the entire body
        const canvas = await html2canvas(document.body, {
            scale: 2,
            backgroundColor: null,
            useCORS: true
        });
        
        // Restore buttons
        btns.forEach(btn => btn.style.display = '');
        
        // Download
        const link = document.createElement('a');
        link.download = `dashboard-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
    } catch (error) {
        const btns = document.querySelectorAll('.export-buttons .btn');
        btns.forEach(btn => btn.style.display = '');
    }
}

async function exportAsPDF() {
    try {
        // Hide buttons
        const btns = document.querySelectorAll('.export-buttons .btn');
        btns.forEach(btn => btn.style.display = 'none');
        
        // Wait for charts to be fully rendered with values
        await new Promise(r => setTimeout(r, 200));
        
        // Capture the entire body
        const canvas = await html2canvas(document.body, {
            scale: 2,
            backgroundColor: null,
            useCORS: true
        });
        
        // Restore buttons
        btns.forEach(btn => btn.style.display = '');
        
        // Create PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('landscape');
        const imgWidth = 280;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(canvas.toDataURL(), 'PNG', 10, 10, imgWidth, imgHeight);
        pdf.save(`dashboard-${Date.now()}.pdf`);
        
    } catch (error) {
        const btns = document.querySelectorAll('.export-buttons .btn');
        btns.forEach(btn => btn.style.display = '');
    }
}

function refreshData() { 
    loadDashboardData();
    showNotification('Refreshing data...', 'info');
}

function showNotification(msg, type) {
    const notif = document.createElement('div');
    notif.className = 'notification-toast';
    notif.style.backgroundColor = type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1';
    notif.style.color = type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460';
    notif.innerHTML = msg;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}