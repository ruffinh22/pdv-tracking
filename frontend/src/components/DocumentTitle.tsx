import { useEffect } from 'react';

const MARQUE = 'LONACI · Tracking PDV';

/** Met à jour le titre de l'onglet : « Page · LONACI · Tracking PDV ». */
export default function DocumentTitle({ title }: { title?: string }) {
  useEffect(() => {
    document.title = title ? `${title} · ${MARQUE}` : MARQUE;
  }, [title]);
  return null;
}
