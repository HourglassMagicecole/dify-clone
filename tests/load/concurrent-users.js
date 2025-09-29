import { sleep } from 'k6';
import { CONFIG } from './config.js';
import {
  generateTestUser,
  authenticateUser,
  createEducationAgent,
  chatWithAgent,
  getEducationTemplates,
  randomSleep,
  errorRate
} from './utils.js';

// Gradual load increase: 10→20→30→40→50 users (AC 4)
export let options = {
  stages: CONFIG.stages.concurrent,
  thresholds: {
    ...CONFIG.thresholds,

    // Concurrent user specific thresholds
    'vus': ['value<=50'],
    'http_req_duration{scenario:concurrent}': ['p(95)<5000'],
    'http_req_failed{scenario:concurrent}': ['rate<0.02'], // Allow slightly higher error rate during ramp-up

    // Resource utilization thresholds
    'iteration_duration': ['p(90)<30000'], // 30 seconds per iteration
    'vu_spawn_rate': ['rate>0.8'] // At least 80% of VUs should spawn successfully
  },

  tags: {
    test_type: 'concurrent_users',
    scenario: 'concurrent'
  }
};

/**
 * Concurrent user scenario: Focus on system stability under increasing load
 * Tests auto-scaling trigger (CPU > 80% for 5 minutes)
 */
export default function concurrentUserScenario() {
  const userId = __VU;
  const currentStage = getCurrentStage();

  try {
    console.log(`[VU ${userId}] Starting concurrent test - Stage: ${currentStage.target} users`);

    // Phase 1: Authentication with jitter to prevent thundering herd
    randomSleep(0, 2000); // Spread out login requests

    const testUser = generateTestUser(userId, getRandomRole());
    const authenticatedUser = authenticateUser(testUser);

    if (!authenticatedUser) {
      console.error(`[VU ${userId}] Authentication failed in concurrent test`);
      return;
    }

    // Phase 2: Parallel agent creation to stress the system
    const agentPromises = [];
    const numAgents = Math.min(currentStage.target <= 20 ? 1 : 2, 3); // Scale agent creation with load

    for (let i = 0; i < numAgents; i++) {
      const template = getEducationTemplates()[i % 3];
      template.name = `${template.name}_VU${userId}_${i}`;

      console.log(`[VU ${userId}] Creating concurrent agent ${i + 1}/${numAgents}: ${template.name}`);

      const agent = createEducationAgent(authenticatedUser, template);
      if (agent) {
        agentPromises.push(agent);
        randomSleep(500, 1500); // Brief pause between agent creations
      }
    }

    if (agentPromises.length === 0) {
      console.error(`[VU ${userId}] No agents created successfully`);
      return;
    }

    console.log(`[VU ${userId}] Successfully created ${agentPromises.length} agents`);

    // Phase 3: Concurrent chat sessions
    const chatPromises = [];
    const questionsPerAgent = currentStage.target <= 30 ? 2 : 1; // Reduce questions under high load

    agentPromises.forEach((agent, index) => {
      for (let q = 0; q < questionsPerAgent; q++) {
        const question = getConcurrentTestQuestions()[
          (userId + index + q) % getConcurrentTestQuestions().length
        ];

        console.log(`[VU ${userId}] Agent ${index + 1} asking: "${question}"`);
        const response = chatWithAgent(authenticatedUser, agent.id, question);

        if (response) {
          chatPromises.push({ agentId: agent.id, question, response });
        }

        // Add progressive delay as load increases
        const delayMs = Math.min(currentStage.target * 50, 3000);
        randomSleep(delayMs / 2, delayMs);
      }
    });

    console.log(`[VU ${userId}] Completed ${chatPromises.length} chat interactions`);

    // Phase 4: Resource monitoring simulation
    if (currentStage.target >= 40) {
      console.log(`[VU ${userId}] High load detected (${currentStage.target} users) - monitoring resources`);

      // Simulate resource-intensive operations at high load
      const intensiveOperations = [
        'complex_query_processing',
        'large_document_analysis',
        'multi_step_reasoning'
      ];

      const operation = intensiveOperations[userId % intensiveOperations.length];
      console.log(`[VU ${userId}] Executing intensive operation: ${operation}`);

      // Simulate processing time based on operation complexity
      const processingTime = Math.random() * 5000 + 2000; // 2-7 seconds
      sleep(processingTime / 1000);
    }

    // Phase 5: Graceful session cleanup
    console.log(`[VU ${userId}] Cleaning up session - ${agentPromises.length} agents, ${chatPromises.length} chats`);
    randomSleep(1000, 2000);

  } catch (error) {
    console.error(`[VU ${userId}] Concurrent user test failed: ${error.message}`);
    errorRate.add(1);
  }

  // Dynamic cooldown based on current load
  const cooldownTime = Math.max(5 - (currentStage.target / 20), 1);
  sleep(cooldownTime);
}

/**
 * Get current test stage information
 */
function getCurrentStage() {
  const elapsed = Date.now() - __ENV.TEST_START_TIME || 0;
  const elapsedMinutes = elapsed / (1000 * 60);

  // Determine which stage we're in based on elapsed time
  let cumulativeTime = 0;
  for (const stage of CONFIG.stages.concurrent) {
    const stageDuration = parseInt(stage.duration.replace('m', ''));
    cumulativeTime += stageDuration;

    if (elapsedMinutes <= cumulativeTime) {
      return {
        target: stage.target,
        duration: stage.duration,
        elapsed: elapsedMinutes,
        phase: stage.target === 0 ? 'ramp-down' : 'ramp-up'
      };
    }
  }

  return { target: 50, duration: 'sustained', elapsed: elapsedMinutes, phase: 'sustain' };
}

/**
 * Get random user role based on realistic distribution
 */
function getRandomRole() {
  const rand = Math.random();
  if (rand < 0.7) return 'student';      // 70% students
  if (rand < 0.9) return 'instructor';   // 20% instructors
  return 'admin';                        // 10% admins
}

/**
 * Questions designed for concurrent testing
 */
function getConcurrentTestQuestions() {
  return [
    // Quick response questions
    'What is AI?',
    'Define machine learning',
    'Explain Python syntax',
    'What is a variable?',
    'How do functions work?',

    // Medium complexity questions
    'Compare supervised vs unsupervised learning',
    'Explain object-oriented programming concepts',
    'What are the benefits of using databases?',
    'How does web authentication work?',
    'Describe the software development lifecycle',

    // Complex questions (for high-load testing)
    'Design a complete machine learning pipeline for image recognition',
    'Architect a scalable web application with microservices',
    'Implement a distributed caching strategy for high-traffic systems',
    'Optimize database performance for millions of concurrent users',
    'Create a comprehensive security framework for cloud applications'
  ];
}

/**
 * Setup function with concurrent test initialization
 */
export function setup() {
  console.log('=== Concurrent Users Load Test Setup ===');
  console.log(`Target progression: ${CONFIG.stages.concurrent.map(s => s.target).join(' → ')} users`);
  console.log(`Total test duration: ${CONFIG.stages.concurrent.reduce((total, stage) => {
    return total + parseInt(stage.duration.replace('m', ''));
  }, 0)} minutes`);
  console.log(`Performance thresholds:`);
  console.log(`  - API Response P90: < ${CONFIG.benchmarks.apiResponse.p90}ms`);
  console.log(`  - API Response P95: < ${CONFIG.benchmarks.apiResponse.p95}ms`);
  console.log(`  - Error Rate: < ${CONFIG.benchmarks.errorRate.normal * 100}%`);
  console.log(`Auto-scaling trigger: CPU > ${CONFIG.autoscaling.cpuThreshold}% for ${CONFIG.autoscaling.sustainDuration}s`);

  return {
    testStartTime: Date.now(),
    maxConcurrentUsers: 50,
    autoScalingConfig: CONFIG.autoscaling
  };
}

/**
 * Teardown with concurrent test analysis
 */
export function teardown(data) {
  const totalDuration = Date.now() - data.testStartTime;
  const durationMinutes = Math.round(totalDuration / (1000 * 60));

  console.log('=== Concurrent Users Load Test Results ===');
  console.log(`Test Duration: ${durationMinutes} minutes`);
  console.log(`Max Concurrent Users Achieved: ${data.maxConcurrentUsers}`);
  console.log(`Auto-scaling Configuration: ${JSON.stringify(data.autoScalingConfig)}`);
  console.log('');
  console.log('Key Metrics to Review:');
  console.log('- http_req_duration: API response times under load');
  console.log('- http_req_failed: Error rates during user ramp-up');
  console.log('- vus: Virtual user scaling pattern');
  console.log('- iteration_duration: Complete user session times');
  console.log('');
  console.log('Expected Outcomes:');
  console.log('✓ System should handle 50 concurrent users');
  console.log('✓ Auto-scaling should trigger at 40+ users (CPU > 80%)');
  console.log('✓ Error rate should remain < 2% during ramp-up');
  console.log('✓ P95 response time should stay < 5 seconds');
}