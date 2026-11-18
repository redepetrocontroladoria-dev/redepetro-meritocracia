type PageShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">{children}</div>
    </main>
  );
}
