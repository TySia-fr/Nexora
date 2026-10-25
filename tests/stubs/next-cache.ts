// Next's cache APIs only work inside a Next.js server; in unit/integration
// tests caching is irrelevant, so they are no-ops.
export const cacheLife = (_profile?: unknown) => {};
export const cacheTag = (..._tags: string[]) => {};
export const updateTag = (_tag: string) => {};
export const revalidateTag = (_tag: string, _profile?: unknown) => {};
export const revalidatePath = (_path: string) => {};
export const refresh = () => {};
