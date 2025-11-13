/**
 * Agent Edit Page
 * Uses Agent Creation Wizard in edit mode to modify existing Agent
 */

'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { AgentWizardProvider } from '@/context/AgentWizardContext'
import AgentWizardEditContent from './AgentWizardEditContent'

/**
 * Agent Edit Page Component
 * Wraps AgentWizardContent with Provider in edit mode
 */
export default function AgentEditPage(): React.ReactElement {
  const params = useParams()
  const agentId = params?.id as string

  return (
    <AgentWizardProvider mode="edit" initialAgentId={agentId}>
      <AgentWizardEditContent />
    </AgentWizardProvider>
  )
}
