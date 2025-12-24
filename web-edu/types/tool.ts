export interface ToolParameterOption {
  value: string
  label: {
    en_US: string
    ko_KR: string
  }
}

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'file' | 'files'
  required: boolean
  form: 'form' | 'llm'  // 'form': user configurable, 'llm': filled by LLM
  label: {
    en_US: string
    ko_KR: string
  }
  description: {
    en_US: string
    ko_KR: string
  }
  options?: ToolParameterOption[] // For select type
  default?: string | number // Default value
  min?: number // For number type
  max?: number // For number type
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
  api_key_type?: 'llm_provider' | 'tool_provider' | 'no_api_key' // API Key requirement type
  requires_user_key?: boolean // True if user needs to configure their own API key
  user_has_key?: boolean // True if user has already configured API key
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
