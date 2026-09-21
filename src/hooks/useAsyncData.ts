import { useCallback, useEffect, useRef, useState } from 'react';
import { toAppError, type AppError } from '../utils/errors';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
}

/** Load data on mount (and on `reload`) with loading/error state and stale-response protection. */
export function useAsyncData<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const loaderRef = useRef(loader);
  const requestId = useRef(0);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      if (current === requestId.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (current === requestId.current) setState((s) => ({ data: s.data, loading: false, error: toAppError(error) }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
