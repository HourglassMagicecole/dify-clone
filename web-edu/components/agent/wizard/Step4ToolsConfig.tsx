'use client'

import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XMarkIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  KeyIcon,
} from '@heroicons/react/24/outline'
import { toolsConfigSchema, type ToolsConfigFormData } from '@/schemas/agent-schema'
import { useAgentWizard } from '@/context/AgentWizardContext'
import { listTools, getToolDetail } from '@/service/tool-api'
import ToolConfigModal from './ToolConfigModal'
import type { Tool, ToolProvider } from '@/types/tool'
import type { SelectedTool } from '@/types/agent'

/**
 * Step 4: Tools Configuration Component
 *
 * Features:
 * - Tool search
 * - Available tools grid (from Story 2.1B)
 * - Tool selection/deselection
 * - Selected tools list
 */
// Provider별 기본 아이콘 매핑
const PROVIDER_ICONS = {
  // Search & Information
  google: '🔍',
  wikipedia: '📚',
  duckduckgo: '🦆',
  wolframalpha: '🧮',
  youtube: '▶️',
  bing: '🔎',
  yahoo: '💼',
  searxng: '🌐',
  brave: '🦁',
  serper: '🔍',
  serpapi: '🐍',
  searchapi: '🔎',
  tavily: '🔍',

  // Media & Audio
  audio: '🎤',

  // Utilities
  time: '⏰',
  currency: '💱',
  calculator: '🧮',
  maths: '🔢',

  // Weather & Location
  weather: '🌤️',
  openweather: '🌦️',

  // AI Tools
  openai_tool: '✨',

  // Data Processing
  data_analysis: '📊',
  data_alchemy: '⚗️',
  chart: '📈',

  // File Processing
  md_exporter: '📄',
  markitdown: '⬇️',

  // Web & Scraping
  webscraper: '🕷️',

  // Translation
  google_translate: '🌐',

  // Academic
  arxiv: '🎓',

  // JSON Processing
  json_process: '🔧',

  default: '🛠️',
} as const

const DEFAULT_TOOL_ICON = '🛠️'

export default function Step4ToolsConfig() {
  const { t, i18n } = useTranslation('agent')
  const { basicSettings, toolsConfig, setToolsConfig, promptSettings, setPromptSettings, nextStep, previousStep, isEditMode } = useAgentWizard()

  // 현재 언어 설정 ('ko-KR' → 'ko_KR' 변환)
  const currentLang = (i18n.language || 'en-US').replace('-', '_')

  const [toolProviders, setToolProviders] = useState<ToolProvider[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTools, setSelectedTools] = useState<SelectedTool[]>([])
  const [configTool, setConfigTool] = useState<Tool | null>(null)
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set())
  const hasRestoredRef = useRef(false)

  const {
    handleSubmit,
    setValue,
    trigger,
  } = useForm<ToolsConfigFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(toolsConfigSchema) as any,
    mode: isEditMode ? 'all' : 'onChange',
    defaultValues: toolsConfig || { tools: [] },
  })

  // Load tools on mount
  useEffect(() => {
    loadAvailableTools()
  }, [])

  // Restore previous selection (only once on mount)
  useEffect(() => {
    if (!hasRestoredRef.current && toolsConfig && toolsConfig.tools) {
      setSelectedTools(toolsConfig.tools)
      hasRestoredRef.current = true

      // Trigger validation in edit mode
      if (isEditMode) {
        setTimeout(() => {
          trigger()
        }, 100)
      }
    }
  }, [toolsConfig, isEditMode, trigger])

  // Update form when selectedTools changes
  useEffect(() => {
    setValue('tools', selectedTools)
    // Only update context if different to avoid circular updates
    if (JSON.stringify(toolsConfig?.tools) !== JSON.stringify(selectedTools)) {
      setToolsConfig({ tools: selectedTools })
    }
  }, [selectedTools, setValue, setToolsConfig, toolsConfig])

  // Auto-select suggested tools from Step 1 sample (only once, when no tools configured yet)
  useEffect(() => {
    console.log('[Step4] Auto-select check:', {
      hasRestored: hasRestoredRef.current,
      toolProvidersCount: toolProviders.length,
      suggestedTools: basicSettings?.suggested_tools,
      existingToolsCount: toolsConfig?.tools?.length || 0,
      selectedToolsCount: selectedTools.length,
    })

    // Only auto-select if:
    // 1. Tools are loaded
    // 2. Suggested tools exist
    // 3. No tools currently selected (neither from toolsConfig nor selectedTools)
    if (
      toolProviders.length > 0
      && basicSettings?.suggested_tools
      && basicSettings.suggested_tools.length > 0
      && (!toolsConfig || toolsConfig.tools.length === 0)
      && selectedTools.length === 0
    ) {
      console.log('[Step4] Available provider names:', toolProviders.map(p => p.name))
      console.log('[Step4] All providers and their tools:')
      toolProviders.forEach(p => {
        console.log(`  ${p.name}: ${p.tools.map(t => t.name).join(', ')}`)
      })
      const suggestedTools: SelectedTool[] = []

      // Find tools matching suggested_tools
      // Format: "provider.tool" (e.g., "google.google_search") or just "provider" (auto-select first available)
      basicSettings.suggested_tools.forEach(toolSpec => {
        const [providerName, toolName] = toolSpec.includes('.')
          ? toolSpec.split('.', 2)
          : [toolSpec, undefined]

        const provider = toolProviders.find(p => p.name === providerName)
        console.log(`[Step4] Looking for "${toolSpec}":`, provider ? `Provider found (${provider.tools.length} tools)` : 'Provider not found')

        if (provider && provider.tools.length > 0) {
          // If specific tool name provided, find that tool; otherwise find first available
          const tool = toolName
            ? provider.tools.find(t => t.name === toolName && t.available)
            : provider.tools.find(t => t.available)

          console.log(`[Step4] Found tool:`, tool ? `${tool.name} (${tool.available ? 'available' : 'unavailable'})` : 'None')

          if (tool) {
            suggestedTools.push({
              provider_id: provider.name,
              provider_type: 'builtin',
              provider_name: getLocalizedText(provider.label),
              tool_name: tool.name,
              tool_label: getLocalizedText(tool.label),
              tool_parameters: {},
              enabled: true,
            })
          }
        }
      })

      console.log('[Step4] Auto-selected tools:', suggestedTools)
      if (suggestedTools.length > 0) {
        setSelectedTools(suggestedTools)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolProviders, basicSettings, toolsConfig, selectedTools])

  // Helper: i18n 객체에서 현재 언어에 맞는 텍스트 가져오기
  const getLocalizedText = (i18nObj: string | Record<string, string> | undefined, fallback = ''): string => {
    if (typeof i18nObj === 'string')
      return i18nObj
    if (!i18nObj)
      return fallback

    // 현재 언어 우선 → 영어 → 첫 번째 값 순서
    const keys = Object.keys(i18nObj)
    const firstKey = keys[0]
    return i18nObj[currentLang]
      || i18nObj.en_US
      || (firstKey ? i18nObj[firstKey] : undefined)
      || fallback
  }

  // Helper: 도구 아이콘 가져오기 (파일명 방지)
  const getToolIcon = (tool: Tool, provider: ToolProvider): string => {
    // tool.icon이 유효한 emoji인지 확인 (파일명 형태가 아닌 경우)
    if (tool.icon && !tool.icon.includes('.') && !tool.icon.includes('/')) {
      return tool.icon
    }

    // Provider 기본 아이콘 또는 전체 기본 아이콘
    const providerIcon = PROVIDER_ICONS[provider.name as keyof typeof PROVIDER_ICONS]
    return providerIcon ?? DEFAULT_TOOL_ICON
  }

  // Helper: API Key 상태 배지 렌더링
  const renderApiKeyBadge = (tool: Tool) => {
    // 1. unavailable_reason으로 상태 확인 (더 안정적)
    if (tool.unavailable_reason) {
      // Admin API Key 미등록
      if (tool.unavailable_reason.includes('Admin API Key not configured')) {
        return (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            <span>{t('toolsSettings.adminSetupRequired')}</span>
          </div>
        )
      }

      // User API Key 미등록
      if (tool.unavailable_reason.includes('User API Key not configured')) {
        return (
          <div className="flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400">
            <KeyIcon className="h-3.5 w-3.5" />
            <span>{t('toolsSettings.apiKeyRequired')}</span>
          </div>
        )
      }
    }

    // 2. tool_provider 타입 + 등록됨 → 등록됨 (user_has_key가 true인 경우)
    if (tool.api_key_type === 'tool_provider' && tool.user_has_key) {
      return (
        <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          <span>{t('toolsSettings.apiKeyConfigured')}</span>
        </div>
      )
    }

    // 3. 배지 없음 (정상 사용 가능한 도구)
    return null
  }

  const loadAvailableTools = async () => {
    try {
      setIsLoadingTools(true)
      setLoadError(null)
      const response = await listTools()

      if (response.result === 'success' && response.data) {
        setToolProviders(response.data)
      }
      else {
        throw new Error(response.message || 'Failed to load tools')
      }
    }
    catch (error) {
      console.error('Failed to load tools:', error)
      setLoadError(error instanceof Error ? error.message : 'Unknown error')
    }
    finally {
      setIsLoadingTools(false)
    }
  }

  const toggleToolSelection = (tool: Tool, provider: ToolProvider) => {
    const isSelected = selectedTools.some(t => t.tool_name === tool.name)

    if (isSelected) {
      setSelectedTools(prev => prev.filter(t => t.tool_name !== tool.name))
    }
    else {
      const newTool: SelectedTool = {
        provider_id: provider.name,
        provider_type: 'builtin',
        provider_name: getLocalizedText(provider.label),
        tool_name: tool.name,
        tool_label: getLocalizedText(tool.label),
        tool_parameters: {},
        enabled: true,
      }
      setSelectedTools(prev => [...prev, newTool])
    }
  }

  const removeTool = (toolName: string) => {
    setSelectedTools(prev => prev.filter(t => t.tool_name !== toolName))
  }

  const toggleProvider = (providerName: string) => {
    const newExpanded = new Set(expandedProviders)
    if (newExpanded.has(providerName)) {
      newExpanded.delete(providerName)
    }
    else {
      newExpanded.add(providerName)
    }
    setExpandedProviders(newExpanded)
  }

  const handleTestTool = async (tool: Tool, provider: ToolProvider) => {
    try {
      // Fetch detailed tool information including parameters
      const response = await getToolDetail(provider.name, tool.name)

      if (response.result === 'success' && response.data) {
        // Add provider info and preserve availability metadata
        setConfigTool({
          ...response.data,
          provider: provider.name,
          api_key_type: tool.api_key_type,
          requires_user_key: tool.requires_user_key,
          user_has_key: tool.user_has_key,
        })
      }
      else {
        console.error('Failed to load tool detail:', response.message)
        setLoadError(response.message || 'Failed to load tool detail')
      }
    }
    catch (err) {
      console.error('Failed to load tool detail:', err)
      setLoadError(err instanceof Error ? err.message : 'Failed to load tool detail')
    }
  }

  // Filter providers by search query
  const filteredProviders = toolProviders
    .map((provider) => {
      // 검색어가 없으면 전체 Provider 반환
      if (!searchQuery.trim()) {
        return provider
      }

      const searchLower = searchQuery.toLowerCase()

      // Provider 이름으로 검색
      const providerMatches = getLocalizedText(provider.label).toLowerCase().includes(searchLower)

      // 도구 필터링
      const filteredTools = provider.tools.filter((tool) => {
        const toolLabel = getLocalizedText(tool.label).toLowerCase()
        const toolDesc = getLocalizedText(tool.description?.human || '').toLowerCase()
        return (
          toolLabel.includes(searchLower)
          || toolDesc.includes(searchLower)
          || tool.name.toLowerCase().includes(searchLower)
        )
      })

      // Provider 이름이 매칭되면 전체 도구 반환, 아니면 필터된 도구만
      if (providerMatches) {
        return provider
      }
      else if (filteredTools.length > 0) {
        return { ...provider, tools: filteredTools }
      }

      return null
    })
    .filter((p): p is ToolProvider => p !== null && p.tools.length > 0)

  const onSubmit = (data: ToolsConfigFormData) => {
    setToolsConfig(data)
    nextStep()
  }

  /**
   * Generate tools section preview for prompt
   */
  const generateToolsSectionPreview = (): string => {
    if (selectedTools.length === 0) return ''

    const enabledTools = selectedTools.filter(tool => tool.enabled !== false)
    if (enabledTools.length === 0) return ''

    let toolsSection = '## 사용 가능한 도구\n'
    enabledTools.forEach(tool => {
      const toolName = tool.tool_label || tool.tool_name
      toolsSection += `- ${toolName}\n`
    })

    return toolsSection
  }

  const handleNext = () => {
    setToolsConfig({ tools: selectedTools })

    // Update pre_prompt with tools section
    if (promptSettings && selectedTools.length > 0) {
      const enabledTools = selectedTools.filter(tool => tool.enabled !== false)
      if (enabledTools.length > 0) {
        // Remove existing tools section (only the tools section, preserve other sections)
        let basePrompt = promptSettings.pre_prompt || ''
        const toolsSectionIndex = basePrompt.indexOf('## 사용 가능한 도구')

        if (toolsSectionIndex !== -1) {
          // Find the start of the next section after tools section
          const afterToolsSection = basePrompt.substring(toolsSectionIndex + '## 사용 가능한 도구'.length)
          const nextSectionMatch = afterToolsSection.match(/\n##\s/)

          if (nextSectionMatch && nextSectionMatch.index !== undefined) {
            // There's another section after tools section - preserve it
            const nextSectionStart = toolsSectionIndex + '## 사용 가능한 도구'.length + nextSectionMatch.index
            const beforeTools = basePrompt.substring(0, toolsSectionIndex).trim()
            const afterTools = basePrompt.substring(nextSectionStart).trim()
            basePrompt = beforeTools + (afterTools ? '\n\n' + afterTools : '')
          }
          else {
            // No section after tools section - just remove it
            basePrompt = basePrompt.substring(0, toolsSectionIndex).trim()
          }
        }

        // Add new tools section
        let updatedPrompt = basePrompt + '\n\n## 사용 가능한 도구\n'
        enabledTools.forEach(tool => {
          const toolName = tool.tool_label || tool.tool_name
          updatedPrompt += `- ${toolName}\n`
        })

        setPromptSettings({
          ...promptSettings,
          pre_prompt: updatedPrompt,
        })
      }
    }

    nextStep()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('toolsSettings.title')}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t('toolsSettings.description')}
        </p>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <label htmlFor="tool-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('toolsSettings.searchLabel')}
        </label>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            id="tool-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('toolsSettings.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
        </div>
      </div>

      {/* Selected Tools Section */}
      {selectedTools.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {t('toolsSettings.selectedToolsTitle')} ({selectedTools.length})
          </h3>
          <div className="space-y-2">
            {selectedTools.map((tool) => (
              <div
                key={`${tool.provider_id}-${tool.tool_name}`}
                className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600"
              >
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {getLocalizedText(tool.tool_label, tool.tool_name)}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {getLocalizedText(tool.provider_name)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeTool(tool.tool_name)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  aria-label={`Remove ${tool.tool_label}`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Preview Section */}
      {selectedTools.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {t('toolsSettings.promptPreviewTitle')}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {t('toolsSettings.promptPreviewDescription')}
          </p>
          <div className="relative">
            <pre className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap font-mono">
{generateToolsSectionPreview()}
            </pre>
          </div>
        </div>
      )}

      {/* Available Tools Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          {t('toolsSettings.availableToolsTitle')}
        </h3>

        {isLoadingTools ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-32 border border-gray-200 rounded-lg bg-gray-50 animate-pulse dark:bg-gray-800 dark:border-gray-700"
              />
            ))}
          </div>
        ) : loadError ? (
          <div className="p-4 border border-red-300 rounded-lg bg-red-50 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <button
              type="button"
              onClick={loadAvailableTools}
              className="mt-2 text-sm text-red-700 dark:text-red-300 underline hover:no-underline"
            >
              {t('toolsSettings.retryLoad')}
            </button>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-12 border-2 border-dashed border-gray-300 rounded-lg dark:border-gray-600 dark:text-gray-400">
            {searchQuery
              ? t('toolsSettings.noToolsFoundForQuery')
              : t('toolsSettings.noToolsAvailable')}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProviders.map((provider) => {
              const isExpanded = expandedProviders.has(provider.name)
              return (
                <div key={provider.name} className="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-700">
                  {/* Collapsible Provider Header */}
                  <button
                    type="button"
                    onClick={() => toggleProvider(provider.name)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {PROVIDER_ICONS[provider.name as keyof typeof PROVIDER_ICONS] ?? DEFAULT_TOOL_ICON}
                      </span>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {getLocalizedText(provider.label)}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({provider.tools.length})
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Collapsible Provider Tools Grid */}
                  {isExpanded && (
                    <div className="p-4 bg-white dark:bg-gray-900">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {provider.tools.map((tool) => {
                    const isSelected = selectedTools.some(t => t.tool_name === tool.name)
                    const isAvailable = tool.available
                    const toolIcon = getToolIcon(tool, provider)

                    return (
                      <div
                        key={`${provider.name}-${tool.name}`}
                        className={`
                          relative p-4 border rounded-lg transition-all
                          ${isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600'}
                          ${!isAvailable && 'opacity-50'}
                          dark:bg-gray-800
                        `}
                      >
                        <div className="space-y-3">
                          {/* Tool Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-2xl flex-shrink-0">{toolIcon}</span>
                              <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                {getLocalizedText(tool.label)}
                              </span>
                            </div>
                            {isSelected && (
                              <CheckCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            )}
                          </div>

                          {/* Tool Description */}
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                            {getLocalizedText(tool.description?.human)}
                          </p>

                          {/* API Key Status Badge */}
                          {renderApiKeyBadge(tool)}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            {/* Test Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleTestTool(tool, provider)
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
                            >
                              <BeakerIcon className="h-4 w-4" />
                              {t('toolsSettings.testTool')}
                            </button>

                            {/* Select/Deselect Button */}
                            <button
                              type="button"
                              onClick={() => isAvailable && toggleToolSelection(tool, provider)}
                              disabled={!isAvailable}
                              className={`
                                flex-1 px-3 py-2 text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors
                                ${isSelected
                                  ? 'text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'}
                                ${!isAvailable && 'opacity-50 cursor-not-allowed'}
                              `}
                            >
                              {isSelected ? t('toolsSettings.deselectTool') : t('toolsSettings.selectTool')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t dark:border-gray-700">
        <button
          type="button"
          onClick={previousStep}
          className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          {t('buttons.previous')}
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {t('buttons.next')}
        </button>
      </div>

      {/* Tool Configuration Modal */}
      <ToolConfigModal
        tool={configTool}
        onClose={() => setConfigTool(null)}
        onApiKeySaved={() => {
          // API Key 저장 후 도구 목록을 새로고침하여 user_has_key 상태 업데이트
          loadAvailableTools()
        }}
      />
    </form>
  )
}
