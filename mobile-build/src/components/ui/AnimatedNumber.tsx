import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle } from 'react-native';

interface Props {
  value: number;
  duration?: number;
  style?: TextStyle | TextStyle[];
  formatter?: (n: number) => string;
}

/**
 * Anime un nombre de sa valeur précédente vers sa nouvelle valeur (count-up/down),
 * avec un easing "ease-out" — utilisé pour les StatCards de l'accueil.
 */
export default function AnimatedNumber({ value, duration = 650, style, formatter }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const text = formatter ? formatter(display) : String(display);

  return <Text style={style}>{text}</Text>;
}
