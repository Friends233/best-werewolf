import villagerArt from '../assets/villager.jpg';
import seerArt from '../assets/seer.jpg';
import witchArt from '../assets/witch.jpg';
import guardArt from '../assets/guard.jpg';
import hunterArt from '../assets/hunter.jpg';
import werewolfArt from '../assets/werewolf.jpg';
import whiteWolfKingArt from '../assets/whiteWolfKing.jpg';
import idiotArt from '../assets/idiot.jpg';
import knightArt from '../assets/knight.jpg';
import cardBackArt from '../assets/cardBack.jpg';
import type { RoleDefinition } from '../config/roles';

/** 内置角色原画；新增素材后在此按 roleId 登记即可。 */
const ROLE_ART: Record<string, string> = {
  villager: villagerArt,
  seer: seerArt,
  witch: witchArt,
  guard: guardArt,
  hunter: hunterArt,
  werewolf: werewolfArt,
  whiteWolfKing: whiteWolfKingArt,
  idiot: idiotArt,
  knight: knightArt,
};

/** 身份牌统一背面。 */
export const CARD_BACK_SRC = cardBackArt;

interface RoleArtworkProps {
  role: RoleDefinition;
  className?: string;
}

export function getRoleArtSrc(role: RoleDefinition): string | undefined {
  return role.visual.imageUrl || ROLE_ART[role.id];
}

export function hasRoleArt(role: RoleDefinition): boolean {
  return Boolean(getRoleArtSrc(role));
}

export function RoleArtwork({ role, className = '' }: RoleArtworkProps) {
  const src = getRoleArtSrc(role);
  const classNames = `role-artwork ${className}`.trim();

  if (src) {
    return <img className={classNames} src={src} alt={`${role.name}角色原画`} draggable={false} />;
  }

  return <span className={`${classNames} role-artwork--blank`} aria-label={`${role.name}原画待补充`} />;
}
