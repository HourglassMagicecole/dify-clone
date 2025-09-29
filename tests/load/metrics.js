// Custom Metrics Collection for Education Platform Load Testing
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

/**
 * Education Platform Specific Metrics
 */

// Authentication & User Management
export const loginSuccessRate = new Rate('edu_login_success_rate');
export const loginDuration = new Trend('edu_login_duration');
export const userSessionDuration = new Trend('edu_user_session_duration');
export const concurrentUsers = new Gauge('edu_concurrent_users');

// Agent Management Metrics
export const agentCreationSuccess = new Rate('edu_agent_creation_success');
export const agentCreationDuration = new Trend('edu_agent_creation_duration');
export const agentExecutionSuccess = new Rate('edu_agent_execution_success');
export const agentResponseTime = new Trend('edu_agent_response_time');
export const agentTemplateUsage = new Counter('edu_agent_template_usage');

// LLM & Chat Metrics
export const llmRequestDuration = new Trend('edu_llm_request_duration');
export const llmResponseLength = new Trend('edu_llm_response_length');
export const llmTokensUsed = new Counter('edu_llm_tokens_used');
export const llmSuccessRate = new Rate('edu_llm_success_rate');
export const chatSessionsActive = new Gauge('edu_chat_sessions_active');

// Workflow Metrics
export const workflowCreationSuccess = new Rate('edu_workflow_creation_success');
export const workflowExecutionDuration = new Trend('edu_workflow_execution_duration');
export const workflowStepsCompleted = new Counter('edu_workflow_steps_completed');
export const workflowErrorRate = new Rate('edu_workflow_error_rate');

// RAG & Knowledge Base Metrics
export const ragQueryDuration = new Trend('edu_rag_query_duration');
export const ragRelevanceScore = new Trend('edu_rag_relevance_score');
export const knowledgeBaseHitRate = new Rate('edu_knowledge_base_hit_rate');
export const vectorSearchDuration = new Trend('edu_vector_search_duration');

// File Upload & Management
export const fileUploadSuccess = new Rate('edu_file_upload_success');
export const fileUploadDuration = new Trend('edu_file_upload_duration');
export const fileProcessingDuration = new Trend('edu_file_processing_duration');
export const storageUtilization = new Gauge('edu_storage_utilization');

// Education Session Metrics
export const sessionCompletionRate = new Rate('edu_session_completion_rate');
export const learningObjectivesMet = new Counter('edu_learning_objectives_met');
export const studentEngagementScore = new Trend('edu_student_engagement_score');
export const sessionDuration = new Trend('edu_session_duration');

// System Performance Metrics
export const apiThroughput = new Rate('edu_api_throughput');
export const databaseQueryDuration = new Trend('edu_database_query_duration');
export const cacheHitRate = new Rate('edu_cache_hit_rate');
export const memoryUsage = new Gauge('edu_memory_usage');
export const cpuUtilization = new Gauge('edu_cpu_utilization');

// Error & Reliability Metrics
export const systemErrors = new Counter('edu_system_errors');
export const circuitBreakerTrips = new Counter('edu_circuit_breaker_trips');
export const retryAttempts = new Counter('edu_retry_attempts');
export const timeoutErrors = new Counter('edu_timeout_errors');

// WebSocket Real-time Metrics
export const wsConnectionSuccess = new Rate('edu_ws_connection_success');
export const wsMessageLatency = new Trend('edu_ws_message_latency');
export const wsActiveConnections = new Gauge('edu_ws_active_connections');
export const wsMessageThroughput = new Rate('edu_ws_message_throughput');

// Auto-scaling & Resource Metrics
export const scaleUpEvents = new Counter('edu_scale_up_events');
export const scaleDownEvents = new Counter('edu_scale_down_events');
export const resourceUtilization = new Trend('edu_resource_utilization');
export const loadBalancerDistribution = new Gauge('edu_load_balancer_distribution');

/**
 * Metric Collection Helper Functions
 */

/**
 * Record authentication metrics
 */
export function recordAuthenticationMetrics(success, duration, userId) {
  loginSuccessRate.add(success ? 1 : 0);
  if (duration) loginDuration.add(duration);

  // Track concurrent users (approximate based on VU)
  if (success && userId) {
    concurrentUsers.add(1);
  }
}

/**
 * Record agent operation metrics
 */
export function recordAgentMetrics(operation, success, duration, additionalData = {}) {
  switch (operation) {
    case 'creation':
      agentCreationSuccess.add(success ? 1 : 0);
      if (duration) agentCreationDuration.add(duration);
      if (additionalData.template) {
        agentTemplateUsage.add(1, { template: additionalData.template });
      }
      break;

    case 'execution':
      agentExecutionSuccess.add(success ? 1 : 0);
      if (duration) agentResponseTime.add(duration);
      break;
  }
}

/**
 * Record LLM interaction metrics
 */
export function recordLLMMetrics(success, duration, responseLength, tokensUsed) {
  llmSuccessRate.add(success ? 1 : 0);
  if (duration) llmRequestDuration.add(duration);
  if (responseLength) llmResponseLength.add(responseLength);
  if (tokensUsed) llmTokensUsed.add(tokensUsed);
}

/**
 * Record workflow execution metrics
 */
export function recordWorkflowMetrics(success, duration, stepsCompleted, errorOccurred) {
  workflowCreationSuccess.add(success ? 1 : 0);
  if (duration) workflowExecutionDuration.add(duration);
  if (stepsCompleted) workflowStepsCompleted.add(stepsCompleted);
  workflowErrorRate.add(errorOccurred ? 1 : 0);
}

/**
 * Record RAG query metrics
 */
export function recordRAGMetrics(queryDuration, relevanceScore, cacheHit, vectorSearchDuration) {
  if (queryDuration) ragQueryDuration.add(queryDuration);
  if (relevanceScore) ragRelevanceScore.add(relevanceScore);
  if (typeof cacheHit === 'boolean') knowledgeBaseHitRate.add(cacheHit ? 1 : 0);
  if (vectorSearchDuration) vectorSearchDuration.add(vectorSearchDuration);
}

/**
 * Record file operation metrics
 */
export function recordFileMetrics(operation, success, duration, fileSize) {
  switch (operation) {
    case 'upload':
      fileUploadSuccess.add(success ? 1 : 0);
      if (duration) fileUploadDuration.add(duration);
      break;

    case 'processing':
      if (duration) fileProcessingDuration.add(duration);
      break;
  }

  // Update storage utilization (simulated)
  if (success && fileSize) {
    const currentStorage = storageUtilization.value || 0;
    storageUtilization.add(currentStorage + fileSize);
  }
}

/**
 * Record education session metrics
 */
export function recordEducationSessionMetrics(completed, objectivesMet, engagementScore, duration) {
  sessionCompletionRate.add(completed ? 1 : 0);
  if (objectivesMet) learningObjectivesMet.add(objectivesMet);
  if (engagementScore) studentEngagementScore.add(engagementScore);
  if (duration) sessionDuration.add(duration);
}

/**
 * Record system performance metrics
 */
export function recordSystemMetrics(throughput, dbQueryTime, cacheHit, memUsage, cpuUsage) {
  if (throughput) apiThroughput.add(throughput);
  if (dbQueryTime) databaseQueryDuration.add(dbQueryTime);
  if (typeof cacheHit === 'boolean') cacheHitRate.add(cacheHit ? 1 : 0);
  if (memUsage) memoryUsage.add(memUsage);
  if (cpuUsage) cpuUtilization.add(cpuUsage);
}

/**
 * Record error and reliability metrics
 */
export function recordErrorMetrics(errorType, count = 1) {
  systemErrors.add(count);

  switch (errorType) {
    case 'circuit_breaker':
      circuitBreakerTrips.add(count);
      break;
    case 'timeout':
      timeoutErrors.add(count);
      break;
    case 'retry':
      retryAttempts.add(count);
      break;
  }
}

/**
 * Record WebSocket metrics
 */
export function recordWebSocketMetrics(connectionSuccess, messageLatency, activeConnections, messageThroughput) {
  if (typeof connectionSuccess === 'boolean') {
    wsConnectionSuccess.add(connectionSuccess ? 1 : 0);
  }
  if (messageLatency) wsMessageLatency.add(messageLatency);
  if (activeConnections) wsActiveConnections.add(activeConnections);
  if (messageThroughput) wsMessageThroughput.add(messageThroughput);
}

/**
 * Record auto-scaling events
 */
export function recordAutoScalingEvent(eventType, resourceUtilizationValue) {
  switch (eventType) {
    case 'scale_up':
      scaleUpEvents.add(1);
      break;
    case 'scale_down':
      scaleDownEvents.add(1);
      break;
  }

  if (resourceUtilizationValue) {
    resourceUtilization.add(resourceUtilizationValue);
  }
}

/**
 * Generate metrics summary for reporting
 */
export function generateMetricsSummary() {
  return {
    authentication: {
      loginSuccessRate: loginSuccessRate.value,
      avgLoginDuration: loginDuration.avg,
      concurrentUsers: concurrentUsers.value
    },
    agents: {
      creationSuccessRate: agentCreationSuccess.value,
      avgCreationDuration: agentCreationDuration.avg,
      executionSuccessRate: agentExecutionSuccess.value,
      avgResponseTime: agentResponseTime.avg
    },
    llm: {
      successRate: llmSuccessRate.value,
      avgRequestDuration: llmRequestDuration.avg,
      avgResponseLength: llmResponseLength.avg,
      totalTokensUsed: llmTokensUsed.count
    },
    workflows: {
      creationSuccessRate: workflowCreationSuccess.value,
      avgExecutionDuration: workflowExecutionDuration.avg,
      totalStepsCompleted: workflowStepsCompleted.count,
      errorRate: workflowErrorRate.value
    },
    system: {
      apiThroughput: apiThroughput.value,
      avgDatabaseQueryTime: databaseQueryDuration.avg,
      cacheHitRate: cacheHitRate.value,
      memoryUsage: memoryUsage.value,
      cpuUtilization: cpuUtilization.value
    },
    errors: {
      totalSystemErrors: systemErrors.count,
      circuitBreakerTrips: circuitBreakerTrips.count,
      timeoutErrors: timeoutErrors.count,
      retryAttempts: retryAttempts.count
    },
    websocket: {
      connectionSuccessRate: wsConnectionSuccess.value,
      avgMessageLatency: wsMessageLatency.avg,
      activeConnections: wsActiveConnections.value,
      messageThroughput: wsMessageThroughput.value
    },
    autoscaling: {
      scaleUpEvents: scaleUpEvents.count,
      scaleDownEvents: scaleDownEvents.count,
      avgResourceUtilization: resourceUtilization.avg
    }
  };
}

/**
 * Export all metrics for external reporting
 */
export const ALL_METRICS = {
  // Authentication
  loginSuccessRate,
  loginDuration,
  userSessionDuration,
  concurrentUsers,

  // Agent Management
  agentCreationSuccess,
  agentCreationDuration,
  agentExecutionSuccess,
  agentResponseTime,
  agentTemplateUsage,

  // LLM & Chat
  llmRequestDuration,
  llmResponseLength,
  llmTokensUsed,
  llmSuccessRate,
  chatSessionsActive,

  // Workflow
  workflowCreationSuccess,
  workflowExecutionDuration,
  workflowStepsCompleted,
  workflowErrorRate,

  // RAG & Knowledge
  ragQueryDuration,
  ragRelevanceScore,
  knowledgeBaseHitRate,
  vectorSearchDuration,

  // File Operations
  fileUploadSuccess,
  fileUploadDuration,
  fileProcessingDuration,
  storageUtilization,

  // Education Sessions
  sessionCompletionRate,
  learningObjectivesMet,
  studentEngagementScore,
  sessionDuration,

  // System Performance
  apiThroughput,
  databaseQueryDuration,
  cacheHitRate,
  memoryUsage,
  cpuUtilization,

  // Errors & Reliability
  systemErrors,
  circuitBreakerTrips,
  retryAttempts,
  timeoutErrors,

  // WebSocket
  wsConnectionSuccess,
  wsMessageLatency,
  wsActiveConnections,
  wsMessageThroughput,

  // Auto-scaling
  scaleUpEvents,
  scaleDownEvents,
  resourceUtilization,
  loadBalancerDistribution
};