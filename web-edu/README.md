# EduAI Studio - Educational Frontend

교육용 AI 플랫폼의 독립적인 프론트엔드 애플리케이션입니다.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS
- **State Management**: Zustand + React Query
- **Package Manager**: pnpm 10.16.0

## Getting Started

### Prerequisites

- Node.js >= 22.11.0
- pnpm 10.16.0

### Installation

```bash
cd web-edu
pnpm install
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Build

```bash
pnpm build
pnpm start
```

### Linting

```bash
pnpm lint        # Check
pnpm lint:fix    # Auto-fix
```

### Type Checking

```bash
pnpm type-check
```

## Project Structure

```
web-edu/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 인증 레이아웃
│   ├── (student)/         # 학생 레이아웃
│   └── (admin)/           # 관리자 레이아웃
├── components/            # 재사용 컴포넌트
├── service/               # API 클라이언트
├── hooks/                 # 커스텀 훅
├── context/               # React Context
├── i18n/                  # 국제화
└── utils/                 # 유틸리티
```

## Environment Variables

Copy `.env.example` to `.env.local` and update values:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
```

## License

Same as Dify (Apache 2.0)
