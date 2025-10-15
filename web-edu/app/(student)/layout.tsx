export default function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  )
}
