import type { RoomState, SeatState } from '../types/protocol';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const HOST_PEER_ID = 'host';
export const DEFAULT_ROLES = ['werewolf', 'werewolf', 'villager', 'villager', 'seer', 'witch'];

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

export function createRoom(roomId: string, selectedRoleIds: string[], creatorName: string): RoomState {
  const seats = createSeats(selectedRoleIds.length);
  if (seats[0]) seats[0] = { ...seats[0], peerId: HOST_PEER_ID, playerName: creatorName };
  return {
    roomId,
    gameStatus: 'SETUP',
    godPeerId: null,
    godName: '',
    totalSeats: selectedRoleIds.length,
    selectedRoleIds: [...selectedRoleIds],
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
