/**
 * Tests for Agent API Service - executeAgent function (Task 10.3)
 */

import { AgentAPIService } from '@/service/agent-api'
import type { AgentExecutionRequest, AgentExecutionResponse } from '@/types/agent'

// Mock fetch
global.fetch = jest.fn()

// Mock getAccessToken
jest.mock('@/utils/storage', () => ({
  getAccessToken: jest.fn(() => 'mock-token'),
}))

describe('AgentAPIService.executeAgent', () => {
  let agentAPI: AgentAPIService
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    agentAPI = new AgentAPIService()
    jest.clearAllMocks()

    // Default mocks for getAgent() and getAppApiKeys()
    jest.spyOn(agentAPI, 'getAgent').mockResolvedValue({
      id: 'agent-123',
      name: 'Test Agent',
      mode: 'chat',
      enable_api: true,
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    jest.spyOn(agentAPI, 'getAppApiKeys').mockResolvedValue([{
      id: 'key-1',
      type: 'app',
      token: 'app-mock-token-123',
      last_used_at: null,
      created_at: new Date().toISOString(),
    }])
  })

  describe('Successful Execution', () => {
    it('should call API with correct parameters', async () => {
      // Mock the raw API response (not the mapped response)
      const mockApiResponse = {
        task_id: 'task-123',
        workflow_run_id: 'run-456',
        id: 'msg-789',
        answer: 'Test answer',
        metadata: {
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
          retriever_resources: [],
        },
        created_at: Date.now(),
        agent_thoughts: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test query' },
        response_mode: 'blocking',
      }

      const result = await agentAPI.executeAgent('agent-123', request)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/chat-messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer app-mock-token-123',
          }),
          body: JSON.stringify({
            response_mode: 'blocking',
            files: [],
            user: 'web-edu-user',
            query: 'test query',
            inputs: { query: 'test query' },
          }),
        }),
      )

      // Verify the mapped response
      expect(result).toMatchObject({
        task_id: 'task-123',
        workflow_run_id: 'run-456',
        data: {
          id: 'msg-789',
          answer: 'Test answer',
          metadata: {
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150,
            },
            retriever_resources: [],
          },
        },
        agent_thoughts: [],
      })
    })

    it('should handle file uploads in request', async () => {
      const mockResponse: AgentExecutionResponse = {
        task_id: 'task-123',
        workflow_run_id: 'run-456',
        data: {
          id: 'msg-789',
          answer: 'Test answer',
          metadata: {
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150,
            },
            retriever_resources: [],
          },
          created_at: Date.now(),
        },
        agent_thoughts: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'analyze this file' },
        response_mode: 'blocking',
        files: [
          {
            type: 'document',
            transfer_method: 'remote_url',
            url: '/files/test-file-123',
          },
        ],
      }

      await agentAPI.executeAgent('agent-123', request)

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1]?.body as string)

      expect(body.files).toEqual([
        {
          type: 'document',
          transfer_method: 'remote_url',
          url: '/files/test-file-123',
        },
      ])
    })

    it('should parse agent_thoughts correctly', async () => {
      const mockResponse = {
        task_id: 'task-123',
        workflow_run_id: 'run-456',
        id: 'msg-789',
        answer: 'Test answer',
        metadata: {
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        },
        created_at: Date.now(),
        agent_thoughts: [
          {
            id: 'thought-1',
            thought: 'I need to search',
            tool: 'google_search',
            tool_input: { query: 'test' },
            tool_output: 'results',
            observation: 'Found results',
            created_at: Date.now(),
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      const result = await agentAPI.executeAgent('agent-123', request)

      expect(result.agent_thoughts).toHaveLength(1)
      expect(result.agent_thoughts[0]).toMatchObject({
        id: 'thought-1',
        thought: 'I need to search',
        tool: 'google_search',
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle 400 Bad Request error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid input' }),
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: {},
        response_mode: 'blocking',
      }

      await expect(agentAPI.executeAgent('agent-123', request))
        .rejects
        .toThrow(/입력 오류/)
    })

    it('should handle 401 Unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      await expect(agentAPI.executeAgent('agent-123', request))
        .rejects
        .toThrow(/인증 오류/)
    })

    it('should handle 403 Forbidden error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({}),
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      await expect(agentAPI.executeAgent('agent-123', request))
        .rejects
        .toThrow(/권한 오류/)
    })

    it('should handle 404 Not Found error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      await expect(agentAPI.executeAgent('agent-123', request))
        .rejects
        .toThrow(/Agent를 찾을 수 없습니다/)
    })

    it('should handle 429 Rate Limit error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({}),
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      await expect(agentAPI.executeAgent('agent-123', request))
        .rejects
        .toThrow(/요청 한도 초과/)
    })

    it('should handle 500 Server Error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      await expect(agentAPI.executeAgent('agent-123', request))
        .rejects
        .toThrow(/서버 오류/)
    })

    it('should handle 504 Gateway Timeout error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: async () => ({}),
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      await expect(agentAPI.executeAgent('agent-123', request))
        .rejects
        .toThrow(/응답 시간 초과/)
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      // Network errors are re-thrown as-is (Error instances)
      await expect(agentAPI.executeAgent('agent-123', request))
        .rejects
        .toThrow('Network error')
    })

    it('should handle JSON parse errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      await expect(agentAPI.executeAgent('agent-123', request))
        .rejects
        .toThrow(/입력 오류/)
    })
  })

  describe('Agent Thoughts Validation', () => {
    it('should warn when thought is missing id', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const mockResponse = {
        task_id: 'task-123',
        id: 'msg-789',
        answer: 'Test answer',
        metadata: {
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        },
        agent_thoughts: [
          {
            thought: 'Missing id',
            tool: 'test_tool',
            tool_input: {},
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      await agentAPI.executeAgent('agent-123', request)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Thought 0 missing ID'),
      )

      consoleWarnSpy.mockRestore()
    })

    it('should warn when tool is missing input', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const mockResponse = {
        task_id: 'task-123',
        id: 'msg-789',
        answer: 'Test answer',
        metadata: {
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        },
        agent_thoughts: [
          {
            id: 'thought-1',
            thought: 'Test',
            tool: 'test_tool',
            // missing tool_input
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      await agentAPI.executeAgent('agent-123', request)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool test_tool missing input'),
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe('Response Mapping', () => {
    it('should map API response to AgentExecutionResponse correctly', async () => {
      const mockApiResponse = {
        task_id: 'task-123',
        workflow_run_id: 'run-456',
        message_id: 'msg-789',
        answer: 'Test answer',
        metadata: {
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
          retriever_resources: [{ id: 'res-1' }],
        },
        created_at: 1234567890,
        agent_thoughts: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      const result = await agentAPI.executeAgent('agent-123', request)

      expect(result).toMatchObject({
        task_id: 'task-123',
        workflow_run_id: 'run-456',
        data: {
          id: 'msg-789',
          answer: 'Test answer',
          metadata: {
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150,
            },
          },
          created_at: 1234567890,
        },
        agent_thoughts: [],
      })
    })

    it('should handle missing optional fields with defaults', async () => {
      const mockApiResponse = {
        answer: 'Test answer',
        // Missing task_id, workflow_run_id, etc.
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      } as Response)

      const request: AgentExecutionRequest = {
        inputs: { query: 'test' },
        response_mode: 'blocking',
      }

      const result = await agentAPI.executeAgent('agent-123', request)

      expect(result.task_id).toBe('')
      expect(result.workflow_run_id).toBe('')
      expect(result.data.id).toBe('')
      expect(result.data.answer).toBe('Test answer')
      expect(result.agent_thoughts).toEqual([])
    })
  })
})
