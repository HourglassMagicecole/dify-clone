'use client'

import { useTranslation } from 'react-i18next'
import type { Agent } from '@/types/agent'

interface AgentInfoProps {
  agent: Agent
  showHeader?: boolean
}

/**
 * AgentInfo Component
 * Displays Agent model and tools configuration
 */
export function AgentInfo({ agent, showHeader = true }: AgentInfoProps) {
  const { t } = useTranslation('chat')

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
      </div>
    </div>
  )
}
