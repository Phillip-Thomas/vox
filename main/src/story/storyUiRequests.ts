export type StoryUiRequest = {
  id: string;
  type: 'close-crafting';
  reason: string;
};

const listeners = new Set<(request: StoryUiRequest) => void>();
const delivered = new Set<string>();

export function requestStoryUiCloseCrafting(idInput: string, reason: string): boolean {
  const id = idInput.trim();
  if (!id || delivered.has(id)) return false;
  delivered.add(id);
  const request: StoryUiRequest = { id, type: 'close-crafting', reason };
  for (const listener of listeners) listener(request);
  return true;
}

export function subscribeStoryUiRequests(
  listener: (request: StoryUiRequest) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetStoryUiRequests(): void {
  delivered.clear();
}
