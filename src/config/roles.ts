export interface RoleDefinition {
  id: string;
  name: string;
  camp: 'GOOD' | 'WEREWOLF' | 'NEUTRAL';
  description: string;
  visual: {
    type: 'text' | 'image';
    badgeColor: string;
    imageUrl?: string;
  };
}

export const ROLE_REGISTRY: Record<string, RoleDefinition> = {
  villager: {
    id: 'villager',
    name: '村民',
    camp: 'GOOD',
    description: '没有任何特殊能力，靠白天发言与投票找出狼人。',
    visual: { type: 'image', badgeColor: '#8fa68c' },
  },
  seer: {
    id: 'seer',
    name: '预言家',
    camp: 'GOOD',
    description: '每晚可以查验一名玩家的真实阵营，用信息引导好人阵营。',
    visual: { type: 'image', badgeColor: '#6086a8' },
  },
  witch: {
    id: 'witch',
    name: '女巫',
    camp: 'GOOD',
    description: '拥有一瓶解药和一瓶毒药。解药可救夜间被杀者，毒药可毒杀一人。',
    visual: { type: 'image', badgeColor: '#886c9e' },
  },
  guard: {
    id: 'guard',
    name: '守卫',
    camp: 'GOOD',
    description: '每晚可以守护一名玩家免受狼人袭击，不能连续两晚守护同一人。',
    visual: { type: 'image', badgeColor: '#5d948d' },
  },
  hunter: {
    id: 'hunter',
    name: '猎人',
    camp: 'GOOD',
    description: '在被投票出局或被狼人杀死时，可以开枪带走场上一名玩家。',
    visual: { type: 'image', badgeColor: '#a87c4f' },
  },
  werewolf: {
    id: 'werewolf',
    name: '狼人',
    camp: 'WEREWOLF',
    description: '夜间与狼同伴一起睁眼，选择一名玩家袭击。隐藏自己，活到最后。',
    visual: { type: 'image', badgeColor: '#b64b4b' },
  },
  whiteWolfKing: {
    id: 'whiteWolfKing',
    name: '白狼王',
    camp: 'WEREWOLF',
    description: '白天可以自爆并带走一名玩家，随后直接进入黑夜。',
    visual: { type: 'image', badgeColor: '#b8b7c5' },
  },
  idiot: {
    id: 'idiot',
    name: '白痴',
    camp: 'GOOD',
    description: '被投票出局时可翻开身份牌免除本次出局，但之后失去投票权。',
    visual: { type: 'image', badgeColor: '#a69b68' },
  },
  knight: {
    id: 'knight',
    name: '骑士',
    camp: 'GOOD',
    description: '白天可与一名玩家决斗：对方是狼人则对方出局，否则自己出局。',
    visual: { type: 'image', badgeColor: '#9299aa' },
  },
};

export const ROLE_ORDER = [
  'villager',
  'seer',
  'witch',
  'guard',
  'hunter',
  'werewolf',
  'whiteWolfKing',
  'idiot',
  'knight',
];

export const CAMP_LABELS: Record<RoleDefinition['camp'], string> = {
  GOOD: '好人阵营',
  WEREWOLF: '狼人阵营',
  NEUTRAL: '第三方阵营',
};

export function isCustomRoleId(roleId: string) {
  return roleId.startsWith('custom_');
}

/** 村民、狼人可多张；其余内置身份最多 1 张；自定义身份可多张。 */
export function isUniqueRole(roleId: string) {
  return !isCustomRoleId(roleId) && roleId !== 'villager' && roleId !== 'werewolf';
}

export function resolveRole(roleId: string, customRoles: RoleDefinition[] = []): RoleDefinition | undefined {
  return ROLE_REGISTRY[roleId] ?? customRoles.find((role) => role.id === roleId);
}

export function createCustomRole(name: string, imageUrl?: string): RoleDefinition {
  const random = new Uint32Array(2);
  crypto.getRandomValues(random);
  const id = `custom_${Date.now().toString(36)}_${random[0].toString(36)}${random[1].toString(36).slice(0, 4)}`;
  return {
    id,
    name: name.trim().slice(0, 8),
    camp: 'NEUTRAL',
    description: '自定义身份，技能由线下协商。',
    visual: {
      type: imageUrl ? 'image' : 'text',
      badgeColor: '#9a9080',
      imageUrl,
    },
  };
}

export function stripRoleImages(roles: RoleDefinition[]): RoleDefinition[] {
  return roles.map((role) => ({
    ...role,
    visual: { ...role.visual, imageUrl: undefined, type: role.visual.imageUrl ? 'image' : role.visual.type },
  }));
}
