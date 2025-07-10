export function isUnauthorizedError(error: any): boolean {
  return error && error.message && error.message.includes("401");
}