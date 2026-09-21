import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { toAppError } from '../utils/errors';

/**
 * Typed wrapper around Cloud Functions callables. Every business mutation goes through here so
 * the server can validate, rate limit, authorize, and audit. Errors are mapped to friendly AppErrors.
 */
export async function callFunction<TRequest, TResponse>(name: string, data: TRequest): Promise<TResponse> {
  try {
    const callable = httpsCallable<TRequest, TResponse>(functions, name);
    const result = await callable(data);
    return result.data;
  } catch (error) {
    throw toAppError(error);
  }
}
