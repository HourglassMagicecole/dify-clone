/**
 * Agent Zod Schema Validation Tests
 * (hotfix_20260414_zod-message-i18n-leak)
 *
 * Zod 에러 message가 번역 사전에 등록된 접두사 없는 키 형태인지 검증한다.
 * 렌더 지점에서 useTranslation('agent') 네임스페이스로 t(key)를 호출하므로,
 * message에 'agent.' 접두사가 섞이면 이중 접두사로 raw 키가 노출된다.
 */

import { promptSettingsSchema } from '@/schemas/agent-schema'
import agentKoMessages from '@/i18n/ko-KR/agent.json'
import agentEnMessages from '@/i18n/en-US/agent.json'

const getIssueMessage = (data: unknown): string | undefined => {
  const result = promptSettingsSchema.safeParse(data)
  if (result.success) return undefined
  return result.error.issues[0]?.message
}

const resolveKey = (dict: Record<string, unknown>, key: string): unknown => {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dict)
}

describe('promptSettingsSchema — i18n key shape (no agent. prefix)', () => {
  it('pre_prompt min length error message is an unprefixed i18n key present in agent namespace', () => {
    const msg = getIssueMessage({
      pre_prompt: 'short', // < 10
      prompt_type: 'simple',
    })
    expect(msg).toBeDefined()
    expect(msg!.startsWith('agent.')).toBe(false)
    expect(msg).toBe('validation.promptMinLength')
    expect(resolveKey(agentKoMessages as Record<string, unknown>, msg!)).toBeDefined()
    expect(resolveKey(agentEnMessages as Record<string, unknown>, msg!)).toBeDefined()
  })

  it('pre_prompt max length error message is an unprefixed key', () => {
    const msg = getIssueMessage({
      pre_prompt: 'a'.repeat(4001),
      prompt_type: 'simple',
    })
    expect(msg).toBe('validation.promptTooLong')
    expect(resolveKey(agentKoMessages as Record<string, unknown>, msg!)).toBeDefined()
  })

  it('opening_statement max length error message is an unprefixed key', () => {
    const msg = getIssueMessage({
      pre_prompt: 'a'.repeat(20),
      prompt_type: 'simple',
      opening_statement: 'o'.repeat(501),
    })
    expect(msg).toBe('validation.openingStatementTooLong')
    expect(resolveKey(agentKoMessages as Record<string, unknown>, msg!)).toBeDefined()
  })

  it('user_input_form required (advanced mode) error message is an unprefixed key', () => {
    const msg = getIssueMessage({
      pre_prompt: 'a'.repeat(20),
      prompt_type: 'advanced',
      user_input_form: [],
    })
    expect(msg).toBe('validation.userInputFormRequired')
    expect(resolveKey(agentKoMessages as Record<string, unknown>, msg!)).toBeDefined()
  })

  it('valid input yields no errors (regression guard)', () => {
    const result = promptSettingsSchema.safeParse({
      pre_prompt: 'a'.repeat(20),
      prompt_type: 'simple',
      opening_statement: 'hello',
    })
    expect(result.success).toBe(true)
  })
})
