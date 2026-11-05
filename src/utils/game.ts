import type { RoleDefinition } from '../config/roles';
import type { RoomState, SeatState } from '../types/protocol';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const HOST_PEER_ID = 'host';
export const DEFAULT_ROLES = ['werewolf', 'werewolf', 'villager', 'villager', 'seer', 'witch'];
export const MAX_CUSTOM_ROLES = 6;
export const DEFAULT_PRESELECT_ENABLED = true;
export const DEFAULT_PRESELECT_COOLDOWN = 3;
export const MIN_PRESELECT_COOLDOWN = 0;
export const MAX_PRESELECT_COOLDOWN = 12;
/** 预选历史最多保留局数，需覆盖上帝可设置的冷却上限。 */
export const PRESELECT_HISTORY_KEEP = MAX_PRESELECT_COOLDOWN;

export function createRoomCode() {
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('');
}

export function createSeats(totalSeats: number, previous: SeatState[] = []) {
  return Array.from({ length: totalSeats }, (_, index): SeatState => {
    const seatNumber = index + 1;
    const oldSeat = previous.find((seat) => seat.seatNumber === seatNumber);
    if (oldSeat) return { ...oldSeat, roleId: null, status: 'ALIVE', tags: [] };
    return {
      seatNumber,
      peerId: null,
      playerName: '',
      roleId: null,
      status: 'ALIVE',
      tags: [],
    };
  });
}

export function createRoom(
  roomId: string,
  selectedRoleIds: string[],
  creatorName: string,
  customRoles: RoleDefinition[] = [],
): RoomState {
  const seats = createSeats(selectedRoleIds.length);
  if (seats[0]) seats[0] = { ...seats[0], peerId: HOST_PEER_ID, playerName: creatorName };
  return {
    roomId,
    gameStatus: 'SETUP',
    godPeerId: null,
    godName: '',
    totalSeats: selectedRoleIds.length,
    selectedRoleIds: [...selectedRoleIds],
    customRoles: customRoles.map((role) => ({
      ...role,
      visual: { ...role.visual },
    })),
    preselectEnabled: DEFAULT_PRESELECT_ENABLED,
    preselectCooldownRounds: DEFAULT_PRESELECT_COOLDOWN,
    seats,
  };
}

export function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const target = random[0] % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function getOccupiedSeats(room: RoomState) {
  return room.seats.filter((seat) => seat.peerId !== null);
}

/** 近 cooldown 局里预选过的身份（不含本局尚未入史的选择）。 */
export function getBlockedPreselectRoles(
  history: Array<string | null> | undefined,
  cooldownRounds: number,
): string[] {
  if (cooldownRounds <= 0 || !history?.length) return [];
  const blocked = new Set<string>();
  for (const roleId of history.slice(0, cooldownRounds)) {
    if (roleId) blocked.add(roleId);
  }
  return Array.from(blocked);
}

/** 发牌时推进每人预选历史窗口；无预选记 null，用于冷却自然过期。 */
export function recordPreselectRound(
  historyMap: Map<string, Array<string | null>>,
  peerIds: string[],
  preferences: Map<string, string>,
  keep = PRESELECT_HISTORY_KEEP,
) {
  peerIds.forEach((peerId) => {
    const next = [preferences.get(peerId) ?? null, ...(historyMap.get(peerId) ?? [])].slice(0, keep);
    historyMap.set(peerId, next);
  });
}

/**
 * 发牌：仅一人预选的身份锁定给该玩家；多人预选同一身份则全部失效，该身份回到随机池。
 * preferences: peerId -> roleId（仅房主端持有，不公开同步）。
 */
export function assignRolesWithPreferences(
  selectedRoleIds: string[],
  seats: SeatState[],
  preferences: Map<string, string>,
): SeatState[] {
  const pool = [...selectedRoleIds];
  const occupied = seats.filter((seat) => seat.peerId !== null);

  const preferenceList: { peerId: string; roleId: string }[] = [];
  for (const seat of occupied) {
    const peerId = seat.peerId!;
    const roleId = preferences.get(peerId);
    if (!roleId || !pool.includes(roleId)) continue;
    preferenceList.push({ peerId, roleId });
  }

  const counts = new Map<string, number>();
  for (const pref of preferenceList) {
    counts.set(pref.roleId, (counts.get(pref.roleId) ?? 0) + 1);
  }

  const assigned = new Map<string, string>();
  for (const pref of preferenceList) {
    if (counts.get(pref.roleId) !== 1 || assigned.has(pref.peerId)) continue;
    const index = pool.indexOf(pref.roleId);
    if (index === -1) continue;
    pool.splice(index, 1);
    assigned.set(pref.peerId, pref.roleId);
  }

  const remainingPeers = occupied
    .map((seat) => seat.peerId!)
    .filter((peerId) => !assigned.has(peerId));
  const shuffled = shuffle(pool);
  remainingPeers.forEach((peerId, index) => {
    assigned.set(peerId, shuffled[index]);
  });

  return seats.map((seat) => ({
    ...seat,
    roleId: seat.peerId ? assigned.get(seat.peerId) ?? null : null,
  }));
}
