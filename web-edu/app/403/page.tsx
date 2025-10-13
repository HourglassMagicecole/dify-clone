// 403 Forbidden Page

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">403</h1>
        <p className="mt-2 text-gray-600">접근 권한이 없습니다.</p>
      </div>
    </div>
  )
}
