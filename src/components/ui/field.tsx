import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const inputBase =
  'block w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-none focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-zinc-50 disabled:text-zinc-500';

const errorClass = 'border-red-400 focus:border-red-500 focus:ring-red-400';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className = '',
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-zinc-700">
        {label}
        {required ? <span className="ml-0.5 text-red-600" aria-hidden="true">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  error,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return <input className={`${inputBase} ${error ? errorClass : ''} ${className}`} aria-invalid={error ? true : undefined} {...rest} />;
}

export function Select({
  error,
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select className={`${inputBase} ${error ? errorClass : ''} ${className}`} aria-invalid={error ? true : undefined} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({
  error,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return <textarea className={`${inputBase} ${error ? errorClass : ''} ${className}`} aria-invalid={error ? true : undefined} {...rest} />;
}

export function Checkbox({
  label,
  id,
  defaultChecked,
  name,
}: {
  label: string;
  id: string;
  defaultChecked?: boolean;
  name?: string;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm text-zinc-700">
      <input
        id={id}
        name={name ?? id}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-accent accent-[#0f766e] focus:ring-accent"
      />
      <span>{label}</span>
    </label>
  );
}
