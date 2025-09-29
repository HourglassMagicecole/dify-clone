import { sleep } from 'k6';
import { CONFIG } from './config.js';
import {
  generateTestUser,
  authenticateUser,
  createEducationAgent,
  chatWithAgent,
  executeWorkflow,
  uploadEducationFile,
  getEducationTemplates,
  randomSleep
} from './utils.js';

// Test options with gradual load increase
export let options = {
  stages: CONFIG.stages.concurrent,
  thresholds: CONFIG.thresholds,

  // Tags for filtering results
  tags: {
    test_type: 'education_session',
    environment: __ENV.ENVIRONMENT || 'development'
  }
};

/**
 * Main test scenario: Complete education session workflow
 * AC 5: 교육 참가자 시나리오 - 로그인 → 세션 참가 → Agent 생성 5단계 → LLM 호출 → Workflow 생성
 */
export default function educationSessionScenario() {
  const userId = __VU; // Virtual User ID
  const iterationId = __ITER; // Iteration number

  try {
    // Phase 1: User Authentication
    console.log(`[VU ${userId}] Starting education session - iteration ${iterationId}`);

    const testUser = generateTestUser(userId, 'student');
    const authenticatedUser = authenticateUser(testUser);

    if (!authenticatedUser) {
      console.error(`[VU ${userId}] Authentication failed`);
      return;
    }

    console.log(`[VU ${userId}] Successfully authenticated as ${authenticatedUser.username}`);
    randomSleep(500, 1500);

    // Phase 2: Join Education Session
    const sessionData = {
      session_id: `session_${Math.floor(Math.random() * 10) + 1}`,
      group_id: `group_${Math.floor(Math.random() * 5) + 1}`,
      role: 'participant'
    };

    console.log(`[VU ${userId}] Joining session: ${sessionData.session_id}`);
    randomSleep(1000, 2000);

    // Phase 3: Agent Creation (5-step process)
    const educationTemplates = getEducationTemplates();
    const selectedTemplate = educationTemplates[userId % educationTemplates.length];

    console.log(`[VU ${userId}] Creating agent: ${selectedTemplate.name}`);
    const createdAgent = createEducationAgent(authenticatedUser, selectedTemplate);

    if (!createdAgent) {
      console.error(`[VU ${userId}] Agent creation failed`);
      return;
    }

    console.log(`[VU ${userId}] Successfully created agent: ${createdAgent.name} (ID: ${createdAgent.id})`);
    randomSleep(2000, 3000);

    // Phase 4: LLM Interaction
    const learningQuestions = [
      'Explain the basic concepts of machine learning',
      'What are the differences between supervised and unsupervised learning?',
      'How does a neural network work?',
      'What is the purpose of activation functions?',
      'Can you help me understand gradient descent?'
    ];

    const questionIndex = (userId + iterationId) % learningQuestions.length;
    const question = learningQuestions[questionIndex];

    console.log(`[VU ${userId}] Asking LLM: "${question}"`);
    const llmResponse = chatWithAgent(authenticatedUser, createdAgent.id, question);

    if (!llmResponse) {
      console.error(`[VU ${userId}] LLM interaction failed`);
      return;
    }

    console.log(`[VU ${userId}] Received LLM response (${llmResponse.length} characters)`);
    randomSleep(3000, 5000);

    // Phase 5: Workflow Creation and Execution
    const workflowTemplate = {
      name: `Learning_Workflow_${userId}_${iterationId}`,
      description: 'Educational workflow for student learning path',
      nodes: [
        {
          type: 'start',
          id: 'start_node',
          data: { message: 'Welcome to the learning session' }
        },
        {
          type: 'llm',
          id: 'question_analysis',
          data: {
            model: 'gpt-3.5-turbo',
            prompt: 'Analyze the student question and provide learning objectives'
          }
        },
        {
          type: 'knowledge_retrieval',
          id: 'knowledge_search',
          data: { dataset_ids: ['education_kb_1'] }
        },
        {
          type: 'answer',
          id: 'final_answer',
          data: { format: 'structured_learning_response' }
        }
      ]
    };

    console.log(`[VU ${userId}] Creating workflow: ${workflowTemplate.name}`);

    // Simulate workflow creation API call
    const workflowId = `workflow_${userId}_${iterationId}_${Date.now()}`;
    randomSleep(1000, 2000);

    // Execute the workflow
    const workflowInputs = {
      student_question: question,
      learning_level: 'beginner',
      subject_area: 'computer_science'
    };

    console.log(`[VU ${userId}] Executing workflow with inputs`);
    const taskId = executeWorkflow(authenticatedUser, workflowId, workflowInputs);

    if (!taskId) {
      console.error(`[VU ${userId}] Workflow execution failed`);
      return;
    }

    console.log(`[VU ${userId}] Workflow execution started (Task ID: ${taskId})`);
    randomSleep(2000, 4000);

    // Phase 6: File Upload for Knowledge Base
    const educationContent = generateEducationContent(selectedTemplate.name);
    const fileName = `education_material_${userId}_${iterationId}.txt`;

    console.log(`[VU ${userId}] Uploading education material: ${fileName}`);
    const fileId = uploadEducationFile(authenticatedUser, educationContent, fileName);

    if (fileId) {
      console.log(`[VU ${userId}] Successfully uploaded file (ID: ${fileId})`);
    } else {
      console.log(`[VU ${userId}] File upload failed, continuing...`);
    }

    randomSleep(1000, 2000);

    // Phase 7: Progress Tracking
    console.log(`[VU ${userId}] Recording learning progress`);
    const progressData = {
      session_id: sessionData.session_id,
      agent_id: createdAgent.id,
      workflow_id: workflowId,
      completion_status: 'completed',
      learning_objectives_met: Math.floor(Math.random() * 5) + 1,
      time_spent_minutes: Math.floor(Math.random() * 45) + 15
    };

    randomSleep(500, 1000);

    console.log(`[VU ${userId}] Education session completed successfully`);
    console.log(`[VU ${userId}] Session stats: ${JSON.stringify(progressData)}`);

  } catch (error) {
    console.error(`[VU ${userId}] Education session failed: ${error.message}`);
  }

  // Cool-down period before next iteration
  sleep(Math.random() * 10 + 5); // 5-15 seconds
}

/**
 * Generate sample education content for file upload
 */
function generateEducationContent(agentName) {
  const contents = {
    'Python Programming Tutor': `
# Python Programming Basics

## Variables and Data Types
- int: Integer numbers (1, 2, 3)
- str: Text strings ("Hello World")
- float: Decimal numbers (3.14, 2.5)
- bool: True or False values

## Control Structures
- if/elif/else statements for decision making
- for loops for iteration
- while loops for conditional repetition

## Functions
def greet(name):
    return f"Hello, {name}!"

## Common Operations
- String manipulation: .upper(), .lower(), .strip()
- List operations: .append(), .remove(), .sort()
- Dictionary access: dict["key"] = value
    `,

    'Mathematics Learning Assistant': `
# Mathematics Fundamentals

## Algebra
- Linear equations: ax + b = 0
- Quadratic formula: x = (-b ± √(b²-4ac)) / 2a
- Factoring: x² + 2x + 1 = (x + 1)²

## Calculus
- Derivatives: f'(x) = lim(h→0) [f(x+h) - f(x)] / h
- Integration: ∫ f(x)dx
- Chain rule: (f(g(x)))' = f'(g(x)) · g'(x)

## Statistics
- Mean: μ = Σx / n
- Standard deviation: σ = √(Σ(x-μ)² / n)
- Normal distribution properties
    `,

    'Language Learning Companion': `
# Language Learning Guide

## Grammar Basics
- Subject-Verb-Object structure
- Verb tenses: past, present, future
- Articles: a, an, the
- Prepositions: in, on, at, by

## Vocabulary Building
- Common phrases for daily conversations
- Academic vocabulary for formal writing
- Idiomatic expressions and their meanings

## Practice Exercises
1. Fill in the blanks with correct verb forms
2. Translate sentences between languages
3. Write short paragraphs using new vocabulary
4. Practice pronunciation with audio examples
    `
  };

  return contents[agentName] || 'Generic education content for learning and practice.';
}

/**
 * Setup function (runs once per VU)
 */
export function setup() {
  console.log('Setting up education session load test...');
  console.log(`Target URL: ${CONFIG.API_BASE_URL}`);
  console.log(`Concurrent users: ${CONFIG.stages.concurrent.map(s => s.target).join(' → ')}`);

  return {
    startTime: Date.now(),
    testConfig: CONFIG
  };
}

/**
 * Teardown function (runs once after all VUs complete)
 */
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`Education session load test completed in ${duration}ms`);
  console.log('Check the HTML report for detailed metrics and performance analysis.');
}