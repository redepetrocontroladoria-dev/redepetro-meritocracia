type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
  min?: string;
};

export function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = true,
  step,
  min,
}: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        step={step}
        min={min}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      />
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
};

export function SelectField({
  label,
  name,
  options,
  placeholder = "Selecione...",
  required = true,
}: SelectFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <select
        name={name}
        required={required}
        defaultValue=""
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex w-full items-center justify-center rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-800"
    >
      {children}
    </button>
  );
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <h2 className="bg-brand-secondary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white">
        {title}
      </h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
      {message}
    </p>
  );
}

export function DeleteButton() {
  return (
    <button
      type="submit"
      className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
    >
      Excluir
    </button>
  );
}
