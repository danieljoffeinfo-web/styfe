/**
 * Shown the instant a nav link is clicked, while the page's queries run.
 *
 * Every route under (app) is server-rendered on demand and talks to Supabase,
 * so without a loading boundary a tab switch leaves the previous page frozen on
 * screen until the server answers — which reads as "the app is slow" even when
 * the query is quick. This also gives <Link> something to prefetch: Next only
 * prefetches a dynamic route as far as its nearest loading boundary, so before
 * this file existed the sidebar links prefetched nothing at all.
 *
 * The shape mirrors PageHeader plus a card grid so the swap to real content
 * does not jump.
 */
function Bar({ className }: { className: string }) {
  return <div className={`rounded bg-line/70 ${className}`} />;
}

function Card() {
  return (
    <div className="card p-5">
      <Bar className="h-3 w-24" />
      <Bar className="mt-4 h-7 w-32" />
      <Bar className="mt-3 h-3 w-20" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-pulse motion-reduce:animate-none" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      {/* PageHeader: eyebrow + title */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Bar className="h-3 w-28" />
          <Bar className="mt-3 h-10 w-64 sm:h-12 sm:w-80" />
        </div>
        <div className="flex gap-2.5">
          <Bar className="h-11 w-28" />
          <Bar className="h-11 w-24" />
        </div>
      </header>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:mt-6 lg:grid-cols-3">
        <Card />
        <Card />
        <Card />
      </div>

      <div className="card mt-4 p-5 lg:mt-6">
        <Bar className="h-3 w-32" />
        <div className="mt-5 flex flex-col gap-3.5">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-11/12" />
          <Bar className="h-4 w-10/12" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-9/12" />
        </div>
      </div>
    </div>
  );
}
