import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-8">
      <section className="w-full rounded-[1.5rem] border border-black/10 bg-[var(--card)] p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-black">About Aryma</h1>
        <p className="mt-3 text-sm leading-7 text-black/70 sm:text-base">
          Aryma helps restaurant operators turn operational challenges into clear, actionable plans.
          The platform combines workflow-based intake, dashboard tracking, and AI assistance for
          inventory, issue resolution, and menu development.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            Back to Login
          </Link>
        </div>
      </section>
    </main>
  );
}
