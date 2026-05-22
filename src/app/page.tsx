export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white">
      <h1 className="text-5xl font-bold tracking-tight text-gray-900">
        ChatterBox
      </h1>
      <p className="mt-4 text-lg text-gray-500">
        Your AI-powered calendar assistant
      </p>
      <button
        className="mt-10 rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
        type="button"
      >
        Sign in with Google
      </button>
    </main>
  );
}
