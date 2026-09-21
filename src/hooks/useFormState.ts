import { useCallback, useState } from 'react';
import type { ZodType } from 'zod';
import { flattenIssues } from '../validation/schemas';

type Errors<T> = Partial<Record<keyof T | '_form', string>>;

/**
 * Small controlled-form helper: values, per-field errors, and schema validation.
 * `validate()` returns the parsed (trimmed/normalized) data, or null when there are errors.
 */
export function useFormState<T extends Record<string, unknown>, Output>(initial: T, schema: ZodType<Output>) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  const validate = useCallback((): Output | null => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data;
    }
    setErrors(flattenIssues(result.error) as Errors<T>);
    return null;
  }, [schema, values]);

  const setServerErrors = useCallback((fieldErrors: Record<string, string> | undefined) => {
    if (fieldErrors) setErrors(fieldErrors as Errors<T>);
  }, []);

  const reset = useCallback(() => {
    setValues(initial);
    setErrors({});
  }, [initial]);

  return { values, errors, setValue, validate, setServerErrors, reset };
}
