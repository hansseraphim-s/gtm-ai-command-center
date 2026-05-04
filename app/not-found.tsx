import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4">
      <p className="text-5xl font-bold text-muted-foreground/30">404</p>
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-sm text-muted-foreground">
        This route doesn&apos;t exist in the GTM AI Command Center.
      </p>
      <Link
        href="/dashboard"
        className="text-sm text-brand-accent hover:underline font-medium"
      >
        Go to Dashboard →
      </Link>
    </div>
  );
}
