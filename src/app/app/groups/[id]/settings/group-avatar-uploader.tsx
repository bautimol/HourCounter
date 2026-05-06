"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import {
  clearGroupAvatarAction,
  updateGroupAvatarAction,
  type UpdateGroupAvatarState,
} from "./actions";
import { Avatar } from "@/components/ui/avatar";
import { ErrorMessage } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const initialState: UpdateGroupAvatarState = { error: null, ok: false };

export function GroupAvatarUploader({
  groupId,
  groupName,
  currentUrl,
}: {
  groupId: string;
  groupName: string;
  currentUrl: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const action = updateGroupAvatarAction.bind(null, groupId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    e.currentTarget.form?.requestSubmit();
  }

  function onDelete() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await clearGroupAvatarAction(groupId);
      if (result.error) setDeleteError(result.error);
      else setPreviewUrl(null);
    });
  }

  const shownUrl = state.ok && previewUrl ? previewUrl : currentUrl;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative">
        <Avatar
          name={groupName}
          src={shownUrl}
          size="xl"
          className={cn(
            "ring-4 ring-surface shadow-md shadow-black/5 transition-opacity",
            (isPending || isDeleting) && "opacity-60",
          )}
        />
        {(isPending || isDeleting) && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/30">
            <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <form action={formAction}>
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted",
              isPending && "pointer-events-none opacity-60",
            )}
          >
            <Camera className="h-4 w-4" aria-hidden />
            {currentUrl ? "Cambiar foto" : "Subir foto"}
            <input
              ref={fileRef}
              type="file"
              name="avatar"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={onFileChange}
            />
          </label>

          {currentUrl && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={onDelete}
              className={cn(
                "ml-2 inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-surface px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10",
                isDeleting && "opacity-60",
              )}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Quitar
            </button>
          )}
        </form>

        <p className="text-xs text-muted-foreground">
          PNG, JPG, WEBP o GIF · máx. 5MB · la ven todos los miembros del grupo.
        </p>

        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
        {deleteError && <ErrorMessage>{deleteError}</ErrorMessage>}
      </div>
    </div>
  );
}
