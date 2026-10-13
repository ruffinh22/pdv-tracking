import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  hint?: string;
}

/** Zone sans contenu : icône + phrase, plutôt qu'un simple texte gris. */
export default function EmptyState({ icon: Icon, message, hint }: EmptyStateProps) {
  return (
    <div className="h-full min-h-[8rem] flex flex-col items-center justify-center gap-2 text-center px-4 py-6" role="status">
      <div className="w-11 h-11 rounded-full bg-mist-100 flex items-center justify-center">
        <Icon className="w-5 h-5 text-success-600" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-ink-600">{message}</p>
      {hint ? <p className="text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}
