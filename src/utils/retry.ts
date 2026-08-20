export async function retryOperation<T>(operation: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
