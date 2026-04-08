import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-7xl font-extrabold text-foreground mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">
          This page doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Go Home
          </Link>
          <Link
            href="/blog"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-border text-muted-foreground font-semibold hover:border-border transition-colors"
          >
            Read the Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
