'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Agent } from '@/types/agent'

interface AgentInfoProps {
  agent: Agent
  showHeader?: boolean
  showPrompt?: boolean // For completion mode: show system prompt
}

/**
 * AgentInfo Component
 * Displays Agent model, tools, and optionally prompt configuration
 */
export function AgentInfo({ agent, showHeader = true, showPrompt = false }: AgentInfoProps) {
  const { t } = useTranslation('chat')
  const [isPromptExpanded, setIsPromptExpanded] = useState(false)

  const { model_config } = agent

  // Backend structure: model_config.model.name, model_config.model.completion_params
  const modelConfigData = model_config as unknown as Record<string, unknown> | undefined
  const modelData = modelConfigData?.model as { name?: string; completion_params?: { temperature?: number; max_tokens?: number; top_p?: number } } | undefined

  // Extract model name only (without provider)
  const modelName = modelData?.name ?? 'N/A'

  // Extract completion params with safe defaults from model_config.model.completion_params
  const temperature = modelData?.completion_params?.temperature ?? 1.0
  const maxTokens = modelData?.completion_params?.max_tokens ?? 0
  const topP = modelData?.completion_params?.top_p ?? 1.0

  // Extract tools from model_config.agent_mode (only enabled tools)
  const agentModeData = modelConfigData?.agent_mode as { enabled?: boolean; tools?: Array<{ tool_name: string; provider_id: string; enabled?: boolean }> } | undefined
  const tools = agentModeData?.enabled && agentModeData?.tools
    ? agentModeData.tools.filter(tool => tool.enabled !== false)
    : []

  // Extract system prompt for completion mode
  const prePrompt = modelConfigData?.pre_prompt as string | undefined

  return (
    <div
      className="flex-shrink-0 bg-gray-50 overflow-y-auto"
      role="complementary"
      aria-label={t('agentInfoAccessible')}
    >
      {/* Header */}
      {showHeader && (
        <div className="p-4 border-b bg-white sticky top-0 z-10">
          <h3 className="font-bold text-gray-900">{t('agentInfo')}</h3>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Model Section */}
        <div className="bg-white rounded-lg p-3 shadow-sm border">
          <h4 className="font-semibold text-sm text-gray-700 mb-2">{t('modelConfig')}</h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('model')}:</span>
              <span className="font-medium text-gray-900">{modelName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('temperature')}:</span>
              <span className="font-medium text-gray-900">{temperature}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('maxTokens')}:</span>
              <span className="font-medium text-gray-900">{maxTokens}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('topP')}:</span>
              <span className="font-medium text-gray-900">{topP}</span>
            </div>
          </div>
        </div>

        {/* Tools Section */}
        {tools.length > 0 && (
          <div className="bg-white rounded-lg p-3 shadow-sm border">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">{t('enabledTools')}</h4>
            <div className="space-y-1">
              {tools.map((tool, index) => (
                <div key={index} className="text-sm text-gray-700 flex items-center gap-2">
                  <span className="text-blue-500">•</span>
                  <span>{tool.tool_name}</span>
                  <span className="text-xs text-gray-500">({tool.provider_id})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tools.length === 0 && (
          <div className="bg-white rounded-lg p-3 shadow-sm border">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">{t('enabledTools')}</h4>
            <p className="text-sm text-gray-500">{t('noToolsEnabled')}</p>
          </div>
        )}

        {/* Prompt Section (Completion mode only) */}
        {showPrompt && prePrompt && (
          <div className="bg-white rounded-lg p-3 shadow-sm border">
            <button
              type="button"
              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
              className="w-full flex items-center justify-between text-left"
            >
              <h4 className="font-semibold text-sm text-gray-700">{t('systemPrompt')}</h4>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${isPromptExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isPromptExpanded && (
              <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-2 rounded border border-gray-200 max-h-64 overflow-y-auto">
                {prePrompt}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
