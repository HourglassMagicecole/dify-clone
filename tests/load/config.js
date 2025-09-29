// k6 Performance Testing Configuration
export const CONFIG = {
  // Base URLs
  API_BASE_URL: __ENV.API_URL || 'http://localhost:5001',
  WS_BASE_URL: __ENV.WS_URL || 'ws://localhost:5001',

  // Performance Benchmarks (AC 4)
  benchmarks: {
    apiResponse: {
      p90: 3000,  // 90th percentile < 3 seconds
      p95: 5000   // 95th percentile < 5 seconds
    },
    llmResponse: {
      p90: 30000  // LLM response < 30 seconds
    },
    errorRate: {
      normal: 0.01,   // < 1% error rate (normal)
      critical: 0.05  // > 5% error rate (danger)
    },
    resources: {
      cpu: {
        normal: 70,   // < 70% CPU usage (normal)
        critical: 85  // > 85% CPU usage (danger)
      },
      memory: {
        normal: 2 * 1024 * 1024 * 1024,  // < 2GB (normal)
        critical: 3 * 1024 * 1024 * 1024 // > 3GB (danger)
      }
    }
  },

  // Test Stages (AC 5)
  stages: {
    // Gradual ramp-up: 10→20→30→40→50 users
    concurrent: [
      { duration: '2m', target: 10 },
      { duration: '2m', target: 20 },
      { duration: '2m', target: 30 },
      { duration: '2m', target: 40 },
      { duration: '2m', target: 50 },
      { duration: '3m', target: 50 }, // sustain 50 users
      { duration: '2m', target: 0 }   // ramp down
    ],

    // Stress test stages
    stress: [
      { duration: '1m', target: 20 },
      { duration: '2m', target: 50 },
      { duration: '3m', target: 100 },
      { duration: '2m', target: 150 },
      { duration: '1m', target: 0 }
    ]
  },

  // Test Thresholds
  thresholds: {
    // HTTP request duration
    'http_req_duration': [
      'p(90)<3000',  // 90% of requests under 3s
      'p(95)<5000'   // 95% of requests under 5s
    ],

    // LLM-specific requests (longer timeout)
    'http_req_duration{endpoint:llm}': ['p(90)<30000'],

    // Error rate
    'http_req_failed': ['rate<0.01'], // <1% errors

    // WebSocket connection
    'ws_session_duration': ['p(95)<100'],
    'ws_msgs_received': ['rate>0.9'],

    // Custom metrics
    'iteration_duration': ['p(95)<60000'], // Full scenario under 1min
    'login_duration': ['p(95)<2000'],      // Login under 2s
    'agent_creation_duration': ['p(95)<10000'] // Agent creation under 10s
  },

  // Test Data
  testUsers: {
    count: 50,
    roles: ['student', 'instructor', 'admin'],
    credentials: {
      student: { username: 'student_{id}', password: 'test123' },
      instructor: { username: 'instructor_{id}', password: 'test123' },
      admin: { username: 'admin_{id}', password: 'admin123' }
    }
  },

  // Retry & Rate Limiting Configuration
  retry: {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    backoffMultiplier: 2
  },

  // Auto-scaling trigger thresholds
  autoscaling: {
    cpuThreshold: 80,      // Trigger at 80% CPU
    sustainDuration: 300,  // for 5 minutes (300 seconds)
    scaleUpFactor: 2,
    scaleDownFactor: 0.5
  }
};

// Environment-specific overrides
if (__ENV.ENVIRONMENT === 'production') {
  CONFIG.API_BASE_URL = 'https://api.dify-edu.example.com';
  CONFIG.testUsers.count = 200;
} else if (__ENV.ENVIRONMENT === 'staging') {
  CONFIG.API_BASE_URL = 'https://staging-api.dify-edu.example.com';
  CONFIG.testUsers.count = 100;
}

export default CONFIG;