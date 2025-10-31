'use client'

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { testTool } from '@/service/tool-api'
import type { Tool } from '@/types/tool'

interface ToolConfigModalProps {
  tool: Tool | null
  onClose: () => void
}

export default function ToolConfigModal({ tool, onClose }: ToolConfigModalProps) {
  const { t, i18n } = useTranslation('agent')
  // Convert i18n language code (ko-KR) to API format (ko_KR)
  const currentLang = (i18n.language.replace('-', '_') || 'en_US') as 'en_US' | 'ko_KR'
  const [testParams, setTestParams] = useState<Record<string, string>>({})
  const [testResult, setTestResult] = useState<{
    success: boolean
    error?: string
    results?: unknown[]
  } | null>(null)
  const [testing, setTesting] = useState(false)

  // TTS specific states
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // STT specific states
  const [isRecording, setIsRecording] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleParamChange = (paramName: string, value: string) => {
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

  // Render TTS-specific UI
  const renderTTSUI = () => (
    <div className="space-y-4">
      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium mb-1">
          TTS Model <span className="text-red-500">*</span>
        </label>
        <select
          value={testParams.model || 'openai#tts-1'}
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
          value={testParams.text || ''}
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
          const model = testParams.model || 'openai#tts-1'
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
          value={testParams.model || 'openai#whisper-1'}
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
            <input
              type="text"
              value={testParams[param.name] || ''}
              onChange={e => handleParamChange(param.name, e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={param.description[currentLang] || param.description.en_US}
            />
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
            <pre className="text-sm overflow-auto max-h-64 bg-white p-2 rounded border">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  )
}
