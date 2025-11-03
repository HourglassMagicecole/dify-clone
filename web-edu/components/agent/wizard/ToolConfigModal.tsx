'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import dynamic from 'next/dynamic'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import {
  createUserToolConfig,
  deleteUserToolConfig,
  listUserToolConfigs,
  testTool,
  updateUserToolConfig,
  type ToolTestResult,
  type UserToolConfig,
} from '@/service/tool-api'
import type { Tool, ToolParameter } from '@/types/tool'

// Dynamically import ReactECharts to avoid SSR issues
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface ToolConfigModalProps {
  tool: Tool | null
  onClose: () => void
}

export default function ToolConfigModal({ tool, onClose }: ToolConfigModalProps) {
  const { t, i18n } = useTranslation('agent')
  // Convert i18n language code (ko-KR) to API format (ko_KR)
  const currentLang = (i18n.language.replace('-', '_') || 'en_US') as 'en_US' | 'ko_KR'
  const [testParams, setTestParams] = useState<Record<string, string | number | boolean | string[]>>({})
  const [testResult, setTestResult] = useState<ToolTestResult | null>(null)
  const [testing, setTesting] = useState(false)

  // TTS specific states
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // STT specific states
  const [isRecording, setIsRecording] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // API Key management states (for TOOL_PROVIDER type)
  const [userApiKey, setUserApiKey] = useState<string>('')
  const [userConfig, setUserConfig] = useState<UserToolConfig | null>(null)
  const [savingApiKey, setSavingApiKey] = useState(false)
  const [apiKeyMessage, setApiKeyMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

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
  }, [tool])

  // Load user API key configuration on tool change
  useEffect(() => {
    const loadUserConfig = async () => {
      if (!tool || !tool.provider || tool.api_key_type !== 'tool_provider')
        return

      try {
        const response = await listUserToolConfigs(tool.provider)
        if (response.result === 'success' && response.data && response.data.length > 0) {
          setUserConfig(response.data[0])
        }
      }
      catch (error) {
        console.error('Failed to load user config:', error)
      }
    }

    loadUserConfig()
    // Reset states when tool changes
    setUserApiKey('')
    setApiKeyMessage(null)
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
      const response = await testTool(provider, tool.name, finalParams)

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

  // STT: Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Try to use supported audio formats (OpenAI Whisper friendly)
      // Priority: mp4 > webm > wav
      const mimeTypes = [
        'audio/mp4',
        'audio/mpeg',
        'audio/webm;codecs=opus',
        'audio/webm',
      ]

      let selectedMimeType = 'audio/webm'
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          break
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType })
        // Determine file extension from MIME type
        const ext = selectedMimeType.includes('mp4') ? 'mp4'
                  : selectedMimeType.includes('mpeg') ? 'mp3'
                  : selectedMimeType.includes('webm') ? 'webm'
                  : 'audio'
        const file = new File([audioBlob], `recording.${ext}`, { type: selectedMimeType })
        setAudioFile(file)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    }
    catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Failed to access microphone. Please check permissions.')
    }
  }

  // STT: Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
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
        const model = testParams.model || 'openai#whisper-1'

        const provider = tool.provider || 'edu_tools'
        const response = await testTool(provider, tool.name, {
          audio_file: base64Audio,
          model,
        })

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
      setApiKeyMessage({ type: 'error', text: 'Please enter an API key' })
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
          setApiKeyMessage({ type: 'success', text: 'API Key updated successfully' })
          setUserApiKey('') // Clear input after save
        }
        else {
          setApiKeyMessage({ type: 'error', text: response.message || 'Failed to update API key' })
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
          setApiKeyMessage({ type: 'success', text: 'API Key saved successfully' })
          setUserApiKey('') // Clear input after save
        }
        else {
          setApiKeyMessage({ type: 'error', text: response.message || 'Failed to save API key' })
        }
      }
    }
    catch (error) {
      setApiKeyMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save API key',
      })
    }
    finally {
      setSavingApiKey(false)
    }
  }

  // API Key: Delete user API key
  const handleDeleteApiKey = async () => {
    if (!userConfig) return

    if (!confirm('Are you sure you want to delete this API key?')) return

    setSavingApiKey(true)
    setApiKeyMessage(null)

    try {
      const response = await deleteUserToolConfig(userConfig.id)
      if (response.result === 'success') {
        setUserConfig(null)
        setApiKeyMessage({ type: 'success', text: 'API Key deleted successfully' })
      }
      else {
        setApiKeyMessage({ type: 'error', text: response.message || 'Failed to delete API key' })
      }
    }
    catch (error) {
      setApiKeyMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete API key',
      })
    }
    finally {
      setSavingApiKey(false)
    }
  }

  // Render TTS-specific UI
  const renderTTSUI = () => (
    <div className="space-y-4">
      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium mb-1">
          TTS Model <span className="text-red-500">*</span>
        </label>
        <select
          value={String(testParams.model || 'openai#tts-1')}
          onChange={e => handleParamChange('model', e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="openai#tts-1">OpenAI TTS-1 (Fast)</option>
          <option value="openai#tts-1-hd">OpenAI TTS-1-HD (High Quality)</option>
        </select>
      </div>

      {/* Text Input */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Text to Convert <span className="text-red-500">*</span>
        </label>
        <textarea
          value={String(testParams.text || '')}
          onChange={e => handleParamChange('text', e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter text to convert to speech..."
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
        {testing ? 'Generating...' : 'Generate Audio'}
      </Button>

      {/* Audio Player */}
      {audioUrl && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <h4 className="font-semibold mb-2">Generated Audio:</h4>
          <audio controls src={audioUrl} className="w-full">
            Your browser does not support the audio element.
          </audio>
          <a
            href={audioUrl}
            download="tts-output.wav"
            className="mt-2 inline-block text-blue-600 hover:underline text-sm"
          >
            Download Audio
          </a>
        </div>
      )}
    </div>
  )

  // Render STT-specific UI
  const renderSTTUI = () => (
    <div className="space-y-4">
      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium mb-1">
          STT Model <span className="text-red-500">*</span>
        </label>
        <select
          value={String(testParams.model || 'openai#whisper-1')}
          onChange={e => handleParamChange('model', e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="openai#whisper-1">OpenAI Whisper-1</option>
        </select>
      </div>

      {/* Recording Controls */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Record Audio:</label>
        <div className="flex gap-2">
          {!isRecording ? (
            <Button onClick={startRecording} variant="default">
              🎤 Start Recording
            </Button>
          ) : (
            <Button onClick={stopRecording} variant="default">
              ⏹️ Stop Recording
            </Button>
          )}
        </div>
        {isRecording && (
          <p className="text-sm text-red-600">Recording in progress...</p>
        )}
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Or Upload Audio File:</label>
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
        <div className="p-2 bg-gray-100 rounded text-sm">
          Selected: {audioFile.name} ({(audioFile.size / 1024).toFixed(2)} KB)
        </div>
      )}

      {/* Convert Button */}
      <Button
        onClick={() => {
          // Ensure model parameter is set before calling handleSTTTest
          const model = testParams.model || 'openai#whisper-1'
          handleParamChange('model', model)
          handleSTTTest()
        }}
        disabled={testing || !audioFile}
        variant="default"
      >
        {testing ? 'Converting...' : 'Convert to Text'}
      </Button>
    </div>
  )

  // Render API Key configuration UI (for TOOL_PROVIDER type only)
  const renderApiKeyUI = () => {
    if (tool.api_key_type !== 'tool_provider')
      return null

    return (
      <div className="space-y-4 pb-4 border-b border-gray-200">
        <h3 className="font-semibold text-lg">API Key Configuration</h3>

        {/* Current API Key Status */}
        {userConfig ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">API Key Configured</p>
                <p className="text-xs text-green-600 mt-1">
                  Key: {userConfig.api_key_masked}
                </p>
              </div>
              <Button
                onClick={handleDeleteApiKey}
                disabled={savingApiKey}
                variant="default"
                className="text-sm text-red-600 hover:text-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              No API key configured. Please enter your API key below.
            </p>
          </div>
        )}

        {/* API Key Input */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {userConfig ? 'Update API Key' : 'Enter API Key'}
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="password"
            value={userApiKey}
            onChange={e => setUserApiKey(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`Enter your ${tool.provider} API key...`}
          />
          <p className="text-xs text-gray-500 mt-1">
            Your API key will be encrypted and stored securely.
          </p>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSaveApiKey}
          disabled={savingApiKey || !userApiKey.trim()}
          variant="default"
        >
          {savingApiKey ? 'Saving...' : userConfig ? 'Update API Key' : 'Save API Key'}
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
            accept="image/*"
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
            accept="image/*"
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
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : Number(value) || ''}
          onChange={e => handleParamChange(param.name, Number(e.target.value))}
          min={param.min}
          max={param.max}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={param.description[currentLang] || param.description.en_US}
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
      />
    )
  }

  // Render default parameter UI
  const renderDefaultUI = () => (
    <div className="space-y-3">
      <h3 className="font-semibold">{t('tools.testParameters')}</h3>
      {tool.parameters && tool.parameters.length > 0 ? (
        tool.parameters.map(param => (
          <div key={param.name}>
            <label className="block text-sm font-medium mb-1">
              {param.label[currentLang] || param.label.en_US}
              {param.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderParameterInput(param)}
            {/* Show description as help text */}
            <p className="text-xs text-gray-500 mt-1">
              {param.description[currentLang] || param.description.en_US}
            </p>
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-500">No parameters required</p>
      )}

      {/* Test Button */}
      <Button
        onClick={() => handleTest()}
        disabled={testing}
        variant="default"
      >
        {testing ? t('common.testing') : t('tools.test')}
      </Button>
    </div>
  )

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

            {/* Render blob results (images, documents, audio files, etc.) */}
            {testResult.success && testResult.results && testResult.results.some(r => r.type === 'blob') ? (
              <div className="space-y-3">
                {testResult.results.map((result, index) => {
                  if (result.type === 'blob' && result.blob_base64) {
                    // Convert base64 blob to data URL
                    const mimeType = result.mime_type || 'application/octet-stream'
                    const dataUrl = `data:${mimeType};base64,${result.blob_base64}`
                    const isImage = mimeType.startsWith('image/')

                    // Get filename or generate default
                    const filename = result.filename || (() => {
                      // Generate filename based on MIME type
                      const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin'
                      return `file-${index + 1}.${ext}`
                    })()

                    return (
                      <div key={index} className="bg-white p-3 rounded border">
                        {/* Render image preview if it's an image */}
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
                          /* Render download link for non-image files */
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{filename}</p>
                              <p className="text-xs text-gray-500">
                                {(() => {
                                  // Convert MIME type to user-friendly format
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
                  return null
                })}
              </div>
            ) : (
              /* Render JSON results or ECharts visualization */
              <div className="space-y-3">
                {testResult.results && testResult.results.map((result, index) => {
                  // Check if result is a JSON message with ECharts configuration
                  if (result.type === 'json' && result.message) {
                    const jsonData = typeof result.message === 'string'
                      ? JSON.parse(result.message)
                      : result.message

                    // Detect ECharts configuration (has series or xAxis/yAxis)
                    const isEChartsConfig = jsonData && (
                      jsonData.series
                      || (jsonData.xAxis && jsonData.yAxis)
                      || jsonData.radar
                    )

                    if (isEChartsConfig) {
                      return (
                        <div key={index} className="space-y-2">
                          {/* Render ECharts */}
                          <div className="bg-white p-4 rounded border">
                            <ReactECharts
                              option={jsonData}
                              style={{ height: '400px', width: '100%' }}
                              opts={{ renderer: 'svg' }}
                            />
                          </div>

                          {/* Show JSON config in collapsible section */}
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
                  }
                  return null
                })}

                {/* Fallback: Show all results as JSON if no charts detected */}
                {!testResult.results?.some(r => {
                  if (r.type === 'json' && r.message) {
                    const jsonData = typeof r.message === 'string' ? JSON.parse(r.message) : r.message
                    return jsonData && (jsonData.series || (jsonData.xAxis && jsonData.yAxis) || jsonData.radar)
                  }
                  return false
                }) && (
                  <pre className="text-sm overflow-auto max-h-64 bg-white p-2 rounded border">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
