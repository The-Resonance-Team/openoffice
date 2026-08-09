export interface Transport {
  base(): string | Promise<string>;
  authHeaders(): HeadersInit | Promise<HeadersInit>;
}

let transport: Transport | null = null;

export function setTransport(t: Transport) {
  transport = t;
}

export function getTransport(): Transport {
  if (!transport)
    throw new Error("Transport not set — call setTransport() first");
  return transport;
}
