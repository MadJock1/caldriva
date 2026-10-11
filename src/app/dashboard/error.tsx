"use client";
export default function DashboardError({ reset }: { reset: () => void }) {
  return <section className="container py-20"><h1 className="text-3xl">Workspace unavailable</h1><p className="mt-5">The account service could not be reached. Your local studio remains available.</p><button className="mt-5 underline" onClick={reset}>Retry</button></section>;
}
