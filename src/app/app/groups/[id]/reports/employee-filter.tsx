"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Users } from "lucide-react";

export type EmployeeOption = {
  id: string;
  name: string;
};

/**
 * Dropdown that narrows the reports to a single employee. Writes the chosen
 * member id into the URL (`?employee=<memberId>`) preserving the current
 * from/to range so the server re-renders scoped to that person.
 */
export function EmployeeFilter({
  employees,
  selected,
}: {
  employees: EmployeeOption[];
  selected: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "") {
      params.delete("employee");
    } else {
      params.set("employee", value);
    }
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Users className="h-4 w-4" aria-hidden />
      <span className="sr-only sm:not-sr-only">Empleado</span>
      <select
        value={selected ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={isPending}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground disabled:opacity-60"
      >
        <option value="">Todos los empleados</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </label>
  );
}
