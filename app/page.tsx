export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-black">Aryma ISM</h1>
        <p className="mt-3 text-black/70">
          The app is running. Your chat API route is available at <code>/api/chat</code>.
        </p>
      </div>
    </main>
  );
}
