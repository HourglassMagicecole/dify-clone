'use client'

import { useState } from 'react'
import { difyAPI } from '@/service/dify-api'
import { Button } from '@/components/common'

interface ApiTestResult {
  success: boolean
  status?: number
  data?: unknown
  error?: string
  timestamp: string
}

export default function ApiTestPage() {
  const [results, setResults] = useState<ApiTestResult[]>([])
  const [loading, setLoading] = useState(false)

  const addResult = (result: Omit<ApiTestResult, 'timestamp'>) => {
    setResults(prev => [...prev, { ...result, timestamp: new Date().toISOString() }])
  }

  const testHealthCheck = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:5001/health')
      const data = await response.json()
      addResult({
        success: response.ok,
        status: response.status,
        data,
      })
    } catch (error) {
      addResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  const testGetApps = async () => {
    setLoading(true)
    try {
      const response = await difyAPI.getApps()
      addResult({
        success: response.result === 'success',
        data: response,
      })
    } catch (error) {
      addResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  const clearResults = () => {
    setResults([])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🔌 API 연결 테스트</h1>
          <p className="mt-2 text-gray-600">
            백엔드 API 서버가 <code className="rounded bg-gray-200 px-2 py-1">http://localhost:5001</code>에서 실행 중이어야 합니다
          </p>
        </div>

        {/* API 엔드포인트 정보 */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">환경 변수 확인</h2>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <span className="text-gray-600">NEXT_PUBLIC_API_BASE_URL:</span>{' '}
              <span className="text-green-600">
                {process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001'}
              </span>
            </div>
          </div>
        </div>

        {/* 테스트 버튼들 */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">테스트 실행</h2>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={testHealthCheck}
              disabled={loading}
              variant="default"
              size="lg"
            >
              {loading ? '⏳ 테스트 중...' : '🏥 Health Check'}
            </Button>

            <Button
              onClick={testGetApps}
              disabled={loading}
              variant="secondary"
              size="lg"
            >
              {loading ? '⏳ 테스트 중...' : '📱 Get Apps (인증 필요)'}
            </Button>

            <Button
              onClick={clearResults}
              disabled={results.length === 0}
              variant="outline"
              size="lg"
            >
              🗑️ 결과 지우기
            </Button>
          </div>
        </div>

        {/* 테스트 결과 */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            테스트 결과 ({results.length})
          </h2>

          {results.length === 0 ? (
            <p className="text-gray-500">아직 테스트를 실행하지 않았습니다.</p>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`rounded-lg border-l-4 p-4 ${
                    result.success
                      ? 'border-green-500 bg-green-50'
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold ${
                        result.success ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {result.success ? '✅ 성공' : '❌ 실패'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(result.timestamp).toLocaleTimeString('ko-KR')}
                    </span>
                  </div>

                  {result.status && (
                    <div className="mb-2 text-sm">
                      <span className="font-semibold">Status:</span> {result.status}
                    </div>
                  )}

                  {result.error && (
                    <div className="mb-2 rounded bg-red-100 p-2 text-sm text-red-700">
                      <span className="font-semibold">Error:</span> {result.error}
                    </div>
                  )}

                  {result.data !== undefined && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900">
                        📄 응답 데이터 보기
                      </summary>
                      <pre className="mt-2 max-h-96 overflow-auto rounded bg-gray-100 p-3 text-xs">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 사용 가이드 */}
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-2 font-semibold text-blue-900">💡 사용 가이드</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-blue-800">
            <li>
              <strong>Health Check</strong>: 백엔드 서버가 실행 중인지 확인 (인증 불필요)
            </li>
            <li>
              <strong>Get Apps</strong>: Dify Apps 목록 가져오기 (인증 필요 - 로그인 필요)
            </li>
            <li>
              브라우저 DevTools (F12) → Network 탭에서 실제 API 요청을 확인하세요
            </li>
            <li>
              백엔드가 실행 중이 아니면{' '}
              <code className="rounded bg-blue-100 px-1">
                cd api && uv run --project api python app.py
              </code>{' '}
              실행
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
