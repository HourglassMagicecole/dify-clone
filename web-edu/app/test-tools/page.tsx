'use client'

/**
 * Tool System Test Page (IV2 Frontend Verification)
 *
 * This page is for testing ToolList and ToolConfigModal components
 * independently from the Agent Creation Wizard.
 */

import { useState } from 'react'
import ToolList from '@/components/agent/wizard/ToolList'

export default function TestToolsPage() {
  const [selectedTools, setSelectedTools] = useState<string[]>([])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Tool System Test Page
          </h1>
          <p className="text-gray-600">
            IV2 Frontend Verification - Testing ToolList and ToolConfigModal components
          </p>
        </div>

        {/* Selected Tools Display */}
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-3">Selected Tools</h2>
          <div className="space-y-2">
            {selectedTools.length === 0 ? (
              <p className="text-gray-500 italic">No tools selected yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedTools.map(tool => (
                  <div
                    key={tool}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                  >
                    {tool}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Total: {selectedTools.length} tool(s) selected
          </div>
        </div>

        {/* Tool List Component */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Available Tools</h2>
          <ToolList
            selectedTools={selectedTools}
            onToolsChange={setSelectedTools}
          />
        </div>

        {/* Test Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            IV2 Test Instructions
          </h3>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Check if tool cards are rendered properly</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Click on tool cards to select/deselect them</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Verify selected tools appear in the &quot;Selected Tools&quot; section above</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Click &quot;Configure&quot; button on selected tools</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Test tools with parameters (e.g., calculator: &quot;2+2&quot;)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Verify test results are displayed correctly</span>
            </li>
          </ul>
        </div>

        {/* Debug Info */}
        <div className="mt-4 bg-gray-100 rounded-lg p-4">
          <details>
            <summary className="cursor-pointer font-medium text-gray-700">
              Debug Info (Click to expand)
            </summary>
            <pre className="mt-2 text-xs text-gray-600 overflow-auto">
              {JSON.stringify({ selectedTools }, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  )
}
