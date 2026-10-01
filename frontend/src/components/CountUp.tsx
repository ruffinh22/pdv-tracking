import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

/** Nombre qui s'incrémente en douceur à l'affichage (framer-motion). */
export default function CountUp({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, Number.isFinite(value) ? value : 0, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration]);

  return <>{display.toLocaleString('fr-FR')}</>;
}
