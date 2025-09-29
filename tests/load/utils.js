import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { CONFIG } from './config.js';

// Custom Metrics
export const loginDuration = new Trend('login_duration');
export const agentCreationDuration = new Trend('agent_creation_duration');
export const workflowExecutionDuration = new Trend('workflow_execution_duration');
export const errorRate = new Rate('errors');

/**
 * Generate test user credentials based on user ID and role
 */
export function generateTestUser(userId, role = 'student') {
  const credentials = CONFIG.testUsers.credentials[role];
  return {
    username: credentials.username.replace('{id}', userId),
    password: credentials.password,
    role: role,
    userId: userId
  };
}

/**
 * Authenticate user and return session token
 */
export function authenticateUser(user) {
  const loginStart = new Date().getTime();

  const payload = {
    username: user.username,
    password: user.password
  };

  const loginResponse = http.post(
    `${CONFIG.API_BASE_URL}/edu/api/auth/login`,
    JSON.stringify(payload),
    {
      headers: {
        'Content-Type': 'application/json'
      },
      tags: { endpoint: 'auth' }
    }
  );

  const loginEnd = new Date().getTime();
  loginDuration.add(loginEnd - loginStart);

  const loginSuccess = check(loginResponse, {
    'login successful': (r) => r.status === 200,
    'login response has token': (r) => r.json('access_token') !== undefined
  });

  if (!loginSuccess) {
    errorRate.add(1);
    return null;
  }

  errorRate.add(0);
  const token = loginResponse.json('access_token');

  return {
    ...user,
    token: token,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
}

/**
 * Create educational agent with 5-step process
 */
export function createEducationAgent(authenticatedUser, agentTemplate) {
  const createStart = new Date().getTime();

  // Step 1: Agent Basic Info
  const basicInfo = {
    name: agentTemplate.name || `Agent_${Math.random().toString(36).substr(2, 9)}`,
    description: agentTemplate.description || 'Educational AI Agent for learning',
    category: 'education'
  };

  const basicInfoResponse = http.post(
    `${CONFIG.API_BASE_URL}/console/api/apps`,
    JSON.stringify(basicInfo),
    {
      headers: authenticatedUser.headers,
      tags: { endpoint: 'agent', step: 'basic_info' }
    }
  );

  const basicInfoCheck = check(basicInfoResponse, {
    'agent basic info created': (r) => r.status === 201,
    'agent has id': (r) => r.json('id') !== undefined
  });

  if (!basicInfoCheck) {
    errorRate.add(1);
    return null;
  }

  const agentId = basicInfoResponse.json('id');

  // Step 2: Model Configuration
  const modelConfig = {
    model: agentTemplate.model || 'gpt-3.5-turbo',
    temperature: agentTemplate.temperature || 0.7,
    max_tokens: agentTemplate.max_tokens || 1000
  };

  const modelResponse = http.patch(
    `${CONFIG.API_BASE_URL}/console/api/apps/${agentId}/model-config`,
    JSON.stringify(modelConfig),
    {
      headers: authenticatedUser.headers,
      tags: { endpoint: 'agent', step: 'model_config' }
    }
  );

  check(modelResponse, {
    'model configuration updated': (r) => r.status === 200
  });

  // Step 3: System Prompt
  const promptConfig = {
    prompt_template: agentTemplate.prompt || 'You are an educational AI assistant helping students learn.',
    prompt_variables: agentTemplate.variables || []
  };

  const promptResponse = http.patch(
    `${CONFIG.API_BASE_URL}/console/api/apps/${agentId}/prompt`,
    JSON.stringify(promptConfig),
    {
      headers: authenticatedUser.headers,
      tags: { endpoint: 'agent', step: 'prompt' }
    }
  );

  check(promptResponse, {
    'prompt configuration updated': (r) => r.status === 200
  });

  // Step 4: Knowledge Base (RAG)
  if (agentTemplate.knowledgeBase) {
    const ragConfig = {
      datasets: agentTemplate.knowledgeBase,
      retrieval_model: 'text-embedding-ada-002',
      top_k: 3
    };

    const ragResponse = http.patch(
      `${CONFIG.API_BASE_URL}/console/api/apps/${agentId}/datasets`,
      JSON.stringify(ragConfig),
      {
        headers: authenticatedUser.headers,
        tags: { endpoint: 'agent', step: 'rag' }
      }
    );

    check(ragResponse, {
      'RAG configuration updated': (r) => r.status === 200
    });
  }

  // Step 5: Publish Agent
  const publishResponse = http.post(
    `${CONFIG.API_BASE_URL}/console/api/apps/${agentId}/publish`,
    JSON.stringify({ status: 'published' }),
    {
      headers: authenticatedUser.headers,
      tags: { endpoint: 'agent', step: 'publish' }
    }
  );

  const publishSuccess = check(publishResponse, {
    'agent published successfully': (r) => r.status === 200
  });

  const createEnd = new Date().getTime();
  agentCreationDuration.add(createEnd - createStart);

  if (!publishSuccess) {
    errorRate.add(1);
    return null;
  }

  errorRate.add(0);
  return {
    id: agentId,
    name: basicInfo.name,
    status: 'published',
    createdBy: authenticatedUser.userId
  };
}

/**
 * Execute workflow with monitoring
 */
export function executeWorkflow(authenticatedUser, workflowId, inputs) {
  const executeStart = new Date().getTime();

  const payload = {
    inputs: inputs,
    response_mode: 'streaming'
  };

  const response = http.post(
    `${CONFIG.API_BASE_URL}/v1/workflows/run`,
    JSON.stringify(payload),
    {
      headers: {
        ...authenticatedUser.headers,
        'X-Workflow-ID': workflowId
      },
      tags: { endpoint: 'workflow' }
    }
  );

  const executeEnd = new Date().getTime();
  workflowExecutionDuration.add(executeEnd - executeStart);

  const success = check(response, {
    'workflow execution started': (r) => r.status === 200,
    'workflow has task_id': (r) => r.json('task_id') !== undefined
  });

  if (!success) {
    errorRate.add(1);
    return null;
  }

  errorRate.add(0);
  return response.json('task_id');
}

/**
 * Simulate LLM chat interaction
 */
export function chatWithAgent(authenticatedUser, agentId, message) {
  const payload = {
    inputs: { message: message },
    query: message,
    response_mode: 'streaming',
    user: authenticatedUser.userId
  };

  const response = http.post(
    `${CONFIG.API_BASE_URL}/v1/chat/completions`,
    JSON.stringify(payload),
    {
      headers: {
        ...authenticatedUser.headers,
        'X-App-ID': agentId
      },
      tags: { endpoint: 'llm' },
      timeout: '35s' // LLM requests need longer timeout
    }
  );

  const success = check(response, {
    'chat response received': (r) => r.status === 200,
    'chat has content': (r) => r.json('answer') !== undefined
  });

  if (!success) {
    errorRate.add(1);
    return null;
  }

  errorRate.add(0);
  return response.json('answer');
}

/**
 * Upload file for RAG processing
 */
export function uploadEducationFile(authenticatedUser, fileContent, fileName) {
  const formData = {
    file: http.file(fileContent, fileName, 'text/plain'),
    type: 'education_material'
  };

  const response = http.post(
    `${CONFIG.API_BASE_URL}/files/upload`,
    formData,
    {
      headers: {
        'Authorization': authenticatedUser.headers.Authorization
      },
      tags: { endpoint: 'file' }
    }
  );

  const success = check(response, {
    'file uploaded successfully': (r) => r.status === 200,
    'file has id': (r) => r.json('id') !== undefined
  });

  if (!success) {
    errorRate.add(1);
    return null;
  }

  errorRate.add(0);
  return response.json('id');
}

/**
 * Apply retry logic with exponential backoff
 */
export function retryRequest(requestFn, maxRetries = CONFIG.retry.maxRetries) {
  let attempt = 0;
  let delay = CONFIG.retry.retryDelay;

  while (attempt < maxRetries) {
    try {
      const result = requestFn();
      if (result && result.status < 500) {
        return result;
      }
    } catch (error) {
      console.log(`Request attempt ${attempt + 1} failed: ${error.message}`);
    }

    attempt++;
    if (attempt < maxRetries) {
      sleep(delay / 1000); // k6 sleep expects seconds
      delay *= CONFIG.retry.backoffMultiplier;
    }
  }

  errorRate.add(1);
  return null;
}

/**
 * Random sleep with jitter to avoid thundering herd
 */
export function randomSleep(minMs = 500, maxMs = 2000) {
  const sleepTime = Math.random() * (maxMs - minMs) + minMs;
  sleep(sleepTime / 1000); // k6 sleep expects seconds
}

/**
 * Get sample education content for testing
 */
export function getEducationTemplates() {
  return [
    {
      name: 'Python Programming Tutor',
      description: 'AI assistant specialized in Python programming education',
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      prompt: 'You are a patient Python programming tutor. Help students understand coding concepts step by step.',
      knowledgeBase: ['python_basics', 'programming_concepts']
    },
    {
      name: 'Mathematics Learning Assistant',
      description: 'AI tutor for mathematics problem solving',
      model: 'gpt-4',
      temperature: 0.2,
      prompt: 'You are a mathematics tutor. Explain solutions clearly with step-by-step reasoning.',
      knowledgeBase: ['math_formulas', 'problem_solving']
    },
    {
      name: 'Language Learning Companion',
      description: 'Interactive language learning AI assistant',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      prompt: 'You are a friendly language learning companion. Practice conversations and provide feedback.',
      knowledgeBase: ['language_rules', 'conversation_examples']
    }
  ];
}