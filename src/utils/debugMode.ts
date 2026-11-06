export const DEBUG_PEER_PREFIX = 'debug-player-';

export interface DebugParticipant {
  peerId: string;
  playerName: string;
  seatNumber: number | null;
  roleId: string | null;
  isGod: boolean;
}

export function isDebugMode(search?: string) {
  if (search !== undefined) return new URLSearchParams(search).get('debug') === '1';
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

export function isDebugPeerId(peerId: string | null | undefined): peerId is string {
  return Boolean(peerId?.startsWith(DEBUG_PEER_PREFIX));
}

export function nextDebugPlayerIndex(peerIds: Iterable<string>) {
  let maxIndex = 0;
  for (const peerId of peerIds) {
    if (!isDebugPeerId(peerId)) continue;
    const index = Number(peerId.slice(DEBUG_PEER_PREFIX.length));
    if (Number.isInteger(index)) maxIndex = Math.max(maxIndex, index);
  }
  return maxIndex + 1;
}
