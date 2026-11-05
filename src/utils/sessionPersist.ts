import type { CreateInfo, JoinInfo, RoomState } from '../types/protocol';

const SESSION_KEY = 'best-werewolf:session';
const SESSION_VERSION = 1 as const;

export type HostRestoreData = {
  room: RoomState;
  preferences: [string, string][];
  preselectHistory: [string, Array<string | null>][];
  playerNames: [string, string][];
};

type HostPersistedSession = {
  version: typeof SESSION_VERSION;
  type: 'HOST';
  playerName: string;
  room: RoomState;
  preferences: [string, string][];
  preselectHistory: [string, Array<string | null>][];
  playerNames: [string, string][];
};

type ClientPersistedSession = {
  version: typeof SESSION_VERSION;
  type: 'CLIENT';
  roomId: string;
  playerName: string;
};

export type PersistedSession = HostPersistedSession | ClientPersistedSession;

export type AppSession =
  | { type: 'HOST'; createInfo: CreateInfo; restore?: HostRestoreData }
  | { type: 'CLIENT'; joinInfo: JoinInfo };

export function clientPeerStorageKey(roomId: string) {
  return `best-werewolf:player:${roomId}`;
}

function isRoomState(value: unknown): value is RoomState {
  if (!value || typeof value !== 'object') return false;
  const room = value as Partial<RoomState>;
  return typeof room.roomId === 'string'
    && typeof room.gameStatus === 'string'
    && Array.isArray(room.seats)
    && Array.isArray(room.selectedRoleIds)
    && Array.isArray(room.customRoles);
}

function parseSession(raw: string): PersistedSession | null {
  try {
    const data = JSON.parse(raw) as Partial<PersistedSession>;
    if (data.version !== SESSION_VERSION) return null;
    if (data.type === 'HOST') {
      if (typeof data.playerName !== 'string' || !isRoomState(data.room)) return null;
      if (!Array.isArray(data.preferences) || !Array.isArray(data.preselectHistory) || !Array.isArray(data.playerNames)) {
        return null;
      }
      return data as HostPersistedSession;
    }
    if (data.type === 'CLIENT') {
      if (typeof data.roomId !== 'string' || typeof data.playerName !== 'string') return null;
      if (data.roomId.length !== 4 || !data.playerName.trim()) return null;
      return data as ClientPersistedSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = parseSession(raw);
    if (!session) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearPersistedSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function saveHostSession(payload: Omit<HostPersistedSession, 'version' | 'type'>) {
  const session: HostPersistedSession = {
    version: SESSION_VERSION,
    type: 'HOST',
    ...payload,
  };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    try {
      const stripped: HostPersistedSession = {
        ...session,
        room: {
          ...session.room,
          customRoles: session.room.customRoles.map((role) => ({
            ...role,
            visual: {
              ...role.visual,
              imageUrl: role.visual.imageUrl?.startsWith('data:') ? undefined : role.visual.imageUrl,
            },
          })),
        },
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(stripped));
    } catch {
      // give up silently
    }
  }
}

export function saveClientSession(joinInfo: JoinInfo) {
  const session: ClientPersistedSession = {
    version: SESSION_VERSION,
    type: 'CLIENT',
    roomId: joinInfo.roomId,
    playerName: joinInfo.playerName,
  };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

/** 同标签页内复用 PeerId，便于刷新后认回座位。 */
export function getOrCreateClientPeerId(roomId: string) {
  const key = clientPeerStorageKey(roomId);
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const randomValues = new Uint32Array(4);
  crypto.getRandomValues(randomValues);
  const suffix = Array.from(randomValues, (value) => value.toString(36)).join('-');
  const clientId = `best-werewolf-player-${suffix}`;
  sessionStorage.setItem(key, clientId);
  return clientId;
}

export function restoreAppSession(): AppSession | null {
  const persisted = loadPersistedSession();
  if (!persisted) return null;
  if (persisted.type === 'HOST') {
    return {
      type: 'HOST',
      createInfo: {
        playerName: persisted.playerName,
        selectedRoleIds: persisted.room.selectedRoleIds,
        customRoles: persisted.room.customRoles,
      },
      restore: {
        room: persisted.room,
        preferences: persisted.preferences,
        preselectHistory: persisted.preselectHistory,
        playerNames: persisted.playerNames,
      },
    };
  }
  return {
    type: 'CLIENT',
    joinInfo: {
      roomId: persisted.roomId,
      playerName: persisted.playerName,
    },
  };
}

export function mapToEntries<T>(map: Map<string, T>): [string, T][] {
  return Array.from(map.entries());
}
