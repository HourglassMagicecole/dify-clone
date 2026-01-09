/**
 * Step 1: Basic Settings Component for Agent Creation Wizard
 * Collects basic information about the Agent: name, description, type, and role
 */

'use client'

import React, { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useAgentWizard } from '@/context/AgentWizardContext'
import { AgentType, ConfigMode, type AgentPromptSettings } from '@/types/agent'
import { basicSettingsSchema, BasicSettingsFormData } from '@/schemas/agent-schema'
import { Input } from '@/components/common/Input'
import { Textarea } from '@/components/common/Textarea'
import { RadioGroup, RadioOption } from '@/components/common/RadioGroup'
import { Button } from '@/components/common/Button'

export function Step1BasicSettings(): React.ReactElement {
  const { t } = useTranslation('agent')
  const { basicSettings, setBasicSettings, nextStep, isEditMode, setPromptSettings } = useAgentWizard()

  /**
   * Configuration mode state (Auto or Manual)
   * Always starts with Manual mode
   */
  const [configMode, setConfigMode] = useState<ConfigMode>(ConfigMode.MANUAL)

  /**
   * Suggested tools from selected sample (for Step 4 auto-selection)
   */
  const [suggestedTools, setSuggestedTools] = useState<string[]>([])

  /**
   * Track selected sample ID in auto mode
   */
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)

  /**
   * Track previous configMode to detect actual changes
   */
  const prevConfigModeRef = React.useRef<ConfigMode>(configMode)

  /**
   * Initialize React Hook Form with Zod validation
   */
  const {
    register,
    control,
    handleSubmit,
    formState,
    watch,
    setValue,
    reset,
    trigger,
  } = useForm<BasicSettingsFormData>({
    resolver: zodResolver(basicSettingsSchema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    mode: isEditMode ? 'all' : 'onChange', // In edit mode, validate on mount
    defaultValues: basicSettings || {
      name: '',
      description: '',
      mode: AgentType.CHAT,
      role: '',
      tool_enabled: true,
      icon_type: 'emoji',
      icon: '🤖',
      icon_background: '#3B82F6',
    },
  })

  /**
   * Destructure formState
   */
  const { errors, isSubmitting, isValid } = formState


  /**
   * Watch values for character count and mode
   */
  const descriptionValue = watch('description') || ''
  const currentMode = watch('mode')

  /**
   * Sync form with basicSettings from context
   * - When user clicks "Previous" button, form should be filled with saved data
   * - When user clicks "Start Fresh", form should be reset
   */
  React.useEffect(() => {
    if (basicSettings === null) {
      // Reset to initial values when starting fresh
      reset({
        name: '',
        description: '',
        mode: AgentType.CHAT,
        role: '',
        tool_enabled: true,
        icon_type: 'emoji',
        icon: '🤖',
        icon_background: '#3B82F6',
      })
      setConfigMode(ConfigMode.MANUAL)
    } else {
      // Update form with saved data when navigating back
      // In edit mode, trigger validation after reset
      reset(basicSettings, {
        keepDefaultValues: false,
        keepDirty: false,
        keepTouched: false,
      })
      // Don't change configMode - keep user's previous selection
    }
  }, [basicSettings, reset])

  /**
   * Trigger validation in edit mode after data is loaded
   * This ensures the "Next" button is enabled when form is pre-filled
   */
  React.useEffect(() => {
    if (isEditMode && basicSettings) {
      // Trigger validation after a short delay to ensure form is fully initialized
      const timer = setTimeout(async () => {
        await trigger()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isEditMode, basicSettings, trigger])

  /**
   * Reset form when configuration mode changes
   * This ensures a clean slate when switching between Auto and Manual modes
   */
  React.useEffect(() => {
    // Only reset if configMode actually changed (not on mount/remount)
    if (prevConfigModeRef.current !== configMode) {
      // Reset form to initial values when config mode changes
      reset({
        name: '',
        description: '',
        mode: AgentType.CHAT,
        role: '',
        tool_enabled: true,
        icon_type: 'emoji',
        icon: '🤖',
        icon_background: '#3B82F6',
      })

      // Clear selected sample when switching modes
      setSelectedSampleId(null)

      // Update the previous value
      prevConfigModeRef.current = configMode
    }
  }, [configMode, reset])


  /**
   * Radio options for Agent type selection
   */
  const agentTypeOptions: RadioOption[] = [
    {
      value: AgentType.CHAT,
      title: t('types.chat.title'),
      description: t('types.chat.description'),
      icon: '💬',
    },
    {
      value: AgentType.COMPLETION,
      title: t('types.completion.title'),
      description: t('types.completion.description'),
      icon: '⚙️',
    },
  ]

  /**
   * ConfigMode radio options
   */
  const configModeOptions: RadioOption[] = [
    {
      value: ConfigMode.AUTO,
      title: t('configMode.auto.title'),
      description: t('configMode.auto.description'),
      icon: '✨',
    },
    {
      value: ConfigMode.MANUAL,
      title: t('configMode.manual.title'),
      description: t('configMode.manual.description'),
      icon: '✏️',
    },
  ]

  /**
   * Role template samples with full data for auto-fill
   */
  const allRoleSamples = [
    // Chat mode samples (대화형)
    {
      id: 'learningMentor',
      mode: AgentType.CHAT,
      icon: t('roleSamples.learningMentor.icon'),
      title: t('roleSamples.learningMentor.title'),
      suggestedName: t('roleSamples.learningMentor.suggestedName'),
      description: t('roleSamples.learningMentor.description'),
      content: t('roleSamples.learningMentor.content'),
      suggested_opening_statement: '안녕하세요! 학습 멘토입니다. 무엇을 배우고 싶으신가요?',
      suggested_questions: [
        '파이썬 기초를 배우고 싶어요',
        '수학 개념을 쉽게 설명해주실 수 있나요?',
        '영어 문법을 공부하고 있는데 도움이 필요해요',
      ],
    },
    {
      id: 'travelGuide',
      mode: AgentType.CHAT,
      icon: t('roleSamples.travelGuide.icon'),
      title: t('roleSamples.travelGuide.title'),
      suggestedName: t('roleSamples.travelGuide.suggestedName'),
      description: t('roleSamples.travelGuide.description'),
      content: t('roleSamples.travelGuide.content'),
      suggested_opening_statement: '안녕하세요! 여행 가이드입니다. 어디로 여행을 계획 중이신가요?',
      suggested_questions: [
        '제주도 3박 4일 여행 추천해주세요',
        '유럽 배낭여행 코스가 궁금해요',
        '도쿄 맛집과 명소를 알려주세요',
      ],
    },
    {
      id: 'healthCoach',
      mode: AgentType.CHAT,
      icon: t('roleSamples.healthCoach.icon'),
      title: t('roleSamples.healthCoach.title'),
      suggestedName: t('roleSamples.healthCoach.suggestedName'),
      description: t('roleSamples.healthCoach.description'),
      content: t('roleSamples.healthCoach.content'),
      suggested_opening_statement: '안녕하세요! 건강 코치입니다. 건강 목표를 달성하도록 도와드릴게요!',
      suggested_questions: [
        '운동 초보자인데 어떻게 시작하면 좋을까요?',
        '건강한 식단 계획을 세우고 싶어요',
        '수면의 질을 개선하는 방법이 궁금해요',
      ],
    },
    {
      id: 'customerSupport',
      mode: AgentType.CHAT,
      icon: t('roleSamples.customerSupport.icon'),
      title: t('roleSamples.customerSupport.title'),
      suggestedName: t('roleSamples.customerSupport.suggestedName'),
      description: t('roleSamples.customerSupport.description'),
      content: t('roleSamples.customerSupport.content'),
      suggested_opening_statement: '안녕하세요! 무엇을 도와드릴까요?',
      suggested_questions: [
        '제품 사용법을 알려주세요',
        '환불 정책이 궁금합니다',
        '배송 상태를 확인하고 싶어요',
      ],
    },
    {
      id: 'bookCurator',
      mode: AgentType.CHAT,
      icon: t('roleSamples.bookCurator.icon'),
      title: t('roleSamples.bookCurator.title'),
      suggestedName: t('roleSamples.bookCurator.suggestedName'),
      description: t('roleSamples.bookCurator.description'),
      content: t('roleSamples.bookCurator.content'),
      suggested_opening_statement: '안녕하세요! 도서 큐레이터입니다. 어떤 책을 찾고 계신가요?',
      suggested_questions: [
        'SF 소설 추천해주세요',
        '자기계발서 중에 좋은 책이 있을까요?',
        '역사 관련 논픽션을 읽고 싶어요',
      ],
    },
    {
      id: 'friendlyCompanion',
      mode: AgentType.CHAT,
      icon: t('roleSamples.friendlyCompanion.icon'),
      title: t('roleSamples.friendlyCompanion.title'),
      suggestedName: t('roleSamples.friendlyCompanion.suggestedName'),
      description: t('roleSamples.friendlyCompanion.description'),
      content: t('roleSamples.friendlyCompanion.content'),
      suggested_opening_statement: '안녕하세요! 편하게 이야기 나눠요. 오늘 하루 어떠셨나요?',
      suggested_questions: [
        '오늘 기분이 좀 우울해요',
        '재미있는 이야기 들려주세요',
        '고민이 있는데 들어주실 수 있나요?',
      ],
    },
    // Completion mode samples (작업형)
    {
      id: 'marketResearcher',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.marketResearcher.icon'),
      title: t('roleSamples.marketResearcher.title'),
      suggestedName: t('roleSamples.marketResearcher.suggestedName'),
      description: t('roleSamples.marketResearcher.description'),
      content: t('roleSamples.marketResearcher.content'),
      suggested_user_input_form: [
        { variable: 'product_name', label: '제품명', input_type: 'text-input' as const, required: true },
        { variable: 'market_scope', label: '시장 범위', input_type: 'select' as const, required: true, options: ['국내', '글로벌', '아시아', '북미', '유럽'] },
        { variable: 'analysis_period', label: '분석 기간', input_type: 'text-input' as const, required: false, default_value: '최근 1년' },
      ],
      suggested_output_format: {
        format_type: 'text' as const,
        text_format: 'markdown' as const,
      },
      suggested_tools: ['google.google_search', 'wikipedia.wikipedia_search'],
    },
    {
      id: 'tripPlanner',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.tripPlanner.icon'),
      title: t('roleSamples.tripPlanner.title'),
      suggestedName: t('roleSamples.tripPlanner.suggestedName'),
      description: t('roleSamples.tripPlanner.description'),
      content: t('roleSamples.tripPlanner.content'),
      suggested_user_input_form: [
        { variable: 'destination', label: '여행지', input_type: 'text-input' as const, required: true },
        { variable: 'duration', label: '여행 기간 (일)', input_type: 'number' as const, required: true },
        { variable: 'budget', label: '예산', input_type: 'select' as const, required: true, options: ['저예산', '중예산', '고예산'] },
        { variable: 'interests', label: '관심사', input_type: 'paragraph' as const, required: false, default_value: '문화, 맛집, 자연' },
      ],
      suggested_output_format: {
        format_type: 'text' as const,
        text_format: 'markdown' as const,
      },
      suggested_tools: ['google.google_search', 'wikipedia.wikipedia_search'],
    },
    {
      id: 'researchSummarizer',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.researchSummarizer.icon'),
      title: t('roleSamples.researchSummarizer.title'),
      suggestedName: t('roleSamples.researchSummarizer.suggestedName'),
      description: t('roleSamples.researchSummarizer.description'),
      content: t('roleSamples.researchSummarizer.content'),
      suggested_user_input_form: [
        { variable: 'topic', label: '리서치 주제', input_type: 'text-input' as const, required: true },
        { variable: 'focus_areas', label: '집중 분야', input_type: 'paragraph' as const, required: false, default_value: '역사, 현황, 전망' },
        { variable: 'detail_level', label: '상세도', input_type: 'select' as const, required: true, options: ['간략', '보통', '상세'] },
      ],
      suggested_output_format: {
        format_type: 'text' as const,
        text_format: 'markdown' as const,
      },
      suggested_tools: ['wikipedia.wikipedia_search', 'google.google_search'],
    },
    {
      id: 'contentCurator',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.contentCurator.icon'),
      title: t('roleSamples.contentCurator.title'),
      suggestedName: t('roleSamples.contentCurator.suggestedName'),
      description: t('roleSamples.contentCurator.description'),
      content: t('roleSamples.contentCurator.content'),
      suggested_user_input_form: [
        { variable: 'topic', label: '주제', input_type: 'text-input' as const, required: true },
        { variable: 'content_type', label: '콘텐츠 유형', input_type: 'select' as const, required: true, options: ['블로그', '뉴스', '동영상', '논문', '전체'] },
        { variable: 'count', label: '큐레이션 개수', input_type: 'number' as const, required: false, default_value: '10' },
      ],
      suggested_output_format: {
        format_type: 'text' as const,
        text_format: 'markdown' as const,
      },
      suggested_tools: ['google.google_search'],
    },
    // NOTE: The following samples are temporarily disabled
    // To re-enable, remove the /* */ block comments
    /*
    {
      id: 'dataAnalyst',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.dataAnalyst.icon'),
      title: t('roleSamples.dataAnalyst.title'),
      suggestedName: t('roleSamples.dataAnalyst.suggestedName'),
      description: t('roleSamples.dataAnalyst.description'),
      content: t('roleSamples.dataAnalyst.content'),
      suggested_user_input_form: [
        { variable: 'data_values', label: '데이터 값 (쉼표로 구분)', input_type: 'paragraph' as const, required: true },
        { variable: 'analysis_type', label: '분석 유형', input_type: 'select' as const, required: true, options: ['기본 통계', '비교 분석', '추세 분석'] },
      ],
      suggested_output_format: {
        format_type: 'text' as const,
        text_format: 'markdown' as const,
      },
      suggested_tools: ['maths.eval_expression'],
    },
    {
      id: 'competitorMonitor',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.competitorMonitor.icon'),
      title: t('roleSamples.competitorMonitor.title'),
      suggestedName: t('roleSamples.competitorMonitor.suggestedName'),
      description: t('roleSamples.competitorMonitor.description'),
      content: t('roleSamples.competitorMonitor.content'),
      suggested_user_input_form: [
        { variable: 'company_name', label: '경쟁사명', input_type: 'text-input' as const, required: true },
        { variable: 'monitoring_areas', label: '모니터링 영역', input_type: 'select' as const, required: true, options: ['제품', '마케팅', '뉴스', '전체'] },
        { variable: 'period', label: '모니터링 기간', input_type: 'select' as const, required: false, options: ['최근 1주일', '최근 1개월', '최근 3개월'], default_value: '최근 1개월' },
      ],
      suggested_output_format: {
        format_type: 'text' as const,
        text_format: 'markdown' as const,
      },
      suggested_tools: ['google.google_search'],
    },
    {
      id: 'infographicCreator',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.infographicCreator.icon'),
      title: t('roleSamples.infographicCreator.title'),
      suggestedName: t('roleSamples.infographicCreator.suggestedName'),
      description: t('roleSamples.infographicCreator.description'),
      content: t('roleSamples.infographicCreator.content'),
      suggested_user_input_form: [
        { variable: 'title', label: '인포그래픽 제목', input_type: 'text-input' as const, required: true },
        { variable: 'data_description', label: '데이터 설명', input_type: 'paragraph' as const, required: true },
        { variable: 'style', label: '디자인 스타일', input_type: 'select' as const, required: true, options: ['미니멀', '컬러풀', '비즈니스', '일러스트'] },
      ],
      suggested_output_format: {
        format_type: 'image' as const,
        image_format: 'png' as const,
      },
      suggested_tools: ['openai_tool.dalle3'],
    },
    {
      id: 'socialThumbnailCreator',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.socialThumbnailCreator.icon'),
      title: t('roleSamples.socialThumbnailCreator.title'),
      suggestedName: t('roleSamples.socialThumbnailCreator.suggestedName'),
      description: t('roleSamples.socialThumbnailCreator.description'),
      content: t('roleSamples.socialThumbnailCreator.content'),
      suggested_user_input_form: [
        { variable: 'title', label: '제목', input_type: 'text-input' as const, required: true },
        { variable: 'keywords', label: '키워드 (쉼표로 구분)', input_type: 'text-input' as const, required: true },
        { variable: 'platform', label: '플랫폼', input_type: 'select' as const, required: true, options: ['Facebook', 'Instagram', 'Twitter', 'YouTube', '블로그'] },
      ],
      suggested_output_format: {
        format_type: 'image' as const,
        image_format: 'png' as const,
      },
      suggested_tools: ['openai_tool.dalle3'],
    },
    {
      id: 'podcastCreator',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.podcastCreator.icon'),
      title: t('roleSamples.podcastCreator.title'),
      suggestedName: t('roleSamples.podcastCreator.suggestedName'),
      description: t('roleSamples.podcastCreator.description'),
      content: t('roleSamples.podcastCreator.content'),
      suggested_user_input_form: [
        { variable: 'topic', label: '팟캐스트 주제', input_type: 'text-input' as const, required: true },
        { variable: 'duration', label: '예상 길이 (분)', input_type: 'number' as const, required: true },
        { variable: 'tone', label: '톤', input_type: 'select' as const, required: true, options: ['전문적', '친근한', '유머러스'] },
      ],
      suggested_output_format: {
        format_type: 'audio' as const,
        audio_format: 'mp3' as const,
      },
      suggested_tools: ['audio.tts'],
    },
    {
      id: 'audioBookNarrator',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.audioBookNarrator.icon'),
      title: t('roleSamples.audioBookNarrator.title'),
      suggestedName: t('roleSamples.audioBookNarrator.suggestedName'),
      description: t('roleSamples.audioBookNarrator.description'),
      content: t('roleSamples.audioBookNarrator.content'),
      suggested_user_input_form: [
        { variable: 'text_content', label: '텍스트 내용', input_type: 'paragraph' as const, required: true },
        { variable: 'voice_style', label: '음성 스타일', input_type: 'select' as const, required: true, options: ['여성', '남성', '중성'] },
        { variable: 'speed', label: '속도', input_type: 'select' as const, required: false, options: ['느리게 (0.75x)', '보통 (1.0x)', '빠르게 (1.25x)'], default_value: '보통 (1.0x)' },
        { variable: 'tone', label: '톤', input_type: 'select' as const, required: false, options: ['전문적', '친근한', '차분한'], default_value: '차분한' },
      ],
      suggested_output_format: {
        format_type: 'audio' as const,
        audio_format: 'mp3' as const,
      },
      suggested_tools: ['audio.tts'],
    },
    {
      id: 'dataReportGenerator',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.dataReportGenerator.icon'),
      title: t('roleSamples.dataReportGenerator.title'),
      suggestedName: t('roleSamples.dataReportGenerator.suggestedName'),
      description: t('roleSamples.dataReportGenerator.description'),
      content: t('roleSamples.dataReportGenerator.content'),
      suggested_user_input_form: [
        { variable: 'report_title', label: '리포트 제목', input_type: 'text-input' as const, required: true },
        { variable: 'data_source', label: '데이터 (CSV 형식)', input_type: 'paragraph' as const, required: true },
        { variable: 'analysis_focus', label: '분석 초점', input_type: 'paragraph' as const, required: false, default_value: '전체 트렌드 및 주요 인사이트' },
      ],
      suggested_output_format: {
        format_type: 'file' as const,
        file_format: 'pdf' as const,
      },
      suggested_tools: ['maths.eval_expression'],
    },
    {
      id: 'travelGuideBookCreator',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.travelGuideBookCreator.icon'),
      title: t('roleSamples.travelGuideBookCreator.title'),
      suggestedName: t('roleSamples.travelGuideBookCreator.suggestedName'),
      description: t('roleSamples.travelGuideBookCreator.description'),
      content: t('roleSamples.travelGuideBookCreator.content'),
      suggested_user_input_form: [
        { variable: 'destination', label: '목적지', input_type: 'text-input' as const, required: true },
        { variable: 'trip_duration', label: '여행 기간 (일)', input_type: 'number' as const, required: true },
        { variable: 'travel_style', label: '여행 스타일', input_type: 'select' as const, required: true, options: ['배낭여행', '가족여행', '럭셔리', '문화탐방'] },
      ],
      suggested_output_format: {
        format_type: 'file' as const,
        file_format: 'pdf' as const,
      },
      suggested_tools: ['google.google_search', 'openai_tool.dalle3', 'wikipedia.wikipedia_search'],
    },
    */
  ]

  /**
   * Filter samples based on currently selected mode
   */
  const roleSamples = allRoleSamples.filter((sample) => sample.mode === currentMode)

  /**
   * Handle sample selection (Auto mode)
   * Auto-fills name, description, role, icon, and suggested prompt settings
   */
  const handleSampleSelect = (sampleId: string): void => {
    const sample = allRoleSamples.find((s) => s.id === sampleId)
    if (sample) {
      setValue('name', sample.suggestedName, { shouldValidate: true })
      setValue('description', sample.description, { shouldValidate: true })
      setValue('role', sample.content, { shouldValidate: true })
      setValue('icon', sample.icon, { shouldValidate: true })
      // Track selected sample
      setSelectedSampleId(sampleId)

      // Save suggested prompt settings to context
      const suggestedPromptSettings: Partial<AgentPromptSettings> = {
        pre_prompt: sample.content,
        prompt_type: 'simple',
      }

      // Chat mode suggestions
      if ('suggested_opening_statement' in sample) {
        suggestedPromptSettings.opening_statement = sample.suggested_opening_statement
      }
      if ('suggested_questions' in sample && sample.suggested_questions) {
        suggestedPromptSettings.suggested_questions = sample.suggested_questions
      }

      // Completion mode suggestions
      if ('suggested_user_input_form' in sample && sample.suggested_user_input_form) {
        suggestedPromptSettings.user_input_form = sample.suggested_user_input_form
      }
      if ('suggested_output_format' in sample && sample.suggested_output_format) {
        suggestedPromptSettings.output_format = sample.suggested_output_format
      }

      setPromptSettings(suggestedPromptSettings as AgentPromptSettings)

      // Save suggested tools for Step 4 auto-selection
      if ('suggested_tools' in sample && sample.suggested_tools) {
        setSuggestedTools(sample.suggested_tools)
      }
      else {
        setSuggestedTools([])
      }

      // Stay in auto mode to allow selecting different samples
    }
  }

  /**
   * Handle role sample selection (Manual mode dropdown)
   * Auto-fills name, description, role, icon, and suggested prompt settings
   */
  const handleRoleSampleSelect = (sampleId: string): void => {
    const sample = allRoleSamples.find((s) => s.id === sampleId)
    if (sample) {
      setValue('name', sample.suggestedName, { shouldValidate: true })
      setValue('description', sample.description, { shouldValidate: true })
      setValue('role', sample.content, { shouldValidate: true })
      setValue('icon', sample.icon, { shouldValidate: true })

      // Save suggested prompt settings to context
      const suggestedPromptSettings: Partial<AgentPromptSettings> = {
        pre_prompt: sample.content,
        prompt_type: 'simple',
      }

      // Chat mode suggestions
      if ('suggested_opening_statement' in sample) {
        suggestedPromptSettings.opening_statement = sample.suggested_opening_statement
      }
      if ('suggested_questions' in sample && sample.suggested_questions) {
        suggestedPromptSettings.suggested_questions = sample.suggested_questions
      }

      // Completion mode suggestions
      if ('suggested_user_input_form' in sample && sample.suggested_user_input_form) {
        suggestedPromptSettings.user_input_form = sample.suggested_user_input_form
      }
      if ('suggested_output_format' in sample && sample.suggested_output_format) {
        suggestedPromptSettings.output_format = sample.suggested_output_format
      }

      setPromptSettings(suggestedPromptSettings as AgentPromptSettings)

      // Save suggested tools for Step 4 auto-selection
      if ('suggested_tools' in sample && sample.suggested_tools) {
        setSuggestedTools(sample.suggested_tools)
      }
      else {
        setSuggestedTools([])
      }
    }
  }

  /**
   * Form submission handler
   */
  const onSubmit = async (data: BasicSettingsFormData): Promise<void> => {
    // Save to context (include suggested_tools for Step 4 auto-selection)
    const settingsWithTools = {
      ...data,
      suggested_tools: suggestedTools.length > 0 ? suggestedTools : undefined,
    }
    setBasicSettings(settingsWithTools)

    // Auto-save is handled by context's useEffect
    // Move to next step
    nextStep()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Configuration Mode Selection - Hide in edit mode */}
      {!isEditMode && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">{t('configMode.title')}</h3>
          <RadioGroup
            name="config-mode"
            options={configModeOptions}
            value={configMode}
            onChange={(value) => setConfigMode(value as ConfigMode)}
          />
        </div>
      )}

      {/* Auto Mode: Sample Selection Cards - Hide in edit mode */}
      {!isEditMode && configMode === ConfigMode.AUTO && (
        <div className="space-y-4">
          {/* Agent Type Selection (for filtering samples) */}
          <Controller
            name="mode"
            control={control}
            render={({ field }) => (
              <RadioGroup
                name="agent-type"
                label={t('basicSettings.typeLabel')}
                options={agentTypeOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.mode ? t(errors.mode.message as string) : undefined}
                required
              />
            )}
          />

          {/* Sample Cards Grid */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">{t('configMode.selectSample')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roleSamples.map((sample) => {
                const isSelected = selectedSampleId === sample.id
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSampleSelect(sample.id)}
                    className={`relative text-left p-4 border-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    {/* Checkbox indicator */}
                    <div className="absolute top-2 right-2">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-white border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 pr-6">
                      <span className="text-3xl">{sample.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-semibold text-gray-900 text-sm mb-1">{sample.title}</h5>
                        <p className="text-xs text-gray-600 line-clamp-2">{sample.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Manual Mode: Full Form */}
      {(isEditMode || configMode === ConfigMode.MANUAL) && (
        <>
          {/* Agent Type Selection - Hide in edit mode */}
          {!isEditMode && (
            <Controller
              name="mode"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  name="agent-type"
                  label={t('basicSettings.typeLabel')}
                  options={agentTypeOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.mode ? t(errors.mode.message as string) : undefined}
                  required
                />
              )}
            />
          )}

          {/* Sample Dropdown - Hide in edit mode */}
          {!isEditMode && (
            <div>
              <label htmlFor="sample-select" className="block text-sm font-medium text-gray-900 mb-2">
                {t('configMode.selectSample')}
              </label>
              <select
                id="sample-select"
                onChange={(e) => handleRoleSampleSelect(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue=""
              >
                <option value="">{t('basicSettings.roleSamplePlaceholder')}</option>
                {roleSamples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.icon} {sample.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Agent Name */}
          <Input
            {...register('name')}
            id="agent-name"
            label={t('basicSettings.nameLabel')}
            placeholder={t('basicSettings.namePlaceholder')}
            error={errors.name ? t(errors.name.message as string) : undefined}
            required
            maxLength={255}
          />

          {/* Agent Description (Optional) */}
          <Textarea
            {...register('description')}
            id="agent-description"
            label={t('basicSettings.descriptionLabel')}
            placeholder={t('basicSettings.descriptionPlaceholder')}
            error={errors.description ? t(errors.description.message as string) : undefined}
            maxLength={400}
            rows={3}
            showCharCount
            value={descriptionValue}
          />
        </>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end pt-4 border-t">
        <Button
          type="submit"
          variant="default"
          disabled={isEditMode ? (Object.keys(errors).length > 0 || isSubmitting) : (!isValid || isSubmitting)}
        >
          {isSubmitting ? '저장 중...' : t('buttons.next')}
        </Button>
      </div>
    </form>
  )
}
