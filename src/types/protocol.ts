import type { RoleDefinition } from '../config/roles';

export type GameStatus = 'SETUP' | 'READY' | 'DEALT' | 'FINISHED';
export type HostMode = 'GOD_ONLY' | 'PLAYER_AND_GOD';
export type PlayerStatus = 'ALIVE' | 'DEAD' | 'VOTED_OUT';

export interface SeatState {
  seatNumber: number;
  peerId: string | null;
  playerName: string;
  isHost: boolean;
  roleId: string | null;
  status: PlayerStatus;
  tags: string[];
}

export interface RoomState {
  roomId: string;
  gameStatus: GameStatus;
  hostMode: HostMode;
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
  | { type: 'LEAVE_SEAT' };

export type HostMessage =
  | { type: 'SYNC_ROOM_STATE'; room: PublicRoomState }
  | { type: 'ASSIGN_ROLE'; role: RoleDefinition }
  | { type: 'RESET_GAME' }
  | { type: 'NOTICE'; message: string };

export interface JoinInfo {
  roomId: string;
  playerName: string;
}
