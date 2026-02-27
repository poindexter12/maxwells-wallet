'use client'

// global-error replaces the root layout on uncaught errors,
// so it must provide its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" data-theme="ledger">
      <body className="bg-theme min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-red-600">Something went wrong</h2>
          <p className="text-gray-600">{error.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
