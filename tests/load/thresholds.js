// Performance Thresholds Configuration (AC 4)
// Defines success criteria for load testing based on requirements

import { CONFIG } from './config.js';

/**
 * Global performance thresholds based on Story 0.5 requirements
 */
export const PERFORMANCE_THRESHOLDS = {
  // HTTP Request Performance (AC 4)
  http: {
    // API response time benchmarks
    'http_req_duration': [
      `p(90)<${CONFIG.benchmarks.apiResponse.p90}`,  // 90th percentile < 3 seconds
      `p(95)<${CONFIG.benchmarks.apiResponse.p95}`,  // 95th percentile < 5 seconds
      `p(99)<${CONFIG.benchmarks.apiResponse.p95 * 2}` // 99th percentile < 10 seconds
    ],

    // LLM-specific response times
    'http_req_duration{endpoint:llm}': [
      `p(90)<${CONFIG.benchmarks.llmResponse.p90}`,    // LLM P90 < 30 seconds
      `p(95)<${CONFIG.benchmarks.llmResponse.p90 * 1.5}`, // LLM P95 < 45 seconds
      'p(99)<60000'  // LLM P99 < 60 seconds
    ],

    // Error rate thresholds
    'http_req_failed': [
      `rate<${CONFIG.benchmarks.errorRate.normal}`,   // < 1% error rate (normal)
      `rate<${CONFIG.benchmarks.errorRate.critical}`  // < 5% error rate (critical threshold)
    ],

    // Request rate thresholds
    'http_reqs': [
      'rate>10',  // Minimum 10 requests per second
      'rate<1000' // Maximum 1000 requests per second
    ]
  },

  // WebSocket Performance
  websocket: {
    'ws_session_duration': ['p(95)<100'], // Connection establishment < 100ms
    'ws_connection_errors': ['rate<0.05'], // < 5% connection errors
    'ws_realtime_latency': ['p(90)<500'],  // Message latency < 500ms
    'ws_msgs_received': ['rate>0.9']       // > 90% message delivery success
  },

  // Custom Education Platform Metrics
  education: {
    // Agent creation performance
    'agent_creation_duration': [
      'p(90)<10000',  // Agent creation P90 < 10 seconds
      'p(95)<15000'   // Agent creation P95 < 15 seconds
    ],

    // Authentication performance
    'login_duration': [
      'p(90)<2000',   // Login P90 < 2 seconds
      'p(95)<3000'    // Login P95 < 3 seconds
    ],

    // Workflow execution performance
    'workflow_execution_duration': [
      'p(90)<30000',  // Workflow P90 < 30 seconds
      'p(95)<45000'   // Workflow P95 < 45 seconds
    ],

    // Overall iteration performance
    'iteration_duration': [
      'p(90)<60000',  // Complete scenario P90 < 60 seconds
      'p(95)<90000'   // Complete scenario P95 < 90 seconds
    ]
  },

  // System Resource Thresholds
  system: {
    // Virtual User limits
    'vus': ['value<=50'],           // Max 50 concurrent users
    'vus_max': ['value<=50'],       // Max VUs ever reached <= 50

    // Data transfer
    'data_received': [
      'rate>1024',      // Min 1KB/s data received
      'rate<10485760'   // Max 10MB/s data received
    ],
    'data_sent': [
      'rate>512',       // Min 0.5KB/s data sent
      'rate<5242880'    // Max 5MB/s data sent
    ]
  },

  // Stress Test Specific Thresholds
  stress: {
    'stress_test_errors': ['rate<0.15'],      // < 15% errors under extreme stress
    'system_recovery_time': ['p(95)<30000'],  // Recovery within 30 seconds
    'resource_exhaustion_events': ['count<50'], // Limit resource exhaustion
    'circuit_breaker_trips': ['count<20']     // Limit circuit breaker activations
  },

  // Concurrent User Test Thresholds
  concurrent: {
    'http_req_duration{scenario:concurrent}': ['p(95)<5000'], // 5s under concurrent load
    'http_req_failed{scenario:concurrent}': ['rate<0.02'],    // 2% errors during ramp-up
    'vu_spawn_rate': ['rate>0.8']                             // 80% VU spawn success
  }
};

/**
 * Scenario-specific threshold configurations
 */
export const SCENARIO_THRESHOLDS = {
  education_session: {
    ...PERFORMANCE_THRESHOLDS.http,
    ...PERFORMANCE_THRESHOLDS.education,
    ...PERFORMANCE_THRESHOLDS.system
  },

  concurrent_users: {
    ...PERFORMANCE_THRESHOLDS.http,
    ...PERFORMANCE_THRESHOLDS.concurrent,
    ...PERFORMANCE_THRESHOLDS.system
  },

  websocket_test: {
    ...PERFORMANCE_THRESHOLDS.websocket,
    ...PERFORMANCE_THRESHOLDS.http
  },

  stress_test: {
    ...PERFORMANCE_THRESHOLDS.stress,
    // More lenient HTTP thresholds for stress testing
    'http_req_duration': ['p(90)<10000', 'p(95)<15000'],
    'http_req_failed': ['rate<0.1'] // Allow 10% errors under stress
  }
};

/**
 * Performance benchmark validation
 */
export function validatePerformanceBenchmarks(results) {
  const validation = {
    passed: [],
    failed: [],
    warnings: []
  };

  // Check API response time benchmarks
  if (results.http_req_duration) {
    const p90 = results.http_req_duration.p90;
    const p95 = results.http_req_duration.p95;

    if (p90 <= CONFIG.benchmarks.apiResponse.p90) {
      validation.passed.push(`API P90 response time: ${p90}ms (✓ < ${CONFIG.benchmarks.apiResponse.p90}ms)`);
    } else {
      validation.failed.push(`API P90 response time: ${p90}ms (✗ >= ${CONFIG.benchmarks.apiResponse.p90}ms)`);
    }

    if (p95 <= CONFIG.benchmarks.apiResponse.p95) {
      validation.passed.push(`API P95 response time: ${p95}ms (✓ < ${CONFIG.benchmarks.apiResponse.p95}ms)`);
    } else {
      validation.failed.push(`API P95 response time: ${p95}ms (✗ >= ${CONFIG.benchmarks.apiResponse.p95}ms)`);
    }
  }

  // Check error rate benchmarks
  if (results.http_req_failed) {
    const errorRate = results.http_req_failed.rate;
    if (errorRate < CONFIG.benchmarks.errorRate.normal) {
      validation.passed.push(`Error rate: ${(errorRate * 100).toFixed(2)}% (✓ < ${CONFIG.benchmarks.errorRate.normal * 100}%)`);
    } else if (errorRate < CONFIG.benchmarks.errorRate.critical) {
      validation.warnings.push(`Error rate: ${(errorRate * 100).toFixed(2)}% (⚠ between normal and critical thresholds)`);
    } else {
      validation.failed.push(`Error rate: ${(errorRate * 100).toFixed(2)}% (✗ >= ${CONFIG.benchmarks.errorRate.critical * 100}%)`);
    }
  }

  // Check concurrent user performance
  if (results.vus_max) {
    const maxUsers = results.vus_max.value;
    if (maxUsers >= 50) {
      validation.passed.push(`Concurrent users: ${maxUsers} (✓ reached target of 50)`);
    } else {
      validation.failed.push(`Concurrent users: ${maxUsers} (✗ did not reach target of 50)`);
    }
  }

  return validation;
}

/**
 * Auto-scaling threshold monitoring
 */
export function getAutoScalingThresholds() {
  return {
    cpu: {
      trigger: CONFIG.autoscaling.cpuThreshold,      // 80% CPU triggers scaling
      duration: CONFIG.autoscaling.sustainDuration,  // Sustained for 5 minutes
      scaleUp: CONFIG.autoscaling.scaleUpFactor,     // Scale up by 2x
      scaleDown: CONFIG.autoscaling.scaleDownFactor  // Scale down by 0.5x
    },
    memory: {
      normal: CONFIG.benchmarks.resources.memory.normal,     // < 2GB normal
      critical: CONFIG.benchmarks.resources.memory.critical  // > 3GB critical
    }
  };
}

/**
 * Generate threshold configuration for k6 options
 */
export function generateK6Thresholds(scenario = 'education_session') {
  return SCENARIO_THRESHOLDS[scenario] || SCENARIO_THRESHOLDS.education_session;
}

/**
 * Performance grade calculation
 */
export function calculatePerformanceGrade(results) {
  const validation = validatePerformanceBenchmarks(results);
  const totalChecks = validation.passed.length + validation.failed.length + validation.warnings.length;

  if (totalChecks === 0) return { grade: 'N/A', score: 0 };

  const passedScore = validation.passed.length * 100;
  const warningScore = validation.warnings.length * 50;
  const failedScore = validation.failed.length * 0;

  const totalScore = (passedScore + warningScore + failedScore) / totalChecks;

  let grade;
  if (totalScore >= 90) grade = 'A';
  else if (totalScore >= 80) grade = 'B';
  else if (totalScore >= 70) grade = 'C';
  else if (totalScore >= 60) grade = 'D';
  else grade = 'F';

  return {
    grade,
    score: Math.round(totalScore),
    details: {
      passed: validation.passed.length,
      warnings: validation.warnings.length,
      failed: validation.failed.length,
      total: totalChecks
    }
  };
}

export default PERFORMANCE_THRESHOLDS;