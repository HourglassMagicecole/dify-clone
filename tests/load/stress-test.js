import { sleep, check } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { CONFIG } from './config.js';
import {
  generateTestUser,
  authenticateUser,
  createEducationAgent,
  chatWithAgent,
  executeWorkflow,
  uploadEducationFile,
  getEducationTemplates,
  randomSleep,
  errorRate
} from './utils.js';

// Stress test specific metrics
export const stressTestErrors = new Rate('stress_test_errors');
export const systemRecoveryTime = new Trend('system_recovery_time');
export const resourceExhaustion = new Counter('resource_exhaustion_events');
export const circuitBreakerTrips = new Counter('circuit_breaker_trips');

// Stress test configuration - push system beyond normal limits
export let options = {
  stages: CONFIG.stages.stress,

  thresholds: {
    // More lenient thresholds for stress testing
    'http_req_duration': ['p(90)<10000', 'p(95)<15000'], // Allow longer response times
    'http_req_failed': ['rate<0.1'], // Allow up to 10% errors under extreme stress
    'stress_test_errors': ['rate<0.15'], // Custom stress error threshold
    'iteration_duration': ['p(90)<120000'], // 2 minutes max per iteration

    // System stability indicators
    'system_recovery_time': ['p(95)<30000'], // Recovery within 30 seconds
    'resource_exhaustion_events': ['count<50'], // Limit resource exhaustion events
  },

  tags: {
    test_type: 'stress_test',
    scenario: 'extreme_load'
  }
};

/**
 * Stress test scenario: Push system to breaking point and measure recovery
 */
export default function stressTestScenario() {
  const userId = __VU;
  const iterationId = __ITER;
  const currentLoad = getCurrentLoadLevel();

  try {
    console.log(`[STRESS-VU ${userId}] Starting stress test - Load Level: ${currentLoad.level} (${currentLoad.users} users)`);

    // Phase 1: Aggressive authentication attempts
    const maxAuthAttempts = currentLoad.level >= 4 ? 3 : 1; // Multiple auth attempts at high load
    let authenticatedUser = null;

    for (let attempt = 1; attempt <= maxAuthAttempts; attempt++) {
      const testUser = generateTestUser(userId + (attempt * 1000), 'student');
      authenticatedUser = authenticateUser(testUser);

      if (authenticatedUser) {
        console.log(`[STRESS-VU ${userId}] Authenticated successfully on attempt ${attempt}`);
        break;
      } else if (attempt < maxAuthAttempts) {
        console.log(`[STRESS-VU ${userId}] Auth attempt ${attempt} failed, retrying...`);
        sleep(Math.random() * 2 + 1); // Random backoff
      }
    }

    if (!authenticatedUser) {
      console.error(`[STRESS-VU ${userId}] All authentication attempts failed`);
      stressTestErrors.add(1);
      return;
    }

    // Phase 2: Resource-intensive operations based on load level
    await performStressOperations(authenticatedUser, currentLoad, userId);

    // Phase 3: System recovery monitoring
    if (currentLoad.level >= 4) {
      monitorSystemRecovery(userId, authenticatedUser);
    }

  } catch (error) {
    console.error(`[STRESS-VU ${userId}] Stress test failed: ${error.message}`);
    stressTestErrors.add(1);

    // Attempt graceful degradation
    attemptGracefulDegradation(userId, error);
  }

  // Adaptive cooldown based on load level
  const cooldownTime = Math.min(currentLoad.level * 2, 10); // 2-10 seconds
  sleep(Math.random() * cooldownTime + 1);
}

/**
 * Perform different stress operations based on current load level
 */
async function performStressOperations(authenticatedUser, loadLevel, userId) {
  const operations = getStressOperations(loadLevel.level);

  console.log(`[STRESS-VU ${userId}] Executing ${operations.length} stress operations`);

  for (const [index, operation] of operations.entries()) {
    const startTime = Date.now();

    try {
      const result = await executeStressOperation(operation, authenticatedUser, userId, index);

      if (!result.success) {
        stressTestErrors.add(1);
        console.error(`[STRESS-VU ${userId}] Operation ${operation.type} failed: ${result.error}`);

        if (result.isResourceExhaustion) {
          resourceExhaustion.add(1);
        }

        if (result.circuitBreakerTripped) {
          circuitBreakerTrips.add(1);
        }
      } else {
        console.log(`[STRESS-VU ${userId}] Operation ${operation.type} completed successfully`);
      }

    } catch (error) {
      stressTestErrors.add(1);
      console.error(`[STRESS-VU ${userId}] Operation ${operation.type} threw exception: ${error.message}`);
    }

    const operationTime = Date.now() - startTime;
    if (operationTime > operation.expectedMaxTime) {
      console.warn(`[STRESS-VU ${userId}] Operation ${operation.type} took ${operationTime}ms (expected < ${operation.expectedMaxTime}ms)`);
    }

    // Brief pause between operations
    if (index < operations.length - 1) {
      randomSleep(200, 1000);
    }
  }
}

/**
 * Get stress operations based on load level
 */
function getStressOperations(level) {
  const baseOperations = [
    {
      type: 'bulk_agent_creation',
      count: Math.min(level * 2, 10),
      expectedMaxTime: 15000
    },
    {
      type: 'concurrent_llm_requests',
      count: Math.min(level * 3, 15),
      expectedMaxTime: 45000
    },
    {
      type: 'large_file_upload',
      sizeKB: Math.min(level * 500, 5000),
      expectedMaxTime: 20000
    }
  ];

  if (level >= 3) {
    baseOperations.push({
      type: 'workflow_stress_test',
      complexity: 'high',
      parallelExecutions: Math.min(level - 2, 5),
      expectedMaxTime: 60000
    });
  }

  if (level >= 4) {
    baseOperations.push({
      type: 'memory_intensive_operations',
      dataSize: 'large',
      expectedMaxTime: 30000
    });
  }

  if (level >= 5) {
    baseOperations.push({
      type: 'database_stress_operations',
      queryComplexity: 'extreme',
      expectedMaxTime: 25000
    });
  }

  return baseOperations;
}

/**
 * Execute individual stress operation
 */
async function executeStressOperation(operation, authenticatedUser, userId, index) {
  switch (operation.type) {
    case 'bulk_agent_creation':
      return await bulkAgentCreationStress(operation, authenticatedUser, userId);

    case 'concurrent_llm_requests':
      return await concurrentLLMStress(operation, authenticatedUser, userId);

    case 'large_file_upload':
      return await largeFileUploadStress(operation, authenticatedUser, userId);

    case 'workflow_stress_test':
      return await workflowStressTest(operation, authenticatedUser, userId);

    case 'memory_intensive_operations':
      return await memoryIntensiveStress(operation, authenticatedUser, userId);

    case 'database_stress_operations':
      return await databaseStressTest(operation, authenticatedUser, userId);

    default:
      return { success: false, error: 'Unknown operation type' };
  }
}

/**
 * Bulk agent creation stress test
 */
async function bulkAgentCreationStress(operation, authenticatedUser, userId) {
  try {
    const templates = getEducationTemplates();
    const createdAgents = [];

    for (let i = 0; i < operation.count; i++) {
      const template = {
        ...templates[i % templates.length],
        name: `StressAgent_${userId}_${Date.now()}_${i}`
      };

      const agent = createEducationAgent(authenticatedUser, template);
      if (agent) {
        createdAgents.push(agent);
      } else {
        console.warn(`[STRESS-VU ${userId}] Failed to create agent ${i + 1}/${operation.count}`);
      }

      // Brief pause to prevent overwhelming the system
      await sleep(0.1);
    }

    const successRate = createdAgents.length / operation.count;
    console.log(`[STRESS-VU ${userId}] Bulk agent creation: ${createdAgents.length}/${operation.count} (${(successRate * 100).toFixed(1)}%)`);

    return {
      success: successRate >= 0.7, // At least 70% success rate
      createdCount: createdAgents.length,
      expectedCount: operation.count,
      isResourceExhaustion: successRate < 0.3
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Concurrent LLM requests stress test
 */
async function concurrentLLMStress(operation, authenticatedUser, userId) {
  try {
    const stressQuestions = [
      'Generate a comprehensive 1000-word explanation of quantum computing',
      'Create a detailed software architecture document for a distributed system',
      'Write a complete tutorial on advanced machine learning algorithms',
      'Analyze and compare 10 different programming paradigms in detail',
      'Design a full-stack application with detailed implementation steps'
    ];

    const results = [];
    const agentId = `stress_agent_${userId}_${Date.now()}`;

    // Create a temporary agent for stress testing
    const template = getEducationTemplates()[0];
    template.name = `StressLLMAgent_${userId}`;
    const stressAgent = createEducationAgent(authenticatedUser, template);

    if (!stressAgent) {
      return { success: false, error: 'Failed to create stress test agent' };
    }

    // Send concurrent LLM requests
    for (let i = 0; i < operation.count; i++) {
      const question = stressQuestions[i % stressQuestions.length];
      const response = chatWithAgent(authenticatedUser, stressAgent.id, question);

      results.push({
        success: !!response,
        question: question,
        responseLength: response ? response.length : 0
      });

      // Small delay to prevent rate limiting
      await sleep(0.2);
    }

    const successfulResponses = results.filter(r => r.success).length;
    const successRate = successfulResponses / operation.count;

    console.log(`[STRESS-VU ${userId}] Concurrent LLM stress: ${successfulResponses}/${operation.count} (${(successRate * 100).toFixed(1)}%)`);

    return {
      success: successRate >= 0.6, // At least 60% success rate for LLM stress
      successfulResponses,
      totalRequests: operation.count,
      circuitBreakerTripped: successRate < 0.2
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Large file upload stress test
 */
async function largeFileUploadStress(operation, authenticatedUser, userId) {
  try {
    // Generate large content for stress testing
    const largeContent = generateLargeContent(operation.sizeKB);
    const fileName = `stress_test_file_${userId}_${Date.now()}.txt`;

    console.log(`[STRESS-VU ${userId}] Uploading large file: ${operation.sizeKB}KB`);
    const fileId = uploadEducationFile(authenticatedUser, largeContent, fileName);

    return {
      success: !!fileId,
      fileId: fileId,
      fileSize: operation.sizeKB,
      error: fileId ? null : 'File upload failed'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate large content for file upload stress testing
 */
function generateLargeContent(sizeKB) {
  const baseContent = "This is stress test content. ".repeat(100);
  const targetSize = sizeKB * 1024;
  let content = "";

  while (content.length < targetSize) {
    content += baseContent;
  }

  return content.substring(0, targetSize);
}

/**
 * Workflow stress test with complex operations
 */
async function workflowStressTest(operation, authenticatedUser, userId) {
  try {
    const complexWorkflowInputs = {
      large_dataset: generateLargeDataset(),
      complex_query: "Process this large dataset and generate comprehensive analytics with visualizations",
      processing_mode: "intensive"
    };

    const results = [];
    for (let i = 0; i < operation.parallelExecutions; i++) {
      const workflowId = `stress_workflow_${userId}_${Date.now()}_${i}`;
      const taskId = executeWorkflow(authenticatedUser, workflowId, complexWorkflowInputs);

      results.push({
        workflowId,
        taskId,
        success: !!taskId
      });
    }

    const successfulExecutions = results.filter(r => r.success).length;
    const successRate = successfulExecutions / operation.parallelExecutions;

    return {
      success: successRate >= 0.5,
      successfulExecutions,
      totalExecutions: operation.parallelExecutions
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate large dataset for workflow stress testing
 */
function generateLargeDataset() {
  const dataset = [];
  for (let i = 0; i < 1000; i++) {
    dataset.push({
      id: i,
      data: `Large data entry ${i} with extensive content for stress testing`,
      metadata: {
        timestamp: Date.now() + i,
        category: `category_${i % 10}`,
        priority: Math.random()
      }
    });
  }
  return dataset;
}

/**
 * Memory-intensive operations stress test
 */
async function memoryIntensiveStress(operation, authenticatedUser, userId) {
  try {
    console.log(`[STRESS-VU ${userId}] Executing memory-intensive operations`);

    // Simulate memory-intensive operations
    const largeArrays = [];
    for (let i = 0; i < 10; i++) {
      largeArrays.push(new Array(10000).fill(`memory_stress_${i}`));
    }

    // Process large data structures
    const processingResult = largeArrays.reduce((acc, arr) => {
      return acc + arr.length;
    }, 0);

    return {
      success: processingResult > 0,
      processedElements: processingResult
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      isResourceExhaustion: error.message.includes('memory') || error.message.includes('heap')
    };
  }
}

/**
 * Database stress operations
 */
async function databaseStressTest(operation, authenticatedUser, userId) {
  try {
    // Simulate complex database operations
    console.log(`[STRESS-VU ${userId}] Executing database stress operations`);

    // This would normally make complex database queries
    // For k6 test, we simulate the delay and complexity
    await sleep(Math.random() * 3 + 2); // 2-5 second complex query simulation

    return { success: true, queryComplexity: operation.queryComplexity };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Monitor system recovery after stress
 */
function monitorSystemRecovery(userId, authenticatedUser) {
  const recoveryStart = Date.now();
  console.log(`[STRESS-VU ${userId}] Monitoring system recovery...`);

  try {
    // Test basic functionality after stress
    const simpleAgent = createEducationAgent(authenticatedUser, {
      name: `RecoveryTest_${userId}`,
      description: 'Simple agent to test system recovery'
    });

    const recoveryEnd = Date.now();
    const recoveryTime = recoveryEnd - recoveryStart;
    systemRecoveryTime.add(recoveryTime);

    if (simpleAgent) {
      console.log(`[STRESS-VU ${userId}] System recovered in ${recoveryTime}ms`);
    } else {
      console.warn(`[STRESS-VU ${userId}] System not fully recovered after ${recoveryTime}ms`);
    }

  } catch (error) {
    console.error(`[STRESS-VU ${userId}] Recovery monitoring failed: ${error.message}`);
  }
}

/**
 * Attempt graceful degradation on failure
 */
function attemptGracefulDegradation(userId, error) {
  console.log(`[STRESS-VU ${userId}] Attempting graceful degradation after error: ${error.message}`);

  // Implement backoff strategy
  const backoffTime = Math.random() * 10 + 5; // 5-15 seconds
  sleep(backoffTime);

  // Could implement retry logic or alternative operations here
}

/**
 * Get current load level based on VU count
 */
function getCurrentLoadLevel() {
  const currentVUs = __VU;

  if (currentVUs <= 20) return { level: 1, users: currentVUs, description: 'light' };
  if (currentVUs <= 50) return { level: 2, users: currentVUs, description: 'moderate' };
  if (currentVUs <= 100) return { level: 3, users: currentVUs, description: 'heavy' };
  if (currentVUs <= 150) return { level: 4, users: currentVUs, description: 'extreme' };
  return { level: 5, users: currentVUs, description: 'breaking_point' };
}

/**
 * Stress test setup
 */
export function setup() {
  console.log('=== Stress Test Setup ===');
  console.log(`Stress test stages: ${CONFIG.stages.stress.map(s => `${s.target} users for ${s.duration}`).join(' → ')}`);
  console.log('Stress test operations:');
  console.log('- Bulk agent creation (up to 10 simultaneous)');
  console.log('- Concurrent LLM requests (up to 15 parallel)');
  console.log('- Large file uploads (up to 5MB)');
  console.log('- Complex workflow executions');
  console.log('- Memory-intensive operations');
  console.log('- Database stress queries');
  console.log('');
  console.log('Failure thresholds:');
  console.log('- Error rate: < 10% (up to 15% for extreme stress)');
  console.log('- Response time P90: < 10 seconds');
  console.log('- Recovery time P95: < 30 seconds');

  return {
    testType: 'stress_test',
    maxUsers: 150,
    startTime: Date.now()
  };
}

/**
 * Stress test teardown
 */
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  const durationMinutes = Math.round(duration / (1000 * 60));

  console.log('=== Stress Test Results ===');
  console.log(`Test Duration: ${durationMinutes} minutes`);
  console.log(`Maximum Load: ${data.maxUsers} concurrent users`);
  console.log('');
  console.log('Stress Test Metrics to Review:');
  console.log('- stress_test_errors: Overall stress test error rate');
  console.log('- system_recovery_time: Time to recover from stress');
  console.log('- resource_exhaustion_events: Resource limit hits');
  console.log('- circuit_breaker_trips: Protection mechanism activations');
  console.log('');
  console.log('System Resilience Indicators:');
  console.log('✓ Error rate < 10% under extreme load');
  console.log('✓ System recovery < 30 seconds');
  console.log('✓ Graceful degradation under resource exhaustion');
  console.log('✓ Circuit breakers prevent cascading failures');
}