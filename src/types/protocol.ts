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
  /** 本局临时自定义身份；图片以 data URL 存在房主端，公开同步时会去掉。 */
  customRoles: RoleDefinition[];
  /** 上帝可开关：是否允许玩家预选身份。 */
  preselectEnabled: boolean;
  /** 近 X 局里预选过的身份不可再预选；默认 3，0 表示不限制。 */
  preselectCooldownRounds: number;
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
  | { type: 'PRESELECT_ROLE'; roleId: string | null }
  | { type: 'SET_PRESELECT_ENABLED'; enabled: boolean }
  | { type: 'SET_PRESELECT_COOLDOWN'; rounds: number }
  | { type: 'CHANGE_ROLE_COUNT'; roleId: string; delta: number }
  | { type: 'ADD_CUSTOM_ROLE'; role: RoleDefinition }
  | { type: 'REMOVE_CUSTOM_ROLE'; roleId: string }
  | { type: 'SWAP_SEATS'; seatA: number; seatB: number }
  | { type: 'DEAL_CARDS' }
  | { type: 'SET_PLAYER_STATUS'; seatNumber: number; status: PlayerStatus }
  | { type: 'TOGGLE_TAG'; seatNumber: number; tag: string }
  | { type: 'RESET_GAME' };

export type HostMessage =
  | { type: 'SYNC_ROOM_STATE'; room: PublicRoomState }
  | { type: 'SYNC_GOD_STATE'; room: RoomState }
  | { type: 'ASSIGN_ROLE'; role: RoleDefinition }
  | { type: 'SYNC_MY_PRESELECT'; roleId: string | null; blockedRoleIds: string[] }
  | { type: 'RESET_GAME' }
  | { type: 'NOTICE'; message: string };

export interface JoinInfo {
  roomId: string;
  playerName: string;
}

export interface CreateInfo {
  playerName: string;
  selectedRoleIds: string[];
  customRoles: RoleDefinition[];
}
