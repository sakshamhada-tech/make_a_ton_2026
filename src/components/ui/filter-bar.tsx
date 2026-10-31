import type { ReactNode } from 'react';

/**
 * Horizontal filter form that GETs back to the same page; submits on change
 * via the search button. Keep query keys in sync with page searchParams.
 */
export function FilterBar({
  action,
  children,
  resetHref,
}: {
  action: string;
  children: ReactNode;
  resetHref: string;
}) {
  return (
    <form
      method="get"
      action={action}
      className="mb-4 flex flex-wrap items-end gap-3 rounded border border-zinc-200 bg-white px-3 py-2.5"
    >
      {children}
      <div className="flex items-center gap-2 pb-0.5">
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded bg-zinc-800 px-3 text-xs font-medium text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-500"
        >
          Apply
        </button>
        <a
          href={resetHref}
          className="inline-flex h-8 items-center rounded border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Reset
        </a>
      </div>
    </form>
  );
}

export function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-2xs font-medium text-zinc-600">
      {label}
      <select
        name={name}
        defaultValue={value ?? ''}
        className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterText({
  label,
  name,
  value,
  placeholder,
}: {
  label: string;
  name: string;
  value?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-2xs font-medium text-zinc-600">
      {label}
      <input
        type="search"
        name={name}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </label>
  );
}

export function FilterDate({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-2xs font-medium text-zinc-600">
      {label}
      <input
        type="date"
        name={name}
        defaultValue={value ?? ''}
        className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </label>
  );
}
