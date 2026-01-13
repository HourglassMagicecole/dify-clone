'use client'

import { useEffect, useState, useRef } from 'react'
import { useForm, Controller, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { ArrowPathIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { modelConfigSchema, type ModelConfigFormData } from '@/schemas/agent-schema'
import { useAgentWizard } from '@/context/AgentWizardContext'
import { difyAPI } from '@/service/dify-api'
import type { ModelProvider, ModelInfo, AgentModelConfig } from '@/types/agent'
import { Tooltip } from '@/components/common/Tooltip'

/**
 * Parameter Rule from Dify API
 */
interface ParameterRule {
  name: string
  use_template?: string | null
  label: { en_US?: string; [key: string]: string | undefined }
  type: string
  help?: { en_US?: string; [key: string]: string | undefined } | null
  required?: boolean
  default?: unknown
  min?: number | null
  max?: number | null
  precision?: number | null
  options?: string[]
}

/**
 * Helper: Get default models for a provider
 * This is a workaround since Dify API doesn't return models in the provider list
 */
function getDefaultModelsForProvider(providerName: string): ModelInfo[] {
  const defaultModels: Record<string, ModelInfo[]> = {
    openai: [
      {
        model: 'gpt-4',
        label: { en_US: 'GPT-4' },
        model_type: 'llm',
        features: ['agent-thought'],
        model_properties: { context_size: 8192, max_chunks: 1, mode: 'chat' },
        parameter_rules: [],
      },
      {
        model: 'gpt-4-turbo',
        label: { en_US: 'GPT-4 Turbo' },
        model_type: 'llm',
        features: ['agent-thought'],
        model_properties: { context_size: 128000, max_chunks: 1, mode: 'chat' },
        parameter_rules: [],
      },
      {
        model: 'gpt-3.5-turbo',
        label: { en_US: 'GPT-3.5 Turbo' },
        model_type: 'llm',
        features: ['agent-thought'],
        model_properties: { context_size: 16385, max_chunks: 1, mode: 'chat' },
        parameter_rules: [],
      },
    ],
    anthropic: [
      {
        model: 'claude-3-5-sonnet-20241022',
        label: { en_US: 'Claude 3.5 Sonnet' },
        model_type: 'llm',
        features: ['agent-thought'],
        model_properties: { context_size: 200000, max_chunks: 1, mode: 'chat' },
        parameter_rules: [],
      },
      {
        model: 'claude-3-opus-20240229',
        label: { en_US: 'Claude 3 Opus' },
        model_type: 'llm',
        features: ['agent-thought'],
        model_properties: { context_size: 200000, max_chunks: 1, mode: 'chat' },
        parameter_rules: [],
      },
    ],
  }

  return defaultModels[providerName] || []
}

/**
 * Get parameter support based on parameter_rules from API
 * Returns which parameters are supported by the current model
 */
function getParameterSupport(parameterRules: ParameterRule[]) {
  const hasParameter = (name: string) => parameterRules.some(rule => rule.name === name)

  return {
    temperature: hasParameter('temperature'),
    top_p: hasParameter('top_p'),
    presence_penalty: hasParameter('presence_penalty'),
    frequency_penalty: hasParameter('frequency_penalty'),
    max_tokens: hasParameter('max_tokens'),
  }
}

/**
 * Step 3: LLM Model Configuration Component
 *
 * Features:
 * - Provider selection (shows only active providers with API keys)
 * - Model selection (filtered by selected provider)
 * - Model parameters (Temperature, Top P, Presence/Frequency Penalty, Max Tokens)
 * - Reset to default button
 * - Auto-save to context
 */
export default function Step3ModelConfig() {
  const { t } = useTranslation('agent')
  const { modelConfig, setModelConfig, basicSettings, nextStep, previousStep } = useAgentWizard()

  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider | null>(null)
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [parameterRules, setParameterRules] = useState<ParameterRule[]>([])
  const [_isLoadingParameterRules, _setIsLoadingParameterRules] = useState(false)
  const [isParametersExpanded, setIsParametersExpanded] = useState(false)

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset: _reset,
    trigger,
    formState: { errors, isValid },
  } = useForm<ModelConfigFormData>({
    resolver: zodResolver(modelConfigSchema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    mode: 'onChange',
    defaultValues: modelConfig || {
      provider: '',
      model: '',
      mode: basicSettings?.mode === 'completion' ? 'completion' : 'chat',
      completion_params: {
        temperature: 1.0,
        top_p: 1.0,
        presence_penalty: 0.0,
        frequency_penalty: 0.0,
        max_tokens: 4096,
        stop: [],
      },
    },
  })

  const temperatureValue = watch('completion_params.temperature')
  const topPValue = watch('completion_params.top_p')
  const presencePenaltyValue = watch('completion_params.presence_penalty')
  const frequencyPenaltyValue = watch('completion_params.frequency_penalty')
  const maxTokensValue = watch('completion_params.max_tokens')

  // Get parameter support based on fetched parameter_rules
  // Default to all parameters supported if rules not loaded yet
  const parameterSupport = parameterRules.length > 0
    ? getParameterSupport(parameterRules)
    : {
        temperature: true,
        top_p: true,
        presence_penalty: true,
        frequency_penalty: true,
        max_tokens: true,
      }

  // Load providers on mount
  useEffect(() => {
    loadProviders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync form with modelConfig from context (for edit mode)
  // Use a ref to track if we've already reset to avoid infinite loop
  const hasResetRef = useRef(false)
  useEffect(() => {
    if (modelConfig && !hasResetRef.current) {
      _reset(modelConfig)
      hasResetRef.current = true
    }
  }, [modelConfig, _reset])

  // Auto-select provider and model when modelConfig is loaded (edit mode)
  // NOTE: We don't call handleProviderChange to avoid overwriting completion_params
  useEffect(() => {
    if (modelConfig && providers.length > 0 && !selectedProvider) {
      // Try exact match first
      let provider = providers.find(p => p.provider === modelConfig.provider)

      // If not found, try matching by extracting provider name from path
      // "langgenius/openai/openai" -> "openai"
      if (!provider && modelConfig.provider) {
        const providerName = modelConfig.provider.split('/').pop()
        provider = providers.find(p => p.provider === providerName)
      }

      if (provider) {
        setSelectedProvider(provider)

        // Update form values to use the simplified provider name
        setValue('provider', provider.provider, { shouldValidate: true })
        setValue('original_provider', provider.original_provider || provider.provider)

        // Load models for this provider WITHOUT calling handleProviderChange
        // to preserve completion_params that were already set by _reset()
        const loadModelsForEditMode = async () => {
          try {
            setIsLoadingModels(true)
            const originalProvider = provider.original_provider || provider.provider
            const modelsResponse = await difyAPI.getProviderModels(originalProvider)

            let models: ModelInfo[] = []

            if (modelsResponse.result === 'success' && modelsResponse.data) {
              if (Array.isArray(modelsResponse.data)) {
                // Filter by LLM type and exclude disabled models (Story 3.7 AC:6)
                // API uses 'status' field: 'active' | 'disabled' | 'no-configure' etc.
                models = modelsResponse.data
                  .filter((m: ModelInfo) => m.model_type === 'llm')
                  .filter((m: ModelInfo) => m.status === 'active')
              }
              else if (typeof modelsResponse.data === 'object' && 'data' in modelsResponse.data) {
                const nestedData = (modelsResponse.data as { data?: ModelInfo[] }).data
                // Filter by LLM type and exclude disabled models (Story 3.7 AC:6)
                models = nestedData
                  ?.filter((m: ModelInfo) => m.model_type === 'llm')
                  .filter((m: ModelInfo) => m.status === 'active') || []
              }
            }

            // Fallback to hardcoded models if API fails
            if (models.length === 0) {
              models = provider.models.filter((m: ModelInfo) => m.model_type === 'llm')
            }

            setAvailableModels(models)

            // Auto-select the model from modelConfig
            const model = models.find((m: ModelInfo) => m.model === modelConfig.model)
            if (model) {
              setSelectedModel(model)
              // Update form value to ensure select shows the model
              setValue('model', model.model, { shouldValidate: true })
              // Fetch parameter rules for this model
              await fetchParameterRules(provider, model)
            } else {
              console.warn('[Step3] Model not found for:', modelConfig.model)
            }
          }
          catch (error) {
            console.error('Failed to load models for edit mode:', error)
            // Use fallback models
            const models = provider.models.filter((m: ModelInfo) => m.model_type === 'llm')
            setAvailableModels(models)

            const model = models.find((m: ModelInfo) => m.model === modelConfig.model)
            if (model) {
              setSelectedModel(model)
              setValue('model', model.model, { shouldValidate: true })
              // Fetch parameter rules for this model
              await fetchParameterRules(provider, model)
            }
          }
          finally {
            setIsLoadingModels(false)
          }
        }

        loadModelsForEditMode()
      } else {
        console.warn('[Step3] Provider not found for:', modelConfig.provider)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelConfig, providers, selectedProvider])

  // Trigger validation when returning to this step
  useEffect(() => {
    // Re-validate form when component mounts or modelConfig changes
    trigger()
  }, [trigger])

  /**
   * Fetch parameter rules for a specific model
   * Reusable helper function
   */
  const fetchParameterRules = async (provider: ModelProvider, model: ModelInfo) => {
    try {
      _setIsLoadingParameterRules(true)
      const originalProvider = provider.original_provider || provider.provider
      const rulesResponse = await difyAPI.getModelParameterRules(originalProvider, model.model)

      if (rulesResponse.result === 'success' && rulesResponse.data) {
        const rules = Array.isArray(rulesResponse.data)
          ? rulesResponse.data
          : (rulesResponse.data as { data?: ParameterRule[] }).data || []

        setParameterRules(rules as ParameterRule[])
      } else {
        console.warn('[Step3] Failed to load parameter rules:', rulesResponse.message)
        setParameterRules([])
      }
    }
    catch (error) {
      console.error('[Step3] Error loading parameter rules:', error)
      setParameterRules([])
    }
    finally {
      _setIsLoadingParameterRules(false)
    }
  }

  const loadProviders = async () => {
    try {
      setIsLoadingProviders(true)
      setLoadError(null)
      const response = await difyAPI.getModelProviders()

      if (response.result === 'success' && response.data) {
        // Filter only active providers (with API keys configured)
        // Note: Dify API returns status in custom_configuration.status
        interface DifyProviderResponse {
          provider: string
          label: string | { en_US?: string; ko_KR?: string; [key: string]: string | undefined }
          description?: string | { en_US?: string; ko_KR?: string; [key: string]: string | undefined }
          icon_small: string | { en_US?: string; [key: string]: string | undefined }
          custom_configuration?: { status?: string }
          system_configuration?: { enabled?: boolean }
          supported_model_types: string[]
          status?: 'active' | 'no-configure'
        }

        const activeProviders = response.data.filter((p: DifyProviderResponse) =>
          p.custom_configuration?.status === 'active' || p.system_configuration?.enabled === true
        )

        // Prepare providers with simplified names
        const providersWithModels = activeProviders.map((p: DifyProviderResponse) => {
          // Extract simple provider name (e.g., "openai" from "langgenius/openai/openai")
          const providerName = p.provider.split('/')[1] || p.provider

          // Convert i18n objects to strings (use en_US)
          const label = typeof p.label === 'object' ? p.label.en_US : p.label
          const description = typeof p.description === 'object' ? p.description.en_US : p.description
          const iconSmall = typeof p.icon_small === 'object' ? p.icon_small.en_US : p.icon_small

          return {
            ...p,
            provider: providerName, // Simplified provider name for form
            original_provider: p.provider, // Keep original for API calls
            label: label || providerName,
            description,
            icon_small: { en_US: iconSmall || '' }, // Keep expected structure
            models: getDefaultModelsForProvider(providerName), // Fallback models
            status: 'active' as const,
          }
        })

        setProviders(providersWithModels as ModelProvider[])

        // Restore previous selection if exists
        if (modelConfig && modelConfig.provider) {
          const provider = providersWithModels.find((p) => p.provider === modelConfig.provider)
          if (provider) {
            setSelectedProvider(provider)

            // Fetch actual models from API (not just fallback)
            try {
              const originalProvider = provider.original_provider || provider.provider
              const modelsResponse = await difyAPI.getProviderModels(originalProvider)

              let models: ModelInfo[] = []

              if (modelsResponse.result === 'success' && modelsResponse.data) {
                if (Array.isArray(modelsResponse.data)) {
                  // Filter by LLM type and exclude disabled models (Story 3.7 AC:6)
                  // API uses 'status' field: 'active' | 'disabled' | 'no-configure' etc.
                  models = modelsResponse.data
                    .filter((m: ModelInfo) => m.model_type === 'llm')
                    .filter((m: ModelInfo) => m.status === 'active')
                }
                else if (typeof modelsResponse.data === 'object' && 'data' in modelsResponse.data) {
                  const nestedData = (modelsResponse.data as { data?: ModelInfo[] }).data
                  // Filter by LLM type and exclude disabled models (Story 3.7 AC:6)
                  models = nestedData
                    ?.filter((m: ModelInfo) => m.model_type === 'llm')
                    .filter((m: ModelInfo) => m.status === 'active') || []
                }
              }

              // Fallback to hardcoded models if API fails
              if (models.length === 0) {
                models = provider.models.filter((m: ModelInfo) => m.model_type === 'llm')
              }

              setAvailableModels(models)

              // Restore selected model
              const model = models.find((m: ModelInfo) => m.model === modelConfig.model)
              if (model) {
                setSelectedModel(model)
                // Fetch parameter rules for this model
                await fetchParameterRules(provider, model)
              }
            }
            catch (error) {
              console.error('Failed to load models for restore:', error)
              // Use fallback models
              const models = provider.models.filter((m: ModelInfo) => m.model_type === 'llm')
              setAvailableModels(models)

              const model = models.find((m: ModelInfo) => m.model === modelConfig.model)
              if (model) {
                setSelectedModel(model)
                // Fetch parameter rules for this model
                await fetchParameterRules(provider, model)
              }
            }
          }
        }
      }
      else {
        throw new Error(response.message || 'Failed to load providers')
      }
    }
    catch (error) {
      console.error('Failed to load providers:', error)
      setLoadError(error instanceof Error ? error.message : 'Unknown error')
    }
    finally {
      setIsLoadingProviders(false)
    }
  }

  // Auto-save to context when form changes
  useEffect(() => {
    const subscription = watch((value) => {
      if (isValid) {
        setModelConfig(value as AgentModelConfig)
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, isValid, setModelConfig])

  const onSubmit: SubmitHandler<ModelConfigFormData> = (data) => {
    setModelConfig(data)
    nextStep()
  }

  const handleProviderChange = async (newProvider: string) => {
    const provider = providers.find(p => p.provider === newProvider)
    setSelectedProvider(provider || null)

    // Update form with provider value
    setValue('provider', newProvider, { shouldValidate: true })
    // Store original provider for API calls
    setValue('original_provider', provider?.original_provider || newProvider)

    if (provider) {
      try {
        setIsLoadingModels(true)

        // Try to fetch actual models from API
        const originalProvider = provider.original_provider || provider.provider
        const modelsResponse = await difyAPI.getProviderModels(originalProvider)

        let models: ModelInfo[] = []

        if (modelsResponse.result === 'success' && modelsResponse.data) {
          // API returned models - use them
          if (Array.isArray(modelsResponse.data)) {
            // Filter by LLM type and exclude disabled models (Story 3.7 AC:6)
            // API uses 'status' field: 'active' | 'disabled' | 'no-configure' etc.
            models = modelsResponse.data
              .filter((m: ModelInfo) => m.model_type === 'llm')
              .filter((m: ModelInfo) => m.status === 'active')
          }
          else if (typeof modelsResponse.data === 'object' && 'data' in modelsResponse.data) {
            const nestedData = (modelsResponse.data as { data?: ModelInfo[] }).data
            // Filter by LLM type and exclude disabled models (Story 3.7 AC:6)
            models = nestedData
              ?.filter((m: ModelInfo) => m.model_type === 'llm')
              .filter((m: ModelInfo) => m.status === 'active') || []
          }
        }

        // If no models from API, use fallback hardcoded models
        if (models.length === 0) {
          console.warn(`No models from API for ${provider.provider}, using fallback`)
          models = provider.models.filter(m => m.model_type === 'llm')
        }

        setAvailableModels(models)

        // Auto-select first model
        if (models.length > 0) {
          const firstModel = models[0]
          if (firstModel) {
            setValue('model', firstModel.model, { shouldValidate: true })
            setSelectedModel(firstModel)

            // Set default max_tokens based on model context size
            const contextSize = firstModel.model_properties?.context_size || 4096
            setValue('completion_params.max_tokens', Math.min(4096, contextSize), { shouldValidate: true })

            // Fetch parameter rules for the auto-selected model
            await fetchParameterRules(provider, firstModel)
          }
        }
      }
      catch (error) {
        console.error('Failed to load models from API, using fallback:', error)
        // Use fallback hardcoded models
        const models = provider.models.filter(m => m.model_type === 'llm')
        setAvailableModels(models)

        if (models.length > 0) {
          const firstModel = models[0]
          if (firstModel) {
            setValue('model', firstModel.model, { shouldValidate: true })
            setSelectedModel(firstModel)
            const contextSize = firstModel.model_properties?.context_size || 4096
            setValue('completion_params.max_tokens', Math.min(4096, contextSize), { shouldValidate: true })

            // Fetch parameter rules for the auto-selected model
            await fetchParameterRules(provider, firstModel)
          }
        }
      }
      finally {
        setIsLoadingModels(false)
      }
    }
    else {
      setAvailableModels([])
      setSelectedModel(null)
      setValue('model', '')
    }
  }

  const handleModelChange = async (newModel: string) => {
    const model = availableModels.find(m => m.model === newModel)
    setSelectedModel(model || null)

    if (model) {
      // Update max_tokens based on model's context size
      const contextSize = model.model_properties?.context_size || 4096
      setValue('completion_params.max_tokens', Math.min(4096, contextSize))

      // Fetch parameter_rules for this model
      if (selectedProvider) {
        await fetchParameterRules(selectedProvider, model)
      }
    } else {
      setParameterRules([])
    }
  }

  const resetToDefaults = () => {
    setValue('completion_params', {
      temperature: 1.0,
      top_p: 1.0,
      presence_penalty: 0.0,
      frequency_penalty: 0.0,
      max_tokens: selectedModel?.model_properties.context_size
        ? Math.min(4096, selectedModel.model_properties.context_size)
        : 4096,
      stop: [],
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('modelSettings.title')}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t('modelSettings.description')}
        </p>
      </div>

      {/* Provider Selection */}
      <div className="space-y-2">
        <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('modelSettings.providerLabel')}
          <span className="text-red-500 ml-1">*</span>
        </label>

        {isLoadingProviders ? (
          <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              <span>{t('modelSettings.loadingProviders')}</span>
            </div>
          </div>
        ) : loadError ? (
          <div className="w-full px-4 py-3 border border-red-300 rounded-lg bg-red-50 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <button
              type="button"
              onClick={loadProviders}
              className="mt-2 text-sm text-red-700 dark:text-red-300 underline hover:no-underline"
            >
              {t('modelSettings.retryLoad')}
            </button>
          </div>
        ) : providers.length === 0 ? (
          <div className="w-full px-4 py-3 border border-yellow-300 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {t('modelSettings.noProvidersAvailable')}
            </p>
          </div>
        ) : (
          <Controller
            name="provider"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                id="provider"
                onChange={(e) => {
                  field.onChange(e)
                  handleProviderChange(e.target.value)
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="">{t('modelSettings.providerPlaceholder')}</option>
                {providers.map(provider => (
                  <option key={provider.provider} value={provider.provider}>
                    {provider.label}
                  </option>
                ))}
              </select>
            )}
          />
        )}

        {errors.provider && (
          <p className="text-sm text-red-600 dark:text-red-400">{t(errors.provider.message as string)}</p>
        )}
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('modelSettings.modelLabel')}
          <span className="text-red-500 ml-1">*</span>
        </label>

        {isLoadingModels ? (
          <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
            <div className="flex items-center gap-2">
              <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Loading models...
              </span>
            </div>
          </div>
        ) : (
          <Controller
            name="model"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                id="model"
                onChange={(e) => {
                  field.onChange(e)
                  handleModelChange(e.target.value)
                }}
                disabled={!selectedProvider || availableModels.length === 0}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-700"
              >
                <option value="">{t('modelSettings.modelPlaceholder')}</option>
                {availableModels.map(model => (
                  <option key={model.model} value={model.model}>
                    {model.label.en_US} ({model.model_properties.context_size.toLocaleString()} tokens)
                  </option>
                ))}
              </select>
            )}
          />
        )}

        {selectedModel && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('modelSettings.featuresLabel')}: {selectedModel.features.join(', ')}
          </p>
        )}

        {errors.model && (
          <p className="text-sm text-red-600 dark:text-red-400">{t(errors.model.message as string)}</p>
        )}
      </div>

      {/* Model Parameters - Collapsible */}
      <div className="border-t pt-6 dark:border-gray-700">
        {/* Collapsible Header */}
        <button
          type="button"
          onClick={() => setIsParametersExpanded(!isParametersExpanded)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ChevronDownIcon
              className={`h-5 w-5 text-gray-500 transition-transform ${isParametersExpanded ? 'rotate-180' : ''}`}
            />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {t('modelSettings.parametersTitle')} ({t('modelSettings.advanced', { defaultValue: '고급' })})
            </h3>
          </div>
          {!isParametersExpanded && (
            <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              Temperature: {temperatureValue?.toFixed(1) || '1.0'} · Top P: {topPValue?.toFixed(1) || '1.0'} · Max Tokens: {maxTokensValue?.toLocaleString() || '4,096'}
            </div>
          )}
        </button>

        {/* Expanded Content */}
        {isParametersExpanded && (
          <div className="mt-4 space-y-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 border-t-0 rounded-t-none -mt-1">
            {/* Reset Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={resetToDefaults}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                <ArrowPathIcon className="h-4 w-4" />
                {t('modelSettings.resetToDefault')}
              </button>
            </div>

            {/* Temperature */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('modelSettings.temperatureLabel')}
              </label>
              <Tooltip content={t('modelSettings.temperatureTooltip')} />
            </div>
            <span className="text-sm font-mono text-gray-900 dark:text-white">
              {temperatureValue?.toFixed(1) || '1.0'}
            </span>
          </div>
          <Controller
            name="completion_params.temperature"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                value={field.value ?? 1.0}
                id="temperature"
                type="range"
                min="0"
                max="1"
                step="0.1"
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:bg-gray-700"
              />
            )}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('modelSettings.temperatureHelp')}
          </p>
        </div>

        {/* Top P */}
        {parameterSupport.top_p && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <label htmlFor="top_p" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('modelSettings.topPLabel')}
                </label>
                <Tooltip content={t('modelSettings.topPTooltip')} />
              </div>
              <span className="text-sm font-mono text-gray-900 dark:text-white">
                {topPValue?.toFixed(1) || '1.0'}
              </span>
            </div>
            <Controller
              name="completion_params.top_p"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  value={field.value ?? 1.0}
                  id="top_p"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:bg-gray-700"
                />
              )}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('modelSettings.topPHelp')}
            </p>
          </div>
        )}

        {/* Presence Penalty */}
        {parameterSupport.presence_penalty && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <label htmlFor="presence_penalty" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('modelSettings.presencePenaltyLabel')}
                </label>
                <Tooltip content={t('modelSettings.presencePenaltyTooltip')} />
              </div>
              <span className="text-sm font-mono text-gray-900 dark:text-white">
                {presencePenaltyValue?.toFixed(1) || '0.0'}
              </span>
            </div>
            <Controller
              name="completion_params.presence_penalty"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  value={field.value ?? 0.0}
                  id="presence_penalty"
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:bg-gray-700"
                />
              )}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('modelSettings.presencePenaltyHelp')}
            </p>
          </div>
        )}

        {/* Frequency Penalty */}
        {parameterSupport.frequency_penalty && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <label htmlFor="frequency_penalty" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('modelSettings.frequencyPenaltyLabel')}
                </label>
                <Tooltip content={t('modelSettings.frequencyPenaltyTooltip')} />
              </div>
              <span className="text-sm font-mono text-gray-900 dark:text-white">
                {frequencyPenaltyValue?.toFixed(1) || '0.0'}
              </span>
            </div>
            <Controller
              name="completion_params.frequency_penalty"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  value={field.value ?? 0.0}
                  id="frequency_penalty"
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:bg-gray-700"
                />
              )}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('modelSettings.frequencyPenaltyHelp')}
            </p>
          </div>
        )}

        {/* Max Tokens */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="max_tokens" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('modelSettings.maxTokensLabel')}
            </label>
            <Tooltip content={t('modelSettings.maxTokensTooltip')} />
          </div>
          <input
            {...register('completion_params.max_tokens', { valueAsNumber: true })}
            id="max_tokens"
            type="number"
            min="1"
            max={selectedModel?.model_properties.context_size || 128000}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('modelSettings.maxTokensHelp')}
            {selectedModel && (
              <span className="ml-1">
                (Max: {selectedModel.model_properties.context_size.toLocaleString()})
              </span>
            )}
          </p>
          {errors.completion_params?.max_tokens && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.completion_params.max_tokens.message}
            </p>
          )}
        </div>
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
          type="submit"
          disabled={!isValid}
          className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {t('buttons.next')}
        </button>
      </div>
    </form>
  )
}
