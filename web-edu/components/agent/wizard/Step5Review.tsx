'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { CircleStackIcon } from '@heroicons/react/24/solid'
import { useAgentWizard } from '@/context/AgentWizardContext'
import { AgentWizardStep } from '@/types/agent'

/**
 * Step 5: Final Review & Save Component
 *
 * Features:
 * - Agent summary (all steps data with edit buttons)
 * - Create Agent button (with loading state)
 * - Knowledge Base (RAG) summary (Story 3.5)
 */
export default function Step5Review() {
  const { t, i18n } = useTranslation('agent')
  const router = useRouter()
  const {
    basicSettings,
    promptSettings,
    modelConfig,
    toolsConfig,
    datasetConfig,  // NEW: Story 3.5
    goToStep,
    createAgent,
    isLoading,
    previousStep,
    isEditMode,
  } = useAgentWizard()

  // 현재 언어 설정 ('ko-KR' → 'ko_KR' 변환)
  const currentLang = (i18n.language || 'en-US').replace('-', '_')

  // Helper: i18n 객체에서 현재 언어에 맞는 텍스트 가져오기
  const getLocalizedText = (i18nObj: string | Record<string, string> | undefined, fallback = ''): string => {
    if (typeof i18nObj === 'string')
      return i18nObj
    if (!i18nObj)
      return fallback

    // 현재 언어 우선 → 영어 → 첫 번째 값 순서
    return i18nObj[currentLang] || i18nObj.en_US || Object.values(i18nObj)[0] || fallback
  }

  const handleCreateAgent = async () => {
    const appId = await createAgent()
    if (appId) {
      // Redirect to Agent list page on success
      router.push('/agents')
    }
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('reviewSettings.title')}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t('reviewSettings.description')}
        </p>
      </div>

      {/* Agent Summary */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          {t('reviewSettings.summaryTitle')}
        </h3>

        {/* Basic Info */}
        <div className="border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600">
          <div className="px-4 py-3 border-b border-gray-300 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {t('reviewSettings.basicInfoTitle')}
              </h4>
              <button
                type="button"
                onClick={() => goToStep(AgentWizardStep.BASIC)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t('reviewSettings.editStep')}
              </button>
            </div>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl"
                style={{ backgroundColor: basicSettings?.icon_background || '#3B82F6' }}
              >
                {basicSettings?.icon || '🤖'}
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {basicSettings?.name || 'Untitled Agent'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {basicSettings?.description || 'No description'}
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t(`types.${basicSettings?.mode || 'chat'}.title`)}
            </div>
          </div>
        </div>

        {/* Prompt */}
        <div className="border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600">
          <div className="px-4 py-3 border-b border-gray-300 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {t('reviewSettings.promptTitle')}
              </h4>
              <button
                type="button"
                onClick={() => goToStep(AgentWizardStep.PROMPT)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t('reviewSettings.editStep')}
              </button>
            </div>
          </div>
          <div className="px-4 py-4 space-y-2 text-sm">
            <pre className="bg-gray-50 p-3 rounded-md font-mono text-xs max-h-64 overflow-y-auto dark:bg-gray-900 whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
{promptSettings?.pre_prompt || 'No system prompt configured'}
            </pre>
            {promptSettings?.opening_statement && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">{t('reviewSettings.openingStatement')}: </span>
                <span className="text-gray-900 dark:text-white">{promptSettings.opening_statement}</span>
              </div>
            )}
            {promptSettings?.suggested_questions && promptSettings.suggested_questions.length > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">{t('reviewSettings.suggestedQuestions')}:</span>
                <ul className="mt-1 ml-4 list-disc text-gray-900 dark:text-white">
                  {promptSettings.suggested_questions.map((question, idx) => (
                    <li key={idx}>{question}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Model */}
        <div className="border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600">
          <div className="px-4 py-3 border-b border-gray-300 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {t('reviewSettings.modelTitle')}
              </h4>
              <button
                type="button"
                onClick={() => goToStep(AgentWizardStep.MODEL)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t('reviewSettings.editStep')}
              </button>
            </div>
          </div>
          <div className="px-4 py-4 space-y-2 text-sm">
            <div className="text-gray-900 dark:text-white">
              <span className="font-medium">{modelConfig?.provider || 'N/A'}</span>
              {' / '}
              {modelConfig?.model || 'N/A'}
            </div>
            {modelConfig && (
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                <div>Temperature: {modelConfig.completion_params.temperature.toFixed(1)}</div>
                <div>Top P: {modelConfig.completion_params.top_p.toFixed(1)}</div>
                <div>Presence Penalty: {modelConfig.completion_params.presence_penalty.toFixed(1)}</div>
                <div>Frequency Penalty: {modelConfig.completion_params.frequency_penalty.toFixed(1)}</div>
                <div>Max Tokens: {modelConfig.completion_params.max_tokens}</div>
              </div>
            )}
          </div>
        </div>

        {/* Tools */}
        <div className="border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600">
          <div className="px-4 py-3 border-b border-gray-300 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {t('reviewSettings.toolsTitle')}
              </h4>
              <button
                type="button"
                onClick={() => goToStep(AgentWizardStep.TOOLS)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t('reviewSettings.editStep')}
              </button>
            </div>
          </div>
          <div className="px-4 py-4">
            {!toolsConfig || toolsConfig.tools.length === 0 ? (
              <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-md dark:bg-yellow-900/20 dark:text-yellow-300">
                {t('reviewSettings.noToolsSelectedWarning')}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {toolsConfig.tools.map(tool => (
                  <span
                    key={tool.tool_name}
                    className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded-md dark:bg-gray-700 dark:text-gray-200"
                  >
                    {getLocalizedText(tool.tool_label, tool.tool_name)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Knowledge Base (RAG) - Story 3.5 */}
        <div className="border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600">
          <div className="px-4 py-3 border-b border-gray-300 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {t('reviewSettings.knowledgeBaseTitle', 'Knowledge Base (RAG)')}
              </h4>
              <button
                type="button"
                onClick={() => goToStep(AgentWizardStep.TOOLS)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t('reviewSettings.editStep')}
              </button>
            </div>
          </div>
          <div className="px-4 py-4">
            {!datasetConfig || !datasetConfig.datasets?.datasets?.length ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('reviewSettings.noKnowledgeBaseSelected', 'No knowledge base connected')}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Selected Datasets */}
                <div className="flex flex-wrap gap-2">
                  {datasetConfig.datasets.datasets.map(item => (
                    <span
                      key={item.dataset.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-md dark:bg-blue-900/20 dark:text-blue-300"
                    >
                      <CircleStackIcon className="h-4 w-4" />
                      {item.dataset.name || item.dataset.id.substring(0, 8) + '...'}
                    </span>
                  ))}
                </div>
                {/* Retrieval Settings Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div>
                    {t('reviewSettings.topK', 'Top K')}: {datasetConfig.top_k ?? 4}
                  </div>
                  <div>
                    {t('reviewSettings.scoreThreshold', 'Score Threshold')}:{' '}
                    {datasetConfig.score_threshold_enabled
                      ? (datasetConfig.score_threshold ?? 0.5).toFixed(1)
                      : t('reviewSettings.disabled', 'Disabled')}
                  </div>
                  <div>
                    {t('reviewSettings.reranking', 'Reranking')}:{' '}
                    {datasetConfig.reranking_enabled
                      ? t('reviewSettings.enabled', 'Enabled')
                      : t('reviewSettings.disabled', 'Disabled')}
                  </div>
                  <div>
                    {t('reviewSettings.retrievalModel', 'Retrieval')}:{' '}
                    {datasetConfig.retrieval_model === 'multiple'
                      ? t('reviewSettings.multipleDatasets', 'Multiple')
                      : t('reviewSettings.singleDataset', 'Single')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t dark:border-gray-700">
        <button
          type="button"
          onClick={previousStep}
          disabled={isLoading}
          className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          {t('buttons.previous')}
        </button>
        <button
            type="button"
            onClick={handleCreateAgent}
            disabled={isLoading}
            className="min-w-32 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                {isEditMode ? '업데이트 중...' : t('reviewSettings.creatingAgent')}
              </span>
            ) : (
              isEditMode ? 'Agent 업데이트' : t('reviewSettings.createAgentButton')
            )}
          </button>
      </div>
    </div>
  )
}
