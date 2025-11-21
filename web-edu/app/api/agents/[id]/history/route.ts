import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/agents/[id]/history
 *
 * Proxy for Backend completion-messages API
 * Avoids CORS issues by making server-side request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '20'

    // Get access token from cookie (edu_access_token is used in /web-edu)
    const accessToken = request.cookies.get('edu_access_token')?.value

    if (!accessToken) {
      console.error('[API /history] No token found. Cookies:', request.cookies.getAll())
      return NextResponse.json(
        { error: 'Unauthorized - No authentication token found' },
        { status: 401 }
      )
    }

    // Build Backend API URL
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

    // First, get agent info to determine the correct endpoint
    const agentInfoUrl = `${backendUrl}/console/api/apps/${id}`
    const agentInfoResponse = await fetch(agentInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!agentInfoResponse.ok) {
      const errorText = await agentInfoResponse.text()
      return NextResponse.json(
        { error: `Failed to get agent info: ${agentInfoResponse.status}`, details: errorText },
        { status: agentInfoResponse.status }
      )
    }

    const agentInfo = await agentInfoResponse.json()
    const agentMode = agentInfo.mode || 'completion'

    // Determine endpoint based on agent mode
    const endpoint = agentMode === 'completion'
      ? 'completion-conversations'
      : 'chat-conversations'

    const url = `${backendUrl}/console/api/apps/${id}/${endpoint}?limit=${limit}`

    // Proxy request to Backend
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json(data)
  }
  catch (error) {
    console.error('[API /api/agents/[id]/history] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
