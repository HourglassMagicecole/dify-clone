// HTML Report Generator for k6 Load Test Results
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { generateMetricsSummary } from '../metrics.js';
import { validatePerformanceBenchmarks, calculatePerformanceGrade } from '../thresholds.js';

/**
 * Generate comprehensive HTML report for load test results
 */
export function generateHTMLReport(data) {
  const summary = generateMetricsSummary();
  const validation = validatePerformanceBenchmarks(data.metrics);
  const grade = calculatePerformanceGrade(data.metrics);

  const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dify Clone Load Test Report - ${new Date().toISOString()}</title>
    <style>
        ${getReportCSS()}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        ${generateReportHeader(data, grade)}
        ${generateExecutiveSummary(data, validation, grade)}
        ${generatePerformanceMetrics(data.metrics)}
        ${generateEducationPlatformMetrics(summary)}
        ${generateThresholdAnalysis(validation)}
        ${generatePerformanceCharts(data.metrics)}
        ${generateRecommendations(validation, grade)}
        ${generateDetailedResults(data)}
        ${generateFooter()}
    </div>

    <script>
        ${getReportJavaScript()}
    </script>
</body>
</html>`;

  return htmlTemplate;
}

/**
 * Generate report CSS styles
 */
function getReportCSS() {
  return `
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        background: #f5f5f5;
    }

    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
    }

    .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px;
        border-radius: 10px;
        margin-bottom: 20px;
        text-align: center;
    }

    .header h1 {
        font-size: 2.5em;
        margin-bottom: 10px;
    }

    .header .subtitle {
        font-size: 1.2em;
        opacity: 0.9;
    }

    .grade-badge {
        display: inline-block;
        padding: 10px 20px;
        border-radius: 50px;
        font-weight: bold;
        font-size: 1.5em;
        margin-top: 15px;
    }

    .grade-A { background: #4caf50; }
    .grade-B { background: #8bc34a; }
    .grade-C { background: #ffc107; color: #333; }
    .grade-D { background: #ff9800; }
    .grade-F { background: #f44336; }

    .section {
        background: white;
        margin-bottom: 20px;
        padding: 25px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .section h2 {
        color: #333;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #eee;
    }

    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
    }

    .metric-card {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        border-left: 4px solid #667eea;
    }

    .metric-card h3 {
        color: #667eea;
        margin-bottom: 15px;
    }

    .metric-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        padding: 8px 0;
        border-bottom: 1px solid #eee;
    }

    .metric-item:last-child {
        border-bottom: none;
        margin-bottom: 0;
    }

    .metric-label {
        font-weight: 500;
    }

    .metric-value {
        font-weight: bold;
        color: #333;
    }

    .status-pass { color: #4caf50; }
    .status-warn { color: #ff9800; }
    .status-fail { color: #f44336; }

    .threshold-list {
        list-style: none;
        padding: 0;
    }

    .threshold-list li {
        padding: 10px;
        margin-bottom: 5px;
        border-radius: 5px;
        display: flex;
        align-items: center;
    }

    .threshold-list li.pass {
        background: #e8f5e8;
        color: #2e7d2e;
    }

    .threshold-list li.warn {
        background: #fff3e0;
        color: #f57c00;
    }

    .threshold-list li.fail {
        background: #ffebee;
        color: #c62828;
    }

    .threshold-list li::before {
        content: "✓";
        margin-right: 10px;
        font-weight: bold;
    }

    .threshold-list li.warn::before {
        content: "⚠";
    }

    .threshold-list li.fail::before {
        content: "✗";
    }

    .chart-container {
        position: relative;
        height: 400px;
        margin-bottom: 30px;
    }

    .recommendations {
        background: #e3f2fd;
        border-left: 4px solid #2196f3;
        padding: 20px;
        margin-bottom: 20px;
    }

    .recommendations h3 {
        color: #1976d2;
        margin-bottom: 15px;
    }

    .recommendations ul {
        list-style-type: disc;
        margin-left: 20px;
    }

    .recommendations li {
        margin-bottom: 8px;
    }

    .footer {
        text-align: center;
        padding: 20px;
        color: #666;
        font-size: 0.9em;
    }

    .summary-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 30px;
    }

    .summary-stat {
        background: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }

    .summary-stat .value {
        font-size: 2em;
        font-weight: bold;
        color: #667eea;
    }

    .summary-stat .label {
        color: #666;
        margin-top: 5px;
    }

    .detailed-results {
        max-height: 400px;
        overflow-y: auto;
        background: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 0.9em;
    }

    @media (max-width: 768px) {
        .container {
            padding: 10px;
        }

        .header h1 {
            font-size: 1.8em;
        }

        .metrics-grid {
            grid-template-columns: 1fr;
        }

        .summary-stats {
            grid-template-columns: repeat(2, 1fr);
        }
    }
  `;
}

/**
 * Generate report header
 */
function generateReportHeader(data, grade) {
  const testDuration = calculateTestDuration(data);

  return `
    <div class="header">
        <h1>🎓 Dify Clone Load Test Report</h1>
        <div class="subtitle">Education Platform Performance Analysis</div>
        <div class="grade-badge grade-${grade.grade}">Performance Grade: ${grade.grade} (${grade.score}%)</div>
        <div style="margin-top: 15px; opacity: 0.9;">
            Generated: ${new Date().toLocaleString()} | Duration: ${testDuration}
        </div>
    </div>
  `;
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(data, validation, grade) {
  const totalRequests = data.metrics.http_reqs?.count || 0;
  const avgResponseTime = data.metrics.http_req_duration?.avg || 0;
  const errorRate = data.metrics.http_req_failed?.rate || 0;
  const maxVUs = data.metrics.vus_max?.value || 0;

  return `
    <div class="section">
        <h2>📊 Executive Summary</h2>
        <div class="summary-stats">
            <div class="summary-stat">
                <div class="value">${totalRequests.toLocaleString()}</div>
                <div class="label">Total Requests</div>
            </div>
            <div class="summary-stat">
                <div class="value">${Math.round(avgResponseTime)}ms</div>
                <div class="label">Avg Response Time</div>
            </div>
            <div class="summary-stat">
                <div class="value">${(errorRate * 100).toFixed(2)}%</div>
                <div class="label">Error Rate</div>
            </div>
            <div class="summary-stat">
                <div class="value">${maxVUs}</div>
                <div class="label">Max Concurrent Users</div>
            </div>
            <div class="summary-stat">
                <div class="value">${validation.passed.length}</div>
                <div class="label">Tests Passed</div>
            </div>
            <div class="summary-stat">
                <div class="value">${validation.failed.length}</div>
                <div class="label">Tests Failed</div>
            </div>
        </div>

        <p><strong>Overall Assessment:</strong> ${generateAssessmentText(grade, validation)}</p>
    </div>
  `;
}

/**
 * Generate performance metrics section
 */
function generatePerformanceMetrics(metrics) {
  return `
    <div class="section">
        <h2>⚡ Performance Metrics</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>HTTP Performance</h3>
                <div class="metric-item">
                    <span class="metric-label">Average Duration</span>
                    <span class="metric-value">${Math.round(metrics.http_req_duration?.avg || 0)}ms</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">90th Percentile</span>
                    <span class="metric-value">${Math.round(metrics.http_req_duration?.p90 || 0)}ms</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">95th Percentile</span>
                    <span class="metric-value">${Math.round(metrics.http_req_duration?.p95 || 0)}ms</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Requests/sec</span>
                    <span class="metric-value">${Math.round(metrics.http_reqs?.rate || 0)}</span>
                </div>
            </div>

            <div class="metric-card">
                <h3>System Reliability</h3>
                <div class="metric-item">
                    <span class="metric-label">Success Rate</span>
                    <span class="metric-value">${((1 - (metrics.http_req_failed?.rate || 0)) * 100).toFixed(2)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Failed Requests</span>
                    <span class="metric-value">${metrics.http_req_failed?.fails || 0}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Data Received</span>
                    <span class="metric-value">${formatBytes(metrics.data_received?.count || 0)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Data Sent</span>
                    <span class="metric-value">${formatBytes(metrics.data_sent?.count || 0)}</span>
                </div>
            </div>

            <div class="metric-card">
                <h3>Concurrency</h3>
                <div class="metric-item">
                    <span class="metric-label">Max Virtual Users</span>
                    <span class="metric-value">${metrics.vus_max?.value || 0}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Avg Virtual Users</span>
                    <span class="metric-value">${Math.round(metrics.vus?.value || 0)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Test Duration</span>
                    <span class="metric-value">${Math.round((metrics.iteration_duration?.avg || 0) / 1000)}s</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Iterations</span>
                    <span class="metric-value">${metrics.iterations?.count || 0}</span>
                </div>
            </div>
        </div>
    </div>
  `;
}

/**
 * Generate education platform specific metrics
 */
function generateEducationPlatformMetrics(summary) {
  return `
    <div class="section">
        <h2>🎓 Education Platform Metrics</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Authentication & Users</h3>
                <div class="metric-item">
                    <span class="metric-label">Login Success Rate</span>
                    <span class="metric-value">${((summary.authentication?.loginSuccessRate || 0) * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Avg Login Duration</span>
                    <span class="metric-value">${Math.round(summary.authentication?.avgLoginDuration || 0)}ms</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Concurrent Users</span>
                    <span class="metric-value">${summary.authentication?.concurrentUsers || 0}</span>
                </div>
            </div>

            <div class="metric-card">
                <h3>AI Agent Performance</h3>
                <div class="metric-item">
                    <span class="metric-label">Creation Success Rate</span>
                    <span class="metric-value">${((summary.agents?.creationSuccessRate || 0) * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Avg Creation Time</span>
                    <span class="metric-value">${Math.round(summary.agents?.avgCreationDuration || 0)}ms</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Avg Response Time</span>
                    <span class="metric-value">${Math.round(summary.agents?.avgResponseTime || 0)}ms</span>
                </div>
            </div>

            <div class="metric-card">
                <h3>LLM & Chat</h3>
                <div class="metric-item">
                    <span class="metric-label">LLM Success Rate</span>
                    <span class="metric-value">${((summary.llm?.successRate || 0) * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Avg Request Duration</span>
                    <span class="metric-value">${Math.round(summary.llm?.avgRequestDuration || 0)}ms</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Total Tokens Used</span>
                    <span class="metric-value">${(summary.llm?.totalTokensUsed || 0).toLocaleString()}</span>
                </div>
            </div>

            <div class="metric-card">
                <h3>Workflow Execution</h3>
                <div class="metric-item">
                    <span class="metric-label">Success Rate</span>
                    <span class="metric-value">${((summary.workflows?.creationSuccessRate || 0) * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Avg Execution Time</span>
                    <span class="metric-value">${Math.round(summary.workflows?.avgExecutionDuration || 0)}ms</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Steps Completed</span>
                    <span class="metric-value">${summary.workflows?.totalStepsCompleted || 0}</span>
                </div>
            </div>
        </div>
    </div>
  `;
}

/**
 * Generate threshold analysis
 */
function generateThresholdAnalysis(validation) {
  return `
    <div class="section">
        <h2>🎯 Performance Threshold Analysis</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
            <div>
                <h3 style="color: #4caf50; margin-bottom: 15px;">✅ Passed Thresholds</h3>
                <ul class="threshold-list">
                    ${validation.passed.map(item => `<li class="pass">${item}</li>`).join('')}
                </ul>
            </div>

            ${validation.warnings.length > 0 ? `
            <div>
                <h3 style="color: #ff9800; margin-bottom: 15px;">⚠️ Warnings</h3>
                <ul class="threshold-list">
                    ${validation.warnings.map(item => `<li class="warn">${item}</li>`).join('')}
                </ul>
            </div>
            ` : ''}

            ${validation.failed.length > 0 ? `
            <div>
                <h3 style="color: #f44336; margin-bottom: 15px;">❌ Failed Thresholds</h3>
                <ul class="threshold-list">
                    ${validation.failed.map(item => `<li class="fail">${item}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>
    </div>
  `;
}

/**
 * Generate performance charts placeholder
 */
function generatePerformanceCharts(metrics) {
  return `
    <div class="section">
        <h2>📈 Performance Trends</h2>
        <div class="chart-container">
            <canvas id="responseTimeChart"></canvas>
        </div>
        <div class="chart-container">
            <canvas id="throughputChart"></canvas>
        </div>
    </div>
  `;
}

/**
 * Generate recommendations
 */
function generateRecommendations(validation, grade) {
  const recommendations = generateRecommendationList(validation, grade);

  return `
    <div class="section">
        <h2>🚀 Performance Recommendations</h2>
        <div class="recommendations">
            <h3>Based on Test Results</h3>
            <ul>
                ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    </div>
  `;
}

/**
 * Generate detailed results
 */
function generateDetailedResults(data) {
  return `
    <div class="section">
        <h2>📋 Detailed Test Results</h2>
        <div class="detailed-results">
            ${textSummary(data, { indent: '  ', enableColors: false })}
        </div>
    </div>
  `;
}

/**
 * Generate footer
 */
function generateFooter() {
  return `
    <div class="footer">
        <p>Generated by k6 Load Testing Suite for Dify Clone Education Platform</p>
        <p>Report created at ${new Date().toLocaleString()}</p>
    </div>
  `;
}

/**
 * Helper functions
 */
function calculateTestDuration(data) {
  // Calculate from iterations if available
  const avgIterationDuration = data.metrics.iteration_duration?.avg || 0;
  const iterationCount = data.metrics.iterations?.count || 1;
  const totalDuration = avgIterationDuration * iterationCount;

  return formatDuration(totalDuration);
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateAssessmentText(grade, validation) {
  const totalChecks = validation.passed.length + validation.failed.length + validation.warnings.length;
  const passRate = totalChecks > 0 ? (validation.passed.length / totalChecks * 100).toFixed(1) : 0;

  if (grade.grade === 'A') {
    return `Excellent performance! The system meets all performance benchmarks with ${passRate}% of thresholds passing.`;
  } else if (grade.grade === 'B') {
    return `Good performance overall with ${passRate}% of thresholds passing. Minor optimizations recommended.`;
  } else if (grade.grade === 'C') {
    return `Acceptable performance with ${passRate}% of thresholds passing. Several areas need attention.`;
  } else if (grade.grade === 'D') {
    return `Below expected performance with ${passRate}% of thresholds passing. Significant improvements needed.`;
  } else {
    return `Poor performance with ${passRate}% of thresholds passing. Immediate action required.`;
  }
}

function generateRecommendationList(validation, grade) {
  const recommendations = [];

  // Base recommendations based on grade
  if (grade.grade === 'F' || grade.grade === 'D') {
    recommendations.push('Conduct immediate system optimization - performance is below acceptable levels');
    recommendations.push('Review server resources (CPU, memory, network) for bottlenecks');
    recommendations.push('Implement caching strategies to reduce response times');
  }

  if (validation.failed.some(f => f.includes('response time'))) {
    recommendations.push('Optimize API endpoints - response times exceed benchmarks');
    recommendations.push('Consider implementing CDN for static assets');
    recommendations.push('Review database query performance and indexing');
  }

  if (validation.failed.some(f => f.includes('error rate'))) {
    recommendations.push('Investigate and fix application errors - error rate is too high');
    recommendations.push('Implement proper error handling and circuit breakers');
    recommendations.push('Add retry logic with exponential backoff');
  }

  if (validation.failed.some(f => f.includes('concurrent users'))) {
    recommendations.push('Scale infrastructure to handle target concurrent users');
    recommendations.push('Implement proper load balancing');
    recommendations.push('Consider auto-scaling based on traffic patterns');
  }

  // Always include these general recommendations
  recommendations.push('Monitor system metrics continuously in production');
  recommendations.push('Set up alerting for performance threshold violations');
  recommendations.push('Schedule regular load testing as part of CI/CD pipeline');

  return recommendations;
}

/**
 * Generate JavaScript for interactive charts
 */
function getReportJavaScript() {
  return `
    // Placeholder for Chart.js implementation
    // In a real implementation, you would populate these with actual metrics data

    document.addEventListener('DOMContentLoaded', function() {
        // Response Time Chart
        const responseTimeCtx = document.getElementById('responseTimeChart');
        if (responseTimeCtx) {
            new Chart(responseTimeCtx, {
                type: 'line',
                data: {
                    labels: ['Start', '25%', '50%', '75%', 'End'],
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: [1000, 1200, 1500, 1300, 1100],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Response Time Trends'
                        }
                    }
                }
            });
        }

        // Throughput Chart
        const throughputCtx = document.getElementById('throughputChart');
        if (throughputCtx) {
            new Chart(throughputCtx, {
                type: 'bar',
                data: {
                    labels: ['Requests/sec', 'Success/sec', 'Errors/sec'],
                    datasets: [{
                        label: 'Throughput',
                        data: [45, 43, 2],
                        backgroundColor: [
                            '#4caf50',
                            '#2196f3',
                            '#f44336'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'System Throughput'
                        }
                    }
                }
            });
        }
    });
  `;
}

export default generateHTMLReport;