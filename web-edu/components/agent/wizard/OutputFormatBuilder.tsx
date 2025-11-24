/**
 * OutputFormatBuilder Component (Simplified)
 * Provides UI for defining the output format of task-based agents
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { OutputFormat } from '@/types/agent'

interface OutputFormatBuilderProps {
  outputFormat?: OutputFormat
  onChange: (format: OutputFormat) => void
}

export function OutputFormatBuilder({
  outputFormat,
  onChange,
}: OutputFormatBuilderProps): React.ReactElement {
  const { t } = useTranslation('agent')

  // Local state for form fields
  const [formatType, setFormatType] = useState<OutputFormat['format_type']>(
    outputFormat?.format_type || 'text'
  )

  // Format-specific state
  const [textFormat, setTextFormat] = useState<OutputFormat['text_format']>(
    outputFormat?.text_format || 'markdown'
  )
  const [imageFormat, setImageFormat] = useState<OutputFormat['image_format']>(
    outputFormat?.image_format || 'png'
  )
  const [audioFormat, setAudioFormat] = useState<OutputFormat['audio_format']>(
    outputFormat?.audio_format || 'mp3'
  )
  const [fileFormat, setFileFormat] = useState<OutputFormat['file_format']>(
    outputFormat?.file_format || 'pdf'
  )

  /**
   * Update parent component when any field changes
   */
  useEffect(() => {
    const newFormat: OutputFormat = {
      format_type: formatType,
    }

    if (formatType === 'text') {
      newFormat.text_format = textFormat
    } else if (formatType === 'image') {
      newFormat.image_format = imageFormat
    } else if (formatType === 'audio') {
      newFormat.audio_format = audioFormat
    } else if (formatType === 'file') {
      newFormat.file_format = fileFormat
    }

    onChange(newFormat)
  }, [formatType, textFormat, imageFormat, audioFormat, fileFormat, onChange])

  return (
    <div className="space-y-4">
      {/* Format Type Selection */}
      <div>
        <label htmlFor="format-type" className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-2">
          {t('promptSettings.formatTypeLabel')}
        </label>
        <select
          id="format-type"
          value={formatType}
          onChange={(e) => setFormatType(e.target.value as OutputFormat['format_type'])}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value="text">{t('promptSettings.formatTypes.text')}</option>
          <option value="image">{t('promptSettings.formatTypes.image')}</option>
          <option value="audio">{t('promptSettings.formatTypes.audio')}</option>
          <option value="file">{t('promptSettings.formatTypes.file')}</option>
        </select>
      </div>

      {/* Text Format Options */}
      {formatType === 'text' && (
        <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800">
          <label htmlFor="text-format" className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-2">
            {t('promptSettings.textFormatLabel')}
          </label>
          <select
            id="text-format"
            value={textFormat}
            onChange={(e) => setTextFormat(e.target.value as OutputFormat['text_format'])}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          >
            <option value="markdown">{t('promptSettings.textFormats.markdown')}</option>
            <option value="json">{t('promptSettings.textFormats.json')}</option>
            <option value="plain_text">{t('promptSettings.textFormats.plain_text')}</option>
            <option value="html">{t('promptSettings.textFormats.html')}</option>
          </select>
        </div>
      )}

      {/* Image Format Options */}
      {formatType === 'image' && (
        <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800">
          <label htmlFor="image-format" className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-2">
            {t('promptSettings.imageFormatLabel')}
          </label>
          <select
            id="image-format"
            value={imageFormat}
            onChange={(e) => setImageFormat(e.target.value as OutputFormat['image_format'])}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          >
            <option value="png">{t('promptSettings.imageFormats.png')}</option>
            <option value="jpg">{t('promptSettings.imageFormats.jpg')}</option>
            <option value="svg">{t('promptSettings.imageFormats.svg')}</option>
            <option value="webp">{t('promptSettings.imageFormats.webp')}</option>
          </select>
        </div>
      )}

      {/* Audio Format Options */}
      {formatType === 'audio' && (
        <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800">
          <label htmlFor="audio-format" className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-2">
            {t('promptSettings.audioFormatLabel')}
          </label>
          <select
            id="audio-format"
            value={audioFormat}
            onChange={(e) => setAudioFormat(e.target.value as OutputFormat['audio_format'])}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          >
            <option value="mp3">{t('promptSettings.audioFormats.mp3')}</option>
            <option value="wav">{t('promptSettings.audioFormats.wav')}</option>
            <option value="ogg">{t('promptSettings.audioFormats.ogg')}</option>
          </select>
        </div>
      )}

      {/* File Format Options */}
      {formatType === 'file' && (
        <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800">
          <label htmlFor="file-format" className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-2">
            {t('promptSettings.fileFormatLabel')}
          </label>
          <select
            id="file-format"
            value={fileFormat}
            onChange={(e) => setFileFormat(e.target.value as OutputFormat['file_format'])}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          >
            <option value="csv">{t('promptSettings.fileFormats.csv')}</option>
            <option value="pdf">{t('promptSettings.fileFormats.pdf')}</option>
            <option value="docx">{t('promptSettings.fileFormats.docx')}</option>
            <option value="xlsx">{t('promptSettings.fileFormats.xlsx')}</option>
            <option value="pptx">{t('promptSettings.fileFormats.pptx')}</option>
          </select>
        </div>
      )}
    </div>
  )
}
