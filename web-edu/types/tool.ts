export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select'
  required: boolean
  label: {
    en_US: string
    ko_KR: string
  }
  description: {
    en_US: string
    ko_KR: string
  }
  options?: string[]
}

export interface Tool {
  name: string
  provider?: string // Provider name (e.g., "edu_tools", "webscraper")
  label: {
    en_US: string
    ko_KR: string
  }
  description: {
    human: {
      en_US: string
      ko_KR: string
    }
    llm: string
  }
  parameters?: ToolParameter[] // Optional - only available from detail API
  icon: string
  available: boolean
  unavailable_reason?: string
}

export interface ToolProvider {
  name: string
  label: {
    en_US: string
    ko_KR: string
  }
  icon: string
  tools: Tool[]
}
