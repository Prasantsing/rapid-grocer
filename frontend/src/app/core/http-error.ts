export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (typeof error === 'object' && error && 'error' in error) {
    const body = (error as { error?: { message?: string } }).error;
    if (body?.message) return body.message;
  }
  return fallback;
}
