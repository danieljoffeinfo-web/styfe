export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1 className="mt-1.5 text-[34px] font-bold leading-none tracking-[-0.035em] text-ink sm:text-[40px]">
          {title}
        </h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
