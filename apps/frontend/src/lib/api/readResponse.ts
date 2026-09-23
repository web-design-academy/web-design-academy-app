export async function readResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || fallbackMessage);
  }

  return await response.json() as Promise<T>;
}