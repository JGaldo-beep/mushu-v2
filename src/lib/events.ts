type EventPayload<T = unknown> = { payload: T };

export function listen<T = unknown>(
  eventName: string,
  handler: (event: EventPayload<T>) => void,
): Promise<() => void> {
  const off = window.mushu.on(eventName, (payload) => {
    handler({ payload: payload as T });
  });
  return Promise.resolve(off);
}
