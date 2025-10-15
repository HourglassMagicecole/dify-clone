import { render, screen, fireEvent } from '@testing-library/react';
import { Dropdown } from '@/components/common/Dropdown';
import { DropdownItem } from '@/components/common/DropdownItem';

describe('Dropdown', () => {
  it('트리거 클릭 시 드롭다운이 열려야 함', () => {
    render(
      <Dropdown trigger={<button>Open</button>}>
        <DropdownItem label="Item 1" onClick={() => {}} />
      </Dropdown>
    );

    const trigger = screen.getByText('Open');
    fireEvent.click(trigger);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('외부 클릭 시 드롭다운이 닫혀야 함', () => {
    render(
      <div>
        <Dropdown trigger={<button>Open</button>}>
          <DropdownItem label="Item 1" onClick={() => {}} />
        </Dropdown>
        <div data-testid="outside">Outside</div>
      </div>
    );

    const trigger = screen.getByText('Open');
    fireEvent.click(trigger);
    expect(screen.getByText('Item 1')).toBeInTheDocument();

    const outside = screen.getByTestId('outside');
    fireEvent.mouseDown(outside);

    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
  });

  it('DropdownItem 클릭 시 onClick 핸들러가 실행되어야 함', () => {
    const handleClick = jest.fn();
    render(
      <Dropdown trigger={<button>Open</button>}>
        <DropdownItem label="Item 1" onClick={handleClick} />
      </Dropdown>
    );

    fireEvent.click(screen.getByText('Open'));
    fireEvent.click(screen.getByText('Item 1'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('트리거를 다시 클릭하면 드롭다운이 닫혀야 함', () => {
    render(
      <Dropdown trigger={<button>Toggle</button>}>
        <DropdownItem label="Item 1" onClick={() => {}} />
      </Dropdown>
    );

    const trigger = screen.getByText('Toggle');

    // 첫 번째 클릭 - 열림
    fireEvent.click(trigger);
    expect(screen.getByText('Item 1')).toBeInTheDocument();

    // 두 번째 클릭 - 닫힘
    fireEvent.click(trigger);
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
  });

  it('align prop이 left일 때 왼쪽 정렬되어야 함', () => {
    const { container } = render(
      <Dropdown trigger={<button>Open</button>} align="left">
        <DropdownItem label="Item 1" onClick={() => {}} />
      </Dropdown>
    );

    fireEvent.click(screen.getByText('Open'));

    const dropdown = container.querySelector('.absolute');
    expect(dropdown).toHaveClass('left-0');
  });

  it('align prop이 right일 때 오른쪽 정렬되어야 함', () => {
    const { container } = render(
      <Dropdown trigger={<button>Open</button>} align="right">
        <DropdownItem label="Item 1" onClick={() => {}} />
      </Dropdown>
    );

    fireEvent.click(screen.getByText('Open'));

    const dropdown = container.querySelector('.absolute');
    expect(dropdown).toHaveClass('right-0');
  });
});

describe('DropdownItem', () => {
  it('라벨이 표시되어야 함', () => {
    render(<DropdownItem label="Test Item" onClick={() => {}} />);
    expect(screen.getByText('Test Item')).toBeInTheDocument();
  });

  it('아이콘이 제공되면 표시되어야 함', () => {
    render(
      <DropdownItem label="Test" icon={<span data-testid="test-icon">🔥</span>} onClick={() => {}} />
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('클릭 시 onClick 핸들러가 실행되어야 함', () => {
    const handleClick = jest.fn();
    render(<DropdownItem label="Click Me" onClick={handleClick} />);

    fireEvent.click(screen.getByText('Click Me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('divider가 true일 때 구분선이 표시되어야 함', () => {
    const { container } = render(
      <DropdownItem label="Item with divider" onClick={() => {}} divider={true} />
    );

    const divider = container.querySelector('.border-t');
    expect(divider).toBeInTheDocument();
  });

  it('divider가 false일 때 구분선이 표시되지 않아야 함', () => {
    const { container } = render(
      <DropdownItem label="Item without divider" onClick={() => {}} divider={false} />
    );

    const divider = container.querySelector('.border-t');
    expect(divider).not.toBeInTheDocument();
  });
});
