'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ToolCard from './ToolCard'
import ToolConfigModal from './ToolConfigModal'
import { getToolDetail, listTools } from '@/service/tool-api'
import type { Tool, ToolProvider } from '@/types/tool'

interface ToolListProps {
  selectedTools: string[]
  onToolsChange: (tools: string[]) => void
}

export default function ToolList({ selectedTools, onToolsChange }: ToolListProps) {
  const { t } = useTranslation('agent')
  const [toolProviders, setToolProviders] = useState<ToolProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configTool, setConfigTool] = useState<Tool | null>(null)

  useEffect(() => {
    loadTools()
  }, [])

  const loadTools = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await listTools()

      if (response.result === 'success' && response.data) {
        setToolProviders(response.data)
      }
      else {
        setError(response.message || 'Failed to load tools')
      }
    }
    catch (err) {
      console.error('Failed to load tools:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
    finally {
      setLoading(false)
    }
  }

  const handleToggleTool = (toolName: string) => {
    if (selectedTools.includes(toolName)) {
      onToolsChange(selectedTools.filter(name => name !== toolName))
    }
    else {
      onToolsChange([...selectedTools, toolName])
    }
  }

  const handleConfigure = async (tool: Tool) => {
    try {
      // Fetch detailed tool information including parameters
      // Use tool's provider if available, otherwise default to 'edu_tools'
      const provider = tool.provider || 'edu_tools'
      const response = await getToolDetail(provider, tool.name)

      if (response.result === 'success' && response.data) {
        // Add provider info and preserve availability metadata (api_key_type, etc.)
        setConfigTool({
          ...response.data,
          provider,
          api_key_type: tool.api_key_type,
          requires_user_key: tool.requires_user_key,
          user_has_key: tool.user_has_key,
        })
      }
      else {
        console.error('Failed to load tool detail:', response.message)
        setError(response.message || 'Failed to load tool detail')
      }
    }
    catch (err) {
      console.error('Failed to load tool detail:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tool detail')
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">{t('common.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600">{error}</div>
        <button
          onClick={loadTools}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  if (toolProviders.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">{t('tools.noToolsAvailable')}</div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {toolProviders.map(provider => (
          <div key={provider.name}>
            <h2 className="text-xl font-semibold mb-4">
              {provider.label.ko_KR || provider.label.en_US}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {provider.tools.map(tool => (
                <ToolCard
                  key={`${provider.name}/${tool.name}`}
                  tool={{ ...tool, provider: provider.name }}
                  selected={selectedTools.includes(tool.name)}
                  onToggle={handleToggleTool}
                  onConfigure={handleConfigure}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tool Configuration Modal */}
      <ToolConfigModal
        tool={configTool}
        onClose={() => setConfigTool(null)}
      />
    </>
  )
}
