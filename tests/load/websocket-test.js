import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { CONFIG } from './config.js';
import { generateTestUser, authenticateUser, randomSleep } from './utils.js';

// WebSocket-specific metrics
export const wsConnectionDuration = new Trend('ws_connection_duration');
export const wsMessagesSent = new Counter('ws_messages_sent');
export const wsMessagesReceived = new Counter('ws_messages_received');
export const wsConnectionErrors = new Rate('ws_connection_errors');
export const wsRealtimeLatency = new Trend('ws_realtime_latency');

// WebSocket load test configuration
export let options = {
  scenarios: {
    websocket_connections: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 10 },   // Ramp up to 10 WebSocket connections
        { duration: '3m', target: 25 },   // Increase to 25 connections
        { duration: '5m', target: 50 },   // Peak at 50 concurrent WebSocket connections
        { duration: '3m', target: 25 },   // Scale down
        { duration: '2m', target: 0 }     // Ramp down
      ],
      gracefulRampDown: '1m'
    }
  },

  thresholds: {
    'ws_connection_duration': ['p(95)<100'], // Connection establishment < 100ms
    'ws_connection_errors': ['rate<0.05'],   // < 5% connection errors
    'ws_realtime_latency': ['p(90)<500'],    // Real-time message latency < 500ms
    'ws_messages_received': ['rate>0.9'],    // > 90% message delivery success
    'http_req_duration{endpoint:websocket}': ['p(95)<2000']
  },

  tags: {
    test_type: 'websocket_realtime',
    protocol: 'websocket'
  }
};

/**
 * WebSocket real-time monitoring test
 * AC 5: 실시간 WebSocket 모니터링 테스트
 */
export default function websocketRealtimeTest() {
  const userId = __VU;
  const sessionId = `ws_session_${userId}_${Date.now()}`;

  try {
    // Phase 1: Authenticate for WebSocket connection
    const testUser = generateTestUser(userId, 'student');
    const authenticatedUser = authenticateUser(testUser);

    if (!authenticatedUser) {
      console.error(`[WS-VU ${userId}] Authentication failed for WebSocket test`);
      wsConnectionErrors.add(1);
      return;
    }

    console.log(`[WS-VU ${userId}] Starting WebSocket connection test`);

    // Phase 2: Establish WebSocket connection with authentication
    const wsUrl = `${CONFIG.WS_BASE_URL}/ws/education/realtime?token=${authenticatedUser.token}&session=${sessionId}`;
    const connectionStart = Date.now();

    const response = ws.connect(wsUrl, {
      headers: {
        'Authorization': `Bearer ${authenticatedUser.token}`,
        'X-Session-ID': sessionId,
        'X-User-ID': authenticatedUser.userId
      },
      tags: { endpoint: 'websocket' }
    }, function(socket) {
      const connectionEnd = Date.now();
      wsConnectionDuration.add(connectionEnd - connectionStart);

      console.log(`[WS-VU ${userId}] WebSocket connected in ${connectionEnd - connectionStart}ms`);

      // Phase 3: Real-time event handling
      socket.on('open', function() {
        console.log(`[WS-VU ${userId}] WebSocket connection opened`);

        // Send initial presence notification
        const presenceMessage = {
          type: 'presence',
          event: 'user_joined',
          data: {
            userId: authenticatedUser.userId,
            sessionId: sessionId,
            timestamp: Date.now()
          }
        };

        socket.send(JSON.stringify(presenceMessage));
        wsMessagesSent.add(1);
      });

      socket.on('message', function(message) {
        const receiveTime = Date.now();
        wsMessagesReceived.add(1);

        try {
          const parsedMessage = JSON.parse(message);
          console.log(`[WS-VU ${userId}] Received: ${parsedMessage.type}`);

          // Calculate real-time latency if message has timestamp
          if (parsedMessage.timestamp) {
            const latency = receiveTime - parsedMessage.timestamp;
            wsRealtimeLatency.add(latency);
          }

          // Handle different message types
          handleRealtimeMessage(socket, parsedMessage, userId, sessionId);

        } catch (error) {
          console.error(`[WS-VU ${userId}] Failed to parse message: ${error.message}`);
        }
      });

      socket.on('error', function(error) {
        console.error(`[WS-VU ${userId}] WebSocket error: ${error.error()}`);
        wsConnectionErrors.add(1);
      });

      socket.on('close', function() {
        console.log(`[WS-VU ${userId}] WebSocket connection closed`);
      });

      // Phase 4: Simulate real-time education activities
      simulateEducationRealtimeActivities(socket, userId, sessionId);

    });

    // Check connection success
    const connectionSuccess = check(response, {
      'websocket connection established': (r) => r && r.url === wsUrl
    });

    if (!connectionSuccess) {
      wsConnectionErrors.add(1);
    }

  } catch (error) {
    console.error(`[WS-VU ${userId}] WebSocket test failed: ${error.message}`);
    wsConnectionErrors.add(1);
  }
}

/**
 * Handle different types of real-time messages
 */
function handleRealtimeMessage(socket, message, userId, sessionId) {
  switch (message.type) {
    case 'agent_status':
      console.log(`[WS-VU ${userId}] Agent status update: ${message.data.status}`);
      break;

    case 'workflow_progress':
      console.log(`[WS-VU ${userId}] Workflow progress: ${message.data.progress}%`);

      // Acknowledge workflow progress
      const ackMessage = {
        type: 'acknowledgment',
        event: 'workflow_progress_received',
        data: {
          workflowId: message.data.workflowId,
          timestamp: Date.now()
        }
      };
      socket.send(JSON.stringify(ackMessage));
      wsMessagesSent.add(1);
      break;

    case 'llm_streaming':
      console.log(`[WS-VU ${userId}] LLM streaming chunk received`);
      break;

    case 'user_activity':
      console.log(`[WS-VU ${userId}] User activity: ${message.data.activity}`);
      break;

    case 'system_notification':
      console.log(`[WS-VU ${userId}] System notification: ${message.data.message}`);

      // Send notification receipt
      const receiptMessage = {
        type: 'receipt',
        event: 'notification_received',
        data: {
          notificationId: message.data.id,
          timestamp: Date.now()
        }
      };
      socket.send(JSON.stringify(receiptMessage));
      wsMessagesSent.add(1);
      break;

    case 'ping':
      // Respond to ping with pong
      const pongMessage = {
        type: 'pong',
        data: { timestamp: Date.now() }
      };
      socket.send(JSON.stringify(pongMessage));
      wsMessagesSent.add(1);
      break;

    default:
      console.log(`[WS-VU ${userId}] Unknown message type: ${message.type}`);
  }
}

/**
 * Simulate various real-time education activities
 */
function simulateEducationRealtimeActivities(socket, userId, sessionId) {
  const activities = [
    // Agent creation monitoring
    () => {
      const message = {
        type: 'monitor_request',
        event: 'agent_creation',
        data: {
          agentId: `agent_${userId}_${Date.now()}`,
          step: Math.floor(Math.random() * 5) + 1,
          timestamp: Date.now()
        }
      };
      socket.send(JSON.stringify(message));
      wsMessagesSent.add(1);
    },

    // Workflow execution tracking
    () => {
      const message = {
        type: 'monitor_request',
        event: 'workflow_execution',
        data: {
          workflowId: `workflow_${userId}_${Date.now()}`,
          status: 'running',
          timestamp: Date.now()
        }
      };
      socket.send(JSON.stringify(message));
      wsMessagesSent.add(1);
    },

    // Real-time chat monitoring
    () => {
      const message = {
        type: 'chat_activity',
        event: 'message_sent',
        data: {
          chatId: `chat_${sessionId}`,
          messageLength: Math.floor(Math.random() * 200) + 50,
          timestamp: Date.now()
        }
      };
      socket.send(JSON.stringify(message));
      wsMessagesSent.add(1);
    },

    // Progress tracking
    () => {
      const message = {
        type: 'progress_update',
        event: 'learning_progress',
        data: {
          sessionId: sessionId,
          completedTasks: Math.floor(Math.random() * 10) + 1,
          totalTasks: 10,
          timestamp: Date.now()
        }
      };
      socket.send(JSON.stringify(message));
      wsMessagesSent.add(1);
    },

    // System health check
    () => {
      const message = {
        type: 'health_check',
        event: 'client_status',
        data: {
          clientId: userId,
          connectionQuality: 'good',
          timestamp: Date.now()
        }
      };
      socket.send(JSON.stringify(message));
      wsMessagesSent.add(1);
    }
  ];

  // Send activities at intervals during the connection
  const activityIntervals = [1, 3, 5, 8, 12, 15]; // seconds

  activityIntervals.forEach((interval, index) => {
    if (index < activities.length) {
      setTimeout(() => {
        try {
          activities[index]();
          console.log(`[WS-VU ${userId}] Sent activity ${index + 1} at ${interval}s`);
        } catch (error) {
          console.error(`[WS-VU ${userId}] Activity ${index + 1} failed: ${error.message}`);
        }
      }, interval * 1000);
    }
  });

  // Keep connection alive for test duration
  sleep(20); // 20-second WebSocket session
}

/**
 * WebSocket setup
 */
export function setup() {
  console.log('=== WebSocket Real-time Monitoring Test Setup ===');
  console.log(`WebSocket URL: ${CONFIG.WS_BASE_URL}`);
  console.log(`Max Concurrent WebSocket Connections: 50`);
  console.log(`Connection Duration: 20 seconds per VU`);
  console.log('');
  console.log('Real-time Events Tested:');
  console.log('- Agent creation monitoring');
  console.log('- Workflow execution tracking');
  console.log('- LLM streaming responses');
  console.log('- User activity notifications');
  console.log('- System health monitoring');
  console.log('- Ping/Pong keepalive');

  return {
    startTime: Date.now(),
    wsBaseUrl: CONFIG.WS_BASE_URL,
    maxConnections: 50
  };
}

/**
 * WebSocket teardown
 */
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  const durationMinutes = Math.round(duration / (1000 * 60));

  console.log('=== WebSocket Real-time Test Results ===');
  console.log(`Test Duration: ${durationMinutes} minutes`);
  console.log(`Max Concurrent Connections: ${data.maxConnections}`);
  console.log('');
  console.log('Key WebSocket Metrics:');
  console.log('- ws_connection_duration: Time to establish connections');
  console.log('- ws_messages_sent/received: Message throughput');
  console.log('- ws_realtime_latency: Real-time message delay');
  console.log('- ws_connection_errors: Connection failure rate');
  console.log('');
  console.log('Expected Performance:');
  console.log('✓ Connection establishment < 100ms (P95)');
  console.log('✓ Message delivery success > 90%');
  console.log('✓ Real-time latency < 500ms (P90)');
  console.log('✓ Connection error rate < 5%');
}