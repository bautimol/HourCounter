"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface SubmitButtonProps extends Omit<ButtonProps, "type" | "disabled"> {
  pendingText?: string;
  fullWidth?: boolean;
}

export function SubmitButton({
  children,
  pendingText,
  fullWidth = true,
  className,
  ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className={(fullWidth ? "w-full " : "") + (className ?? "")}
      {...rest}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? (pendingText ?? "Procesando…") : children}
    </Button>
  );
}
