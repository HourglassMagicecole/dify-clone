// Grafana Metrics Export for k6 Load Test Results
import http from 'k6/http';
import { check } from 'k6';

/**
 * Grafana metrics exporter configuration
 */
const GRAFANA_CONFIG = {
  url: __ENV.GRAFANA_URL || 'http://localhost:3000',
  apiKey: __ENV.GRAFANA_API_KEY || '',
  datasourceName: 'k6-load-tests',
  dashboardName: 'Dify Education Platform Load Tests',
  orgId: 1
};

/**
 * Export metrics to Grafana for visualization
 */
export function exportToGrafana(testResults, testType = 'education_session') {
  if (!GRAFANA_CONFIG.apiKey) {
    console.log('Grafana API key not provided, skipping export');
    return false;
  }

  try {
    // Create or update datasource
    const datasourceCreated = createInfluxDBDatasource();
    if (!datasourceCreated) {
      console.error('Failed to create Grafana datasource');
      return false;
    }

    // Create or update dashboard
    const dashboardCreated = createLoadTestDashboard(testType);
    if (!dashboardCreated) {
      console.error('Failed to create Grafana dashboard');
      return false;
    }

    // Send metrics data
    const metricsExported = exportMetricsData(testResults, testType);
    if (!metricsExported) {
      console.error('Failed to export metrics data');
      return false;
    }

    console.log(`✅ Successfully exported load test metrics to Grafana`);
    console.log(`📊 Dashboard URL: ${GRAFANA_CONFIG.url}/d/dify-load-tests/${GRAFANA_CONFIG.dashboardName}`);

    return true;

  } catch (error) {
    console.error(`Failed to export to Grafana: ${error.message}`);
    return false;
  }
}

/**
 * Create InfluxDB datasource for k6 metrics
 */
function createInfluxDBDatasource() {
  const datasourceConfig = {
    name: GRAFANA_CONFIG.datasourceName,
    type: 'influxdb',
    url: 'http://influxdb:8086',
    access: 'proxy',
    database: 'k6',
    user: 'k6',
    password: 'k6',
    isDefault: false,
    jsonData: {
      timeInterval: '1s',
      httpMode: 'GET'
    }
  };

  const response = http.post(
    `${GRAFANA_CONFIG.url}/api/datasources`,
    JSON.stringify(datasourceConfig),
    {
      headers: {
        'Authorization': `Bearer ${GRAFANA_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const success = check(response, {
    'datasource created or exists': (r) => r.status === 200 || r.status === 409
  });

  if (success) {
    console.log(`✅ Grafana datasource '${GRAFANA_CONFIG.datasourceName}' ready`);
  }

  return success;
}

/**
 * Create comprehensive load test dashboard
 */
function createLoadTestDashboard(testType) {
  const dashboard = generateDashboardConfig(testType);

  const response = http.post(
    `${GRAFANA_CONFIG.url}/api/dashboards/db`,
    JSON.stringify({ dashboard, overwrite: true }),
    {
      headers: {
        'Authorization': `Bearer ${GRAFANA_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const success = check(response, {
    'dashboard created': (r) => r.status === 200
  });

  if (success) {
    console.log(`✅ Grafana dashboard '${GRAFANA_CONFIG.dashboardName}' created`);
  }

  return success;
}

/**
 * Generate dashboard configuration
 */
function generateDashboardConfig(testType) {
  return {
    id: null,
    uid: 'dify-load-tests',
    title: GRAFANA_CONFIG.dashboardName,
    tags: ['k6', 'load-testing', 'dify', 'education'],
    timezone: 'browser',
    panels: [
      // Row 1: Key Performance Indicators
      createPanel({
        id: 1,
        title: 'Response Time Percentiles',
        type: 'graph',
        targets: [
          {
            measurement: 'http_req_duration',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'percentile', params: [90] }]
            ],
            alias: 'P90'
          },
          {
            measurement: 'http_req_duration',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'percentile', params: [95] }]
            ],
            alias: 'P95'
          }
        ],
        gridPos: { h: 8, w: 12, x: 0, y: 0 }
      }),

      createPanel({
        id: 2,
        title: 'Request Rate & Error Rate',
        type: 'graph',
        targets: [
          {
            measurement: 'http_reqs',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'mean' }]
            ],
            alias: 'Requests/sec'
          },
          {
            measurement: 'http_req_failed',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'mean' }]
            ],
            alias: 'Error Rate'
          }
        ],
        gridPos: { h: 8, w: 12, x: 12, y: 0 }
      }),

      // Row 2: Education Platform Specific Metrics
      createPanel({
        id: 3,
        title: 'Agent Creation Performance',
        type: 'graph',
        targets: [
          {
            measurement: 'edu_agent_creation_duration',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'mean' }]
            ],
            alias: 'Avg Creation Time'
          },
          {
            measurement: 'edu_agent_creation_success',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'mean' }]
            ],
            alias: 'Success Rate'
          }
        ],
        gridPos: { h: 8, w: 8, x: 0, y: 8 }
      }),

      createPanel({
        id: 4,
        title: 'LLM Performance',
        type: 'graph',
        targets: [
          {
            measurement: 'edu_llm_request_duration',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'percentile', params: [90] }]
            ],
            alias: 'LLM P90 Response Time'
          },
          {
            measurement: 'edu_llm_success_rate',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'mean' }]
            ],
            alias: 'LLM Success Rate'
          }
        ],
        gridPos: { h: 8, w: 8, x: 8, y: 8 }
      }),

      createPanel({
        id: 5,
        title: 'Virtual Users',
        type: 'graph',
        targets: [
          {
            measurement: 'vus',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'max' }]
            ],
            alias: 'Active VUs'
          }
        ],
        gridPos: { h: 8, w: 8, x: 16, y: 8 }
      }),

      // Row 3: System Resources
      createPanel({
        id: 6,
        title: 'WebSocket Connections',
        type: 'graph',
        targets: [
          {
            measurement: 'edu_ws_active_connections',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'max' }]
            ],
            alias: 'Active WebSocket Connections'
          },
          {
            measurement: 'edu_ws_message_latency',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'mean' }]
            ],
            alias: 'Message Latency'
          }
        ],
        gridPos: { h: 8, w: 12, x: 0, y: 16 },
        condition: testType === 'websocket_test'
      }),

      createPanel({
        id: 7,
        title: 'System Errors',
        type: 'graph',
        targets: [
          {
            measurement: 'edu_system_errors',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'sum' }]
            ],
            alias: 'Total Errors'
          },
          {
            measurement: 'edu_circuit_breaker_trips',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'sum' }]
            ],
            alias: 'Circuit Breaker Trips'
          }
        ],
        gridPos: { h: 8, w: 12, x: 12, y: 16 }
      }),

      // Row 4: Detailed Metrics Table
      createPanel({
        id: 8,
        title: 'Test Summary Table',
        type: 'table',
        targets: [
          {
            measurement: 'http_req_duration',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'percentile', params: [50] }],
              [{ type: 'alias', params: ['P50'] }]
            ]
          },
          {
            measurement: 'http_req_duration',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'percentile', params: [90] }],
              [{ type: 'alias', params: ['P90'] }]
            ]
          },
          {
            measurement: 'http_req_duration',
            select: [
              [{ type: 'field', params: ['value'] }],
              [{ type: 'percentile', params: [95] }],
              [{ type: 'alias', params: ['P95'] }]
            ]
          }
        ],
        gridPos: { h: 8, w: 24, x: 0, y: 24 }
      })
    ].filter(panel => panel.condition !== false), // Filter out conditional panels

    time: {
      from: 'now-1h',
      to: 'now'
    },
    timepicker: {
      refresh_intervals: ['1s', '5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d']
    },
    templating: {
      list: []
    },
    annotations: {
      list: []
    },
    refresh: '5s',
    schemaVersion: 16,
    version: 1,
    links: []
  };
}

/**
 * Create individual panel configuration
 */
function createPanel({ id, title, type, targets, gridPos, condition = true }) {
  return {
    id,
    title,
    type,
    datasource: GRAFANA_CONFIG.datasourceName,
    targets: targets.map(target => ({
      ...target,
      datasource: GRAFANA_CONFIG.datasourceName,
      groupBy: [
        { type: 'time', params: ['$__interval'] },
        { type: 'fill', params: ['null'] }
      ]
    })),
    gridPos,
    condition,
    xAxis: {
      show: true,
      mode: 'time'
    },
    yAxes: [
      {
        show: true,
        logBase: 1,
        min: null,
        max: null
      }
    ],
    lines: true,
    fill: 1,
    linewidth: 2,
    pointradius: 5,
    points: false,
    bars: false,
    stack: false,
    percentage: false,
    legend: {
      show: true,
      values: false,
      min: false,
      max: false,
      current: false,
      total: false,
      avg: false
    },
    nullPointMode: 'null',
    steppedLine: false,
    tooltip: {
      value_type: 'individual'
    },
    timeFrom: null,
    timeShift: null
  };
}

/**
 * Export metrics data to InfluxDB (via Grafana)
 */
function exportMetricsData(testResults, testType) {
  try {
    // Convert k6 metrics to InfluxDB line protocol
    const metricsData = convertToInfluxLineProtocol(testResults, testType);

    // Send to InfluxDB endpoint
    const response = http.post(
      `${GRAFANA_CONFIG.url}/api/datasources/proxy/1/write?db=k6`,
      metricsData,
      {
        headers: {
          'Authorization': `Bearer ${GRAFANA_CONFIG.apiKey}`,
          'Content-Type': 'text/plain'
        }
      }
    );

    const success = check(response, {
      'metrics exported': (r) => r.status === 204
    });

    if (success) {
      console.log(`✅ Exported ${metricsData.split('\n').length} metric data points`);
    }

    return success;

  } catch (error) {
    console.error(`Failed to export metrics: ${error.message}`);
    return false;
  }
}

/**
 * Convert k6 metrics to InfluxDB line protocol format
 */
function convertToInfluxLineProtocol(testResults, testType) {
  const timestamp = Date.now() * 1000000; // InfluxDB expects nanosecond precision
  const lines = [];

  // HTTP metrics
  if (testResults.metrics.http_req_duration) {
    const metric = testResults.metrics.http_req_duration;
    lines.push(`http_req_duration,test_type=${testType} avg=${metric.avg},p90=${metric.p90},p95=${metric.p95} ${timestamp}`);
  }

  if (testResults.metrics.http_reqs) {
    lines.push(`http_reqs,test_type=${testType} count=${testResults.metrics.http_reqs.count},rate=${testResults.metrics.http_reqs.rate} ${timestamp}`);
  }

  if (testResults.metrics.http_req_failed) {
    lines.push(`http_req_failed,test_type=${testType} rate=${testResults.metrics.http_req_failed.rate} ${timestamp}`);
  }

  // Virtual Users
  if (testResults.metrics.vus) {
    lines.push(`vus,test_type=${testType} value=${testResults.metrics.vus.value} ${timestamp}`);
  }

  if (testResults.metrics.vus_max) {
    lines.push(`vus_max,test_type=${testType} value=${testResults.metrics.vus_max.value} ${timestamp}`);
  }

  // Data transfer
  if (testResults.metrics.data_received) {
    lines.push(`data_received,test_type=${testType} count=${testResults.metrics.data_received.count} ${timestamp}`);
  }

  if (testResults.metrics.data_sent) {
    lines.push(`data_sent,test_type=${testType} count=${testResults.metrics.data_sent.count} ${timestamp}`);
  }

  // Education-specific metrics (if available)
  const educationMetrics = [
    'edu_login_duration',
    'edu_agent_creation_duration',
    'edu_llm_request_duration',
    'edu_workflow_execution_duration',
    'edu_ws_message_latency'
  ];

  educationMetrics.forEach(metricName => {
    if (testResults.metrics[metricName]) {
      const metric = testResults.metrics[metricName];
      lines.push(`${metricName},test_type=${testType} avg=${metric.avg || 0},p90=${metric.p90 || 0} ${timestamp}`);
    }
  });

  return lines.join('\n');
}

/**
 * Create annotation for test run
 */
export function createTestAnnotation(testType, testDuration, testResults) {
  const annotation = {
    time: Date.now(),
    timeEnd: Date.now() + (testDuration * 1000),
    tags: [testType, 'k6-test'],
    text: `Load test completed: ${testType}`,
    title: 'K6 Load Test',
    data: {
      testType,
      duration: testDuration,
      totalRequests: testResults.metrics.http_reqs?.count || 0,
      errorRate: testResults.metrics.http_req_failed?.rate || 0,
      maxVUs: testResults.metrics.vus_max?.value || 0
    }
  };

  const response = http.post(
    `${GRAFANA_CONFIG.url}/api/annotations`,
    JSON.stringify(annotation),
    {
      headers: {
        'Authorization': `Bearer ${GRAFANA_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const success = check(response, {
    'annotation created': (r) => r.status === 200
  });

  if (success) {
    console.log(`✅ Created test annotation in Grafana`);
  }

  return success;
}

export default {
  exportToGrafana,
  createTestAnnotation,
  GRAFANA_CONFIG
};