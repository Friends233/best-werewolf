import type { RoleDefinition } from '../config/roles';

export type GameStatus = 'SETUP' | 'READY' | 'DEALT' | 'FINISHED';
export type PlayerStatus = 'ALIVE' | 'DEAD' | 'VOTED_OUT';

export interface SeatState {
  seatNumber: number;
  peerId: string | null;
  playerName: string;
  roleId: string | null;
  status: PlayerStatus;
  tags: string[];
}

export interface RoomState {
  roomId: string;
  gameStatus: GameStatus;
  godPeerId: string | null;
  godName: string;
  totalSeats: number;
  selectedRoleIds: string[];
  seats: SeatState[];
}

export type PublicSeat = Omit<SeatState, 'roleId'>;
export type PublicRoomState = Omit<RoomState, 'seats'> & {
  seats: PublicSeat[];
};

export type ClientMessage =
  | { type: 'JOIN'; playerName: string }
  | { type: 'SELECT_SEAT'; targetSeat: number }
  | { type: 'CLAIM_GOD' }
  | { type: 'LEAVE_GOD' }
  | { type: 'CHANGE_ROLE_COUNT'; roleId: string; delta: number }
  | { type: 'SWAP_SEATS'; seatA: number; seatB: number }
  | { type: 'DEAL_CARDS' }
  | { type: 'SET_PLAYER_STATUS'; seatNumber: number; status: PlayerStatus }
  | { type: 'TOGGLE_TAG'; seatNumber: number; tag: string }
  | { type: 'RESET_GAME' };

export type HostMessage =
  | { type: 'SYNC_ROOM_STATE'; room: PublicRoomState }
  | { type: 'SYNC_GOD_STATE'; room: RoomState }
  | { type: 'ASSIGN_ROLE'; role: RoleDefinition }
  | { type: 'RESET_GAME' }
  | { type: 'NOTICE'; message: string };

export interface JoinInfo {
  roomId: string;
  playerName: string;
}

export interface CreateInfo {
  playerName: string;
  selectedRoleIds: string[];
}
