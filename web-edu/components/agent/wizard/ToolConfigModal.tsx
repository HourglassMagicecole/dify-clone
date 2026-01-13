'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Tooltip } from '@/components/common/Tooltip'
import {
  createUserToolConfig,
  deleteUserToolConfig,
  listUserToolConfigs,
  testTool,
  updateUserToolConfig,
  type ToolTestResult,
  type UserToolConfig,
} from '@/service/tool-api'
import { modelAPI } from '@/service/model-api'
import { useSession } from '@/context/SessionContext'
import type { Tool, ToolParameter } from '@/types/tool'
import type { ModelStatusValue } from '@/types/model'

// TTS/STT Model status info
interface ModelStatusInfo {
  model: string
  label: string
  status: ModelStatusValue
}

// Dynamically import ReactECharts to avoid SSR issues
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface ToolConfigModalProps {
  tool: Tool | null
  onClose: () => void
  onApiKeySaved?: () => void  // API Key 저장 후 도구 목록 새로고침 콜백
}

export default function ToolConfigModal({
  tool,
  onClose,
  onApiKeySaved,
}: ToolConfigModalProps) {
  const { t, i18n } = useTranslation('agent')
  // Convert i18n language code (ko-KR) to API format (ko_KR)
  const currentLang = (i18n.language.replace('-', '_') || 'en_US') as 'en_US' | 'ko_KR'
  const { currentSession } = useSession()
  const [testParams, setTestParams] = useState<Record<string, string | number | boolean | string[]>>({})
  const [testResult, setTestResult] = useState<ToolTestResult | null>(null)
  const [testing, setTesting] = useState(false)

  // TTS specific states
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // STT specific states
  const [isRecording, setIsRecording] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // MediaRecorder refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)

  // API Key management states (for TOOL_PROVIDER type)
  const [userApiKey, setUserApiKey] = useState<string>('')
  const [userConfig, setUserConfig] = useState<UserToolConfig | null>(null)
  const [savingApiKey, setSavingApiKey] = useState(false)
  const [apiKeyMessage, setApiKeyMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // TTS/STT model status states
  const [ttsModels, setTtsModels] = useState<ModelStatusInfo[]>([])
  const [sttModels, setSttModels] = useState<ModelStatusInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  // Initialize test parameters with default values when tool changes
  useEffect(() => {
    if (!tool || !tool.parameters)
      return

    // Set default values for all parameters
    const defaultParams: Record<string, string | number | boolean> = {}
    tool.parameters.forEach((param) => {
      if (param.default !== undefined && param.default !== null) {
        defaultParams[param.name] = param.default
      }
    })
    setTestParams(defaultParams)

    // Reset test results when switching tools
    setTestResult(null)
    setAudioUrl(null)
  }, [tool])

  // Load TTS/STT model status when tool is tts or asr
  useEffect(() => {
    const loadModelStatus = async () => {
      if (!tool || (tool.name !== 'tts' && tool.name !== 'asr'))
        return

      setModelsLoading(true)
      try {
        // Get OpenAI provider models
        const response = await modelAPI.getProviderModels('openai')
        if (response.result === 'success' && response.data) {
          // Filter TTS models
          const tts = response.data
            .filter(m => m.model_type === 'tts')
            .map(m => ({
              model: `openai#${m.model}`,
              label: m.label.en_US,
              status: m.status as ModelStatusValue,
            }))
          setTtsModels(tts)

          // Filter STT models (speech2text)
          const stt = response.data
            .filter(m => m.model_type === 'speech2text')
            .map(m => ({
              model: `openai#${m.model}`,
              label: m.label.en_US,
              status: m.status as ModelStatusValue,
            }))
          setSttModels(stt)
        }
      }
      catch (error) {
        console.error('Failed to load model status:', error)
      }
      finally {
        setModelsLoading(false)
      }
    }

    loadModelStatus()
  }, [tool])

  // Load user API key configuration on tool change
  useEffect(() => {
    const loadUserConfig = async () => {
      if (!tool || !tool.provider || tool.api_key_type !== 'tool_provider')
        return

      try {
        const response = await listUserToolConfigs(tool.provider)
        if (response.result === 'success' && response.data && response.data.length > 0) {
          setUserConfig(response.data[0] || null)
        }
        else {
          // Reset userConfig when no config exists for this provider
          setUserConfig(null)
        }
      }
      catch (error) {
        console.error('Failed to load user config:', error)
        // Also reset on error
        setUserConfig(null)
      }
    }

    loadUserConfig()
    // Reset states when tool changes
    setUserApiKey('')
    setApiKeyMessage(null)
    setAudioFile(null)
  }, [tool])

  if (!tool)
    return null

  const handleTest = async (overrideParams?: Record<string, string>) => {
    setTesting(true)
    setTestResult(null)
    setAudioUrl(null) // Reset audio URL for TTS
    try {
      // Use tool's provider if available, otherwise default to 'edu_tools'
      const provider = tool.provider || 'edu_tools'
      // Merge testParams with overrideParams (overrideParams takes precedence)
      const finalParams = { ...testParams, ...overrideParams }
      const response = await testTool(provider, tool.name, finalParams, currentSession?.id)

      if (response.result === 'success' && response.data) {
        setTestResult(response.data)

        // Handle TTS audio result
        if (tool.name === 'tts' && response.data.results) {
          const results = response.data.results as Array<{
            type: string
            url?: string
            blob?: Blob
            blob_base64?: string
            mime_type?: string
          }>
          const blobResult = results.find(r => r.type === 'blob')
          if (blobResult) {
            // If base64 encoded blob, decode and create object URL
            if (blobResult.blob_base64) {
              // Decode base64 to binary
              const binaryString = atob(blobResult.blob_base64)
              const bytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              const blob = new Blob([bytes], { type: blobResult.mime_type || 'audio/wav' })
              setAudioUrl(URL.createObjectURL(blob))
            }
            // If it's a link, use it directly
            else if (blobResult.url) {
              setAudioUrl(blobResult.url)
            }
            // If it's binary data, create object URL
            else if (blobResult.blob) {
              const blob = new Blob([blobResult.blob], { type: blobResult.mime_type || 'audio/wav' })
              setAudioUrl(URL.createObjectURL(blob))
            }
          }
        }
      }
      else {
        setTestResult({
          success: false,
          error: response.message || 'Test failed',
          results: [],
        })
      }
    }
    catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results: [],
      })
    }
    finally {
      setTesting(false)
    }
  }

  const handleParamChange = (paramName: string, value: string | number | boolean | string[]) => {
    setTestParams(prev => ({
      ...prev,
      [paramName]: value,
    }))
  }

  // Helper: Create WAV blob from AudioBuffer
  const audioBufferToWav = (audioBuffer: AudioBuffer): Blob => {
    const numChannels = 1 // mono
    const sampleRate = audioBuffer.sampleRate
    const format = 1 // PCM
    const bitDepth = 16

    // Get audio data (use first channel for mono)
    const audioData = audioBuffer.getChannelData(0)
    const dataLength = audioData.length * (bitDepth / 8)
    const buffer = new ArrayBuffer(44 + dataLength)
    const view = new DataView(buffer)

    // Write WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + dataLength, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // PCM chunk size
    view.setUint16(20, format, true) // PCM format
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true) // byte rate
    view.setUint16(32, numChannels * (bitDepth / 8), true) // block align
    view.setUint16(34, bitDepth, true)
    writeString(36, 'data')
    view.setUint32(40, dataLength, true)

    // Write audio data (Float32 to Int16)
    let offset = 44
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i] ?? 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }

  // STT: Start recording using MediaRecorder
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      // Use webm format (most reliable in browsers)
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ]

      let selectedMimeType = ''
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          break
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType || undefined,
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
    }
    catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Failed to access microphone. Please check permissions.')
    }
  }

  // STT: Stop recording and convert to WAV
  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return

    // Create a promise that resolves when recording stops
    const recordingPromise = new Promise<Blob>((resolve) => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = () => {
          const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          resolve(audioBlob)
        }
      }
    })

    mediaRecorderRef.current.stop()
    setIsRecording(false)

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    try {
      const audioBlob = await recordingPromise

      // Convert webm to WAV using AudioContext.decodeAudioData()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioContext = new AudioContext()

      try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        const wavBlob = audioBufferToWav(audioBuffer)
        const file = new File([wavBlob], 'recording.wav', { type: 'audio/wav' })
        setAudioFile(file)
      }
      catch (decodeError) {
        console.error('Failed to decode audio, using original format:', decodeError)
        // Fallback: use original webm if decoding fails
        const ext = audioBlob.type.includes('webm') ? 'webm' : 'audio'
        const file = new File([audioBlob], `recording.${ext}`, { type: audioBlob.type })
        setAudioFile(file)
      }
      finally {
        await audioContext.close()
      }
    }
    catch (error) {
      console.error('Error processing audio:', error)
    }
  }

  // STT: Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setAudioFile(file)
    }
  }

  // STT: Test with audio file
  const handleSTTTest = async () => {
    if (!audioFile) {
      alert('Please record or upload an audio file first')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      // Convert file to base64 and send as parameter
      const reader = new FileReader()
      reader.onload = async () => {
        const base64Audio = reader.result as string
        // Test always uses whisper-1 for compatibility with browser-recorded audio
        const model = 'openai#whisper-1'

        const provider = tool.provider || 'edu_tools'
        const response = await testTool(provider, tool.name, {
          audio_file: base64Audio,
          model,
        }, currentSession?.id)

        if (response.result === 'success' && response.data) {
          setTestResult(response.data)
        }
        else {
          setTestResult({
            success: false,
            error: response.message || 'Test failed',
            results: [],
          })
        }
        setTesting(false)
      }
      reader.onerror = () => {
        setTestResult({
          success: false,
          error: 'Failed to read audio file',
          results: [],
        })
        setTesting(false)
      }
      reader.readAsDataURL(audioFile)
    }
    catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results: [],
      })
      setTesting(false)
    }
  }

  // API Key: Save or update user API key
  const handleSaveApiKey = async () => {
    if (!tool.provider || !userApiKey.trim()) {
      setApiKeyMessage({ type: 'error', text: t('tools.pleaseEnterApiKey') })
      return
    }

    setSavingApiKey(true)
    setApiKeyMessage(null)

    try {
      if (userConfig) {
        // Update existing config
        const response = await updateUserToolConfig(userConfig.id, {
          api_key: userApiKey,
        })
        if (response.result === 'success' && response.data) {
          setUserConfig(response.data)
          setApiKeyMessage({ type: 'success', text: t('tools.apiKeyUpdatedSuccess') })
          setUserApiKey('') // Clear input after save
          // Notify parent to refresh tool list
          onApiKeySaved?.()
        }
        else {
          setApiKeyMessage({ type: 'error', text: response.message || t('tools.failedToUpdateApiKey') })
        }
      }
      else {
        // Create new config
        const response = await createUserToolConfig({
          provider: tool.provider,
          api_key: userApiKey,
        })
        if (response.result === 'success' && response.data) {
          setUserConfig(response.data)
          setApiKeyMessage({ type: 'success', text: t('tools.apiKeySavedSuccess') })
          setUserApiKey('') // Clear input after save
          // Notify parent to refresh tool list
          onApiKeySaved?.()
        }
        else {
          setApiKeyMessage({ type: 'error', text: response.message || t('tools.failedToSaveApiKey') })
        }
      }
    }
    catch (error) {
      setApiKeyMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('tools.failedToSaveApiKey'),
      })
    }
    finally {
      setSavingApiKey(false)
    }
  }

  // API Key: Delete user API key
  const handleDeleteApiKey = async () => {
    if (!userConfig) return

    if (!confirm(t('tools.deleteApiKeyConfirm'))) return

    setSavingApiKey(true)
    setApiKeyMessage(null)

    try {
      const response = await deleteUserToolConfig(userConfig.id)
      if (response.result === 'success') {
        setUserConfig(null)
        setApiKeyMessage({ type: 'success', text: t('tools.apiKeyDeletedSuccess') })
        // Notify parent to refresh tool list
        onApiKeySaved?.()
      }
      else {
        setApiKeyMessage({ type: 'error', text: response.message || t('tools.failedToDeleteApiKey') })
      }
    }
    catch (error) {
      setApiKeyMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('tools.failedToDeleteApiKey'),
      })
    }
    finally {
      setSavingApiKey(false)
    }
  }

  // Helper: Get model status info
  const getModelStatus = (modelId: string, modelList: ModelStatusInfo[]): ModelStatusInfo | undefined => {
    return modelList.find(m => m.model === modelId)
  }

  // Render TTS-specific UI
  const renderTTSUI = () => {
    const selectedModel = String(testParams.model || 'openai#tts-1')
    const selectedModelStatus = getModelStatus(selectedModel, ttsModels)
    const isSelectedModelActive = selectedModelStatus?.status === 'active'

    // Fallback models if API hasn't loaded yet
    const displayModels = ttsModels.length > 0 ? ttsModels : [
      { model: 'openai#tts-1', label: 'TTS-1', status: 'active' as ModelStatusValue },
      { model: 'openai#tts-1-hd', label: 'TTS-1-HD', status: 'active' as ModelStatusValue },
    ]

    return (
      <div className="space-y-4">
        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('tools.ttsModel')} <span className="text-red-500">*</span>
          </label>
          {modelsLoading ? (
            <div className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-500">
              {t('common:loading')}...
            </div>
          ) : (
            <select
              value={selectedModel}
              onChange={e => handleParamChange('model', e.target.value)}
              className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !isSelectedModelActive && ttsModels.length > 0
                  ? 'border-orange-300 bg-orange-50'
                  : 'border-gray-300'
              }`}
            >
              {displayModels.map(m => (
                <option key={m.model} value={m.model}>
                  {m.label} {m.status !== 'active' ? `⚠️ (${t('tools.modelDisabled')})` : ''}
                </option>
              ))}
            </select>
          )}
          {/* Warning for disabled model */}
          {!isSelectedModelActive && ttsModels.length > 0 && (
            <p className="mt-1 text-sm text-orange-600 flex items-center gap-1">
              <span>⚠️</span>
              {t('tools.selectedModelDisabledWarning')}
            </p>
          )}
        </div>

      {/* Text Input */}
      <div>
        <label className="block text-sm font-medium mb-1">
          {t('tools.textToConvert')} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={String(testParams.text || '')}
          onChange={e => handleParamChange('text', e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('tools.enterTextPlaceholder')}
          rows={4}
        />
      </div>

      {/* Generate Button */}
      <Button
        onClick={() => {
          // Ensure model parameter is set before calling handleTest
          const model = String(testParams.model || 'openai#tts-1')
          handleTest({ ...testParams, model })
        }}
        disabled={testing || !testParams.text}
        variant="default"
      >
        {testing ? t('tools.generating') : t('tools.generateAudio')}
      </Button>

      {/* Audio Player */}
      {audioUrl && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <h4 className="font-semibold mb-2">{t('tools.generatedAudio')}</h4>
          <audio controls src={audioUrl} className="w-full">
            {t('tools.browserNoAudioSupport')}
          </audio>
          <a
            href={audioUrl}
            download={`tts_${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.wav`}
            className="mt-2 inline-block text-blue-600 hover:underline text-sm"
          >
            {t('tools.downloadAudio')}
          </a>
        </div>
      )}
      </div>
    )
  }

  // Render STT-specific UI
  const renderSTTUI = () => {
    // Test always uses whisper-1 for compatibility with browser-recorded audio
    const testModel = 'openai#whisper-1'
    const whisperStatus = getModelStatus(testModel, sttModels)
    const isWhisperActive = whisperStatus?.status === 'active'

    return (
      <div className="space-y-4">
        {/* Model Info - Test uses whisper-1 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('tools.sttModel')}
          </label>
          <div className={`w-full border rounded px-3 py-2 bg-gray-50 ${
            !isWhisperActive && sttModels.length > 0
              ? 'border-orange-300 bg-orange-50'
              : 'border-gray-300'
          }`}>
            <span className="text-gray-700">whisper-1</span>
            <span className="text-gray-500 text-sm ml-2">({t('tools.testUsesWhisper')})</span>
          </div>
          {/* Warning if whisper-1 is disabled */}
          {!isWhisperActive && sttModels.length > 0 && (
            <p className="mt-1 text-sm text-orange-600 flex items-center gap-1">
              <span>⚠️</span>
              {t('tools.whisperDisabledWarning')}
            </p>
          )}
        </div>

      {/* Recording Controls */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">{t('tools.recordAudio')}</label>
        <div className="flex gap-2">
          {!isRecording ? (
            <Button type="button" onClick={startRecording} variant="default">
              🎤 {t('tools.startRecording')}
            </Button>
          ) : (
            <Button type="button" onClick={stopRecording} variant="default">
              ⏹️ {t('tools.stopRecording')}
            </Button>
          )}
        </div>
        {isRecording && (
          <p className="text-sm text-red-600">{t('tools.recordingInProgress')}</p>
        )}
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">{t('tools.orUploadAudioFile')}</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>

      {/* Selected File Info */}
      {audioFile && (
        <div className="p-2 bg-gray-100 rounded text-sm space-y-1">
          <div>
            {t('tools.selected')} {audioFile.name} ({(audioFile.size / 1024).toFixed(2)} KB)
          </div>
          <a
            href={URL.createObjectURL(audioFile)}
            download={audioFile.name}
            className="text-blue-600 hover:underline text-xs"
          >
            📥 Download file for debugging
          </a>
        </div>
      )}

      {/* Convert Button */}
      <Button
        onClick={handleSTTTest}
        disabled={testing || !audioFile}
        variant="default"
      >
          {testing ? t('tools.converting') : t('tools.convertToText')}
        </Button>
      </div>
    )
  }

  // Render API Key configuration UI (for TOOL_PROVIDER type only)
  const renderApiKeyUI = () => {
    if (tool.api_key_type !== 'tool_provider')
      return null

    return (
      <div className="space-y-4 pb-4 border-b border-gray-200">
        <h3 className="font-semibold text-lg">{t('tools.apiKeyConfiguration')}</h3>

        {/* Current API Key Status */}
        {userConfig ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">{t('tools.apiKeyConfigured')}</p>
                <p className="text-xs text-green-600 mt-1">
                  {t('tools.apiKeyConfiguredDesc')}: {userConfig.api_key_masked}
                </p>
              </div>
              <Button
                onClick={handleDeleteApiKey}
                disabled={savingApiKey}
                variant="default"
                className="text-sm text-red-600 hover:text-red-700"
              >
                {t('tools.deleteApiKey')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              {t('tools.noApiKeyConfigured')}
            </p>
          </div>
        )}

        {/* API Key Input */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {userConfig ? t('tools.updateApiKey') : t('tools.enterApiKey')}
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="password"
            value={userApiKey}
            onChange={e => setUserApiKey(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('tools.apiKeyPlaceholder')}
            autoComplete="off"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('tools.apiKeySecureNote')}
          </p>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSaveApiKey}
          disabled={savingApiKey || !userApiKey.trim()}
          variant="default"
        >
          {savingApiKey ? t('tools.savingApiKey') : userConfig ? t('tools.updateApiKey') : t('tools.saveApiKey')}
        </Button>

        {/* Success/Error Message */}
        {apiKeyMessage && (
          <div className={`p-3 rounded ${
            apiKeyMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <p className="text-sm">{apiKeyMessage.text}</p>
          </div>
        )}
      </div>
    )
  }

  // Handle image file upload and convert to base64 (for file/files type parameters)
  const handleImageFileUpload = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve(reader.result as string)
      }
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      reader.readAsDataURL(file)
    })
  }

  // Handle multiple image files upload
  const handleMultipleImageFilesUpload = async (paramName: string, files: FileList) => {
    try {
      const base64Files = await Promise.all(
        Array.from(files).map(file => handleImageFileUpload(file)),
      )
      handleParamChange(paramName, base64Files)
    }
    catch (error) {
      console.error('Failed to upload files:', error)
    }
  }

  // Render parameter input based on type
  const renderParameterInput = (param: ToolParameter) => {
    const value = testParams[param.name] ?? param.default ?? ''

    // File type (single file upload)
    if (param.type === 'file') {
      return (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*,.pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.md"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) {
                try {
                  const base64 = await handleImageFileUpload(file)
                  handleParamChange(param.name, base64)
                }
                catch (error) {
                  console.error('Failed to upload file:', error)
                }
              }
            }}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {value && (
            <p className="text-xs text-gray-500">
              File uploaded ✓
            </p>
          )}
        </div>
      )
    }

    // Files type (multiple file upload)
    if (param.type === 'files') {
      const files = Array.isArray(value) ? value : (value ? [value] : [])
      return (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*,.pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.md"
            multiple
            onChange={(e) => {
              if (e.target.files) {
                handleMultipleImageFilesUpload(param.name, e.target.files)
              }
            }}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {files.length > 0 && (
            <p className="text-xs text-gray-500">
              {files.length} file(s) uploaded ✓
            </p>
          )}
        </div>
      )
    }

    // Select type (dropdown)
    if (param.type === 'select' && param.options) {
      return (
        <select
          value={String(value)}
          onChange={e => handleParamChange(param.name, e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {param.options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label[currentLang] || option.label.en_US}
            </option>
          ))}
        </select>
      )
    }

    // Number type
    if (param.type === 'number') {
      const numValue = typeof value === 'number' || typeof value === 'string' ? value : ''
      return (
        <input
          type="number"
          value={numValue === '' || numValue === undefined ? '' : numValue}
          onChange={(e) => {
            const val = e.target.value
            handleParamChange(param.name, val === '' ? '' : Number(val))
          }}
          min={param.min}
          max={param.max}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={param.description[currentLang] || param.description.en_US}
          autoComplete="off"
        />
      )
    }

    // Boolean type (checkbox)
    if (param.type === 'boolean') {
      return (
        <input
          type="checkbox"
          checked={value === true || value === 'true'}
          onChange={e => handleParamChange(param.name, e.target.checked)}
          className="w-5 h-5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )
    }

    // String type (default)
    // Use textarea for multi-line text inputs (e.g., md_text, content, message, input_data)
    const isMultiLineText = param.name.toLowerCase().includes('text')
      || param.name.toLowerCase().includes('content')
      || param.name.toLowerCase().includes('message')
      || param.name.toLowerCase().includes('md_')
      || param.name.toLowerCase().includes('data')

    if (isMultiLineText) {
      return (
        <textarea
          value={String(value)}
          onChange={e => handleParamChange(param.name, e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={param.description[currentLang] || param.description.en_US}
          rows={6}
        />
      )
    }

    return (
      <input
        type="text"
        value={String(value)}
        onChange={e => handleParamChange(param.name, e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={param.description[currentLang] || param.description.en_US}
        autoComplete="off"
      />
    )
  }

  // Get display value for a parameter (for read-only display)
  const getParamDisplayValue = (param: ToolParameter): string => {
    const value = testParams[param.name] ?? param.default
    if (value === undefined || value === null) return '-'

    // For boolean type, show yes/no
    if (param.type === 'boolean') {
      return value ? t('common:yes') : t('common:no')
    }

    // For select type, find the label
    if (param.type === 'select' && param.options) {
      const option = param.options.find(opt => opt.value === value)
      if (option) {
        return option.label[currentLang] || option.label.en_US
      }
    }

    return String(value)
  }

  // Render default parameter UI
  const renderDefaultUI = () => {
    if (!tool?.parameters) return null

    // Separate form params (read-only) and llm params (editable for test)
    const formParams = tool.parameters.filter(p => p.form === 'form')
    const llmParams = tool.parameters.filter(p => p.form === 'llm')

    return (
      <div className="space-y-4">
        {/* Default Settings (read-only) */}
        {formParams.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
              {t('tools.defaultSettings')}
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
              {formParams.map(param => (
                <div key={param.name} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {param.label[currentLang] || param.label.en_US}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {getParamDisplayValue(param)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Parameters (editable) */}
        {llmParams.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
              {t('tools.testParameters')}
            </h3>
            {llmParams.map(param => (
              <div key={param.name}>
                <label className="flex items-center gap-1 text-sm font-medium mb-1">
                  <span>
                    {param.label[currentLang] || param.label.en_US}
                    {param.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  <Tooltip content={param.description[currentLang] || param.description.en_US} />
                </label>
                {renderParameterInput(param)}
              </div>
            ))}
          </div>
        )}

        {/* No parameters message */}
        {formParams.length === 0 && llmParams.length === 0 && (
          <p className="text-sm text-gray-500">{t('tools.noParamsRequired')}</p>
        )}

        {/* Test Button */}
        <Button
          onClick={() => handleTest()}
          disabled={testing}
          variant="default"
        >
          {testing ? t('common:testing') : t('tools.test')}
        </Button>
      </div>
    )
  }

  return (
    <Modal
      isOpen={!!tool}
      onClose={onClose}
      title={`${t('tools.configure')} - ${tool.label[currentLang] || tool.label.en_US}`}
    >
      <div className="space-y-4">
        {/* Tool Description */}
        <p className="text-gray-600">
          {tool.description.human[currentLang] || tool.description.human.en_US}
        </p>

        {/* API Key Configuration (for TOOL_PROVIDER type only) */}
        {renderApiKeyUI()}

        {/* Render appropriate UI based on tool type */}
        {tool.name === 'tts' ? renderTTSUI() : tool.name === 'asr' ? renderSTTUI() : renderDefaultUI()}

        {/* Test Result (for all tool types) */}
        {testResult && (
          <div className={`p-4 rounded ${
            testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <h4 className="font-semibold mb-2">
              {testResult.success ? t('tools.testSuccess') : t('tools.testFailed')}
            </h4>

            {/* Error Message */}
            {testResult.error && (
              <div className="text-red-800 text-sm mb-3">
                {testResult.error}
              </div>
            )}

            {/* Render results based on type */}
            {testResult.success && testResult.results && testResult.results.length > 0 ? (
              <div className="space-y-3">
                {testResult.results.map((result, index) => {
                  // Blob type: images, documents, audio files
                  // Skip blob display for TTS since audio player is shown above
                  if (result.type === 'blob' && result.blob_base64) {
                    const mimeType = result.mime_type || 'application/octet-stream'
                    const isAudio = mimeType.startsWith('audio/')

                    // Skip audio blob for TTS tool (already shown in audio player)
                    if (tool.name === 'tts' && isAudio) {
                      return null
                    }

                    const dataUrl = `data:${mimeType};base64,${result.blob_base64}`
                    const isImage = mimeType.startsWith('image/')
                    const filename = result.filename || (() => {
                      // Map MIME types to proper extensions
                      const extMap: Record<string, string> = {
                        'x-wav': 'wav',
                        'wav': 'wav',
                        'mpeg': 'mp3',
                        'mp3': 'mp3',
                        'ogg': 'ogg',
                        'webm': 'webm',
                        'mp4': 'mp4',
                        'png': 'png',
                        'jpeg': 'jpg',
                        'gif': 'gif',
                        'webp': 'webp',
                        'pdf': 'pdf',
                      }
                      const rawExt = mimeType.split('/')[1]?.split(';')[0] || 'bin'
                      const ext = extMap[rawExt] || rawExt
                      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
                      const toolName = tool.name.replace(/[^a-zA-Z0-9]/g, '_')
                      return `${toolName}_${timestamp}.${ext}`
                    })()

                    return (
                      <div key={index} className="bg-white p-3 rounded border">
                        {isImage ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={dataUrl}
                              alt={`Generated image ${index + 1}`}
                              className="w-full rounded shadow-sm mb-2"
                            />
                            <a
                              href={dataUrl}
                              download={filename}
                              className="inline-block text-blue-600 hover:underline text-sm"
                            >
                              Download {filename}
                            </a>
                          </>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{filename}</p>
                              <p className="text-xs text-gray-500">
                                {(() => {
                                  if (mimeType.includes('wordprocessingml')) return 'Word Document'
                                  if (mimeType.includes('spreadsheetml')) return 'Excel Spreadsheet'
                                  if (mimeType.includes('presentationml')) return 'PowerPoint Presentation'
                                  if (mimeType.includes('pdf')) return 'PDF Document'
                                  if (mimeType.includes('audio')) return 'Audio File'
                                  if (mimeType.includes('video')) return 'Video File'
                                  if (mimeType.includes('text/plain')) return 'Text File'
                                  if (mimeType.includes('text/html')) return 'HTML File'
                                  if (mimeType.includes('application/json')) return 'JSON File'
                                  const ext = filename.split('.').pop()?.toUpperCase()
                                  return ext ? `${ext} File` : 'Document'
                                })()}
                              </p>
                            </div>
                            <a
                              href={dataUrl}
                              download={filename}
                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              Download
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  }

                  // Text type: simple text output
                  if (result.type === 'text' && result.message) {
                    // Deep parse nested JSON strings
                    const deepParse = (value: unknown): unknown => {
                      if (typeof value === 'string') {
                        try {
                          // Try to parse JSON string
                          const parsed = JSON.parse(value)
                          // Recursively parse in case of nested JSON
                          return deepParse(parsed)
                        }
                        catch {
                          // Not JSON, return as-is
                          return value
                        }
                      }
                      else if (typeof value === 'object' && value !== null) {
                        // Parse object properties recursively
                        if (Array.isArray(value)) {
                          return value.map(item => deepParse(item))
                        }
                        else {
                          const result: Record<string, unknown> = {}
                          for (const key in value) {
                            result[key] = deepParse((value as Record<string, unknown>)[key])
                          }
                          return result
                        }
                      }
                      return value
                    }

                    const parsed = deepParse(result.message)
                    const textContent = typeof parsed === 'string'
                      ? parsed
                      : JSON.stringify(parsed, null, 2)

                    return (
                      <div key={index} className="bg-white p-3 rounded border">
                        <div className="prose prose-sm max-w-none text-gray-800">
                          <ReactMarkdown
                            components={{
                              img: ({ src, alt }) => (
                                <img
                                  src={src}
                                  alt={alt || ''}
                                  className="max-w-full h-auto rounded my-2"
                                />
                              ),
                            }}
                          >
                            {textContent}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )
                  }

                  // Link type: clickable links
                  if (result.type === 'link' && result.url) {
                    return (
                      <div key={index} className="bg-white p-3 rounded border">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {result.message || result.url}
                        </a>
                      </div>
                    )
                  }

                  // JSON type with ECharts config
                  if (result.type === 'json' && result.message) {
                    const jsonData = typeof result.message === 'string'
                      ? JSON.parse(result.message)
                      : result.message

                    // Detect ECharts configuration
                    const isEChartsConfig = jsonData && (
                      jsonData.series
                      || (jsonData.xAxis && jsonData.yAxis)
                      || jsonData.radar
                    )

                    if (isEChartsConfig) {
                      return (
                        <div key={index} className="space-y-2">
                          <div className="bg-white p-4 rounded border">
                            <ReactECharts
                              option={jsonData}
                              style={{ height: '400px', width: '100%' }}
                              opts={{ renderer: 'svg' }}
                            />
                          </div>
                          <details className="bg-gray-50 p-3 rounded border">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                              View Chart Configuration (JSON)
                            </summary>
                            <pre className="text-xs overflow-auto max-h-48 mt-2 p-2 bg-white rounded border">
                              {JSON.stringify(jsonData, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )
                    }

                    // Regular JSON (not ECharts)
                    return (
                      <div key={index} className="bg-white p-3 rounded border">
                        <details open>
                          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 mb-2">
                            Result {index + 1} (JSON)
                          </summary>
                          <pre className="text-xs overflow-auto max-h-64 p-2 bg-gray-50 rounded border">
                            {JSON.stringify(jsonData, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )
                  }

                  // Unknown type: fallback to JSON
                  return (
                    <div key={index} className="bg-white p-3 rounded border">
                      <p className="text-xs text-gray-500 mb-1">Type: {result.type}</p>
                      <pre className="text-xs overflow-auto max-h-48 p-2 bg-gray-50 rounded border">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  )
                })}
              </div>
            ) : testResult.success ? (
              <p className="text-sm text-gray-600">No output from tool</p>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  )
}
