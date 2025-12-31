import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { PriceConfigTable } from '@/components/analytics/PriceConfigTable'
import { PriceConfig } from '@/service/price-config-api'

describe('PriceConfigTable', () => {
  const mockConfigs: PriceConfig[] = [
    {
      id: 'config-001',
      tenant_id: 'tenant-001',
      provider: 'openai',
      model_id: 'gpt-4',
      usage_type: 'llm',
      price_unit: 'token',
      unit_scale: 1000000,
      input_price: '0.03',
      output_price: '0.06',
      currency: 'USD',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'config-002',
      tenant_id: 'tenant-001',
      provider: 'openai',
      model_id: 'dall-e-3',
      usage_type: 'image_gen',
      price_unit: 'image',
      unit_scale: 1,
      input_price: null,
      output_price: '0.04',
      currency: 'USD',
      quality: 'hd',
      resolution: '1024x1024',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
    },
  ]

  // 4.1-FE-010: 기본 렌더링
  it('가격 설정 목록을 테이블로 표시', () => {
    render(<PriceConfigTable configs={mockConfigs} />)

    // 헤더 확인
    expect(screen.getByText('Provider')).toBeInTheDocument()
    expect(screen.getByText('Model')).toBeInTheDocument()
    expect(screen.getByText('타입')).toBeInTheDocument()

    // 데이터 확인 - 여러 개의 openai가 있으므로 getAllByText 사용
    expect(screen.getAllByText('openai').length).toBeGreaterThan(0)
    expect(screen.getByText('gpt-4')).toBeInTheDocument()
    expect(screen.getByText('dall-e-3')).toBeInTheDocument()
  })

  // 4.1-FE-011: 로딩 상태
  it('로딩 상태에서 스켈레톤 표시', () => {
    const { container } = render(<PriceConfigTable configs={[]} loading={true} />)

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // 4.1-FE-012: 빈 목록
  it('빈 목록에서 안내 메시지 표시', () => {
    render(<PriceConfigTable configs={[]} />)

    expect(screen.getByText('등록된 가격 설정이 없습니다.')).toBeInTheDocument()
  })

  // 4.1-FE-013: 이미지 품질/해상도 표시
  it('이미지 설정의 품질과 해상도 배지 표시', () => {
    render(<PriceConfigTable configs={mockConfigs} />)

    expect(screen.getByText('hd')).toBeInTheDocument()
    expect(screen.getByText('1024x1024')).toBeInTheDocument()
  })

  // 4.1-FE-014: 수정 버튼 클릭
  it('수정 버튼 클릭 시 onEdit 호출', () => {
    const onEdit = jest.fn()
    render(<PriceConfigTable configs={mockConfigs} onEdit={onEdit} />)

    // 수정 버튼 찾기 (첫 번째 항목)
    const editButtons = screen.getAllByRole('button', { name: /수정|edit/i })
    if (editButtons.length > 0) {
      fireEvent.click(editButtons[0])
      expect(onEdit).toHaveBeenCalledWith(mockConfigs[0])
    }
  })

  // 4.1-FE-015: 삭제 버튼 클릭
  it('삭제 버튼 클릭 시 onDelete 호출', () => {
    const onDelete = jest.fn()
    render(<PriceConfigTable configs={mockConfigs} onDelete={onDelete} />)

    // 삭제 버튼 찾기 (첫 번째 항목)
    const deleteButtons = screen.getAllByRole('button', { name: /삭제|delete/i })
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0])
      expect(onDelete).toHaveBeenCalledWith('config-001')
    }
  })
})
