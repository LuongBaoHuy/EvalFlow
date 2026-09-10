import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce a value by a specified delay in milliseconds.
 * @param {any} value - The input value to debounce
 * @param {number} delay - Delay in ms (default 500)
 * @returns {any} debouncedValue
 */
export default function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
