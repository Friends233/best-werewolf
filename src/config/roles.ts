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
    visual: { type: 'text', badgeColor: '#8fa68c' },
  },
  werewolf: {
    id: 'werewolf',
    name: '狼人',
    camp: 'WEREWOLF',
    description: '夜间与狼同伴一起睁眼，选择一名玩家袭击。隐藏自己，活到最后。',
    visual: { type: 'text', badgeColor: '#b64b4b' },
  },
  seer: {
    id: 'seer',
    name: '预言家',
    camp: 'GOOD',
    description: '每晚可以查验一名玩家的真实阵营，用信息引导好人阵营。',
    visual: { type: 'text', badgeColor: '#6086a8' },
  },
  witch: {
    id: 'witch',
    name: '女巫',
    camp: 'GOOD',
    description: '拥有一瓶解药和一瓶毒药。解药可救夜间被杀者，毒药可毒杀一人。',
    visual: { type: 'text', badgeColor: '#886c9e' },
  },
  hunter: {
    id: 'hunter',
    name: '猎人',
    camp: 'GOOD',
    description: '在被投票出局或被狼人杀死时，可以开枪带走场上一名玩家。',
    visual: { type: 'text', badgeColor: '#a87c4f' },
  },
};

export const ROLE_ORDER = ['werewolf', 'villager', 'seer', 'witch', 'hunter'];

export const CAMP_LABELS: Record<RoleDefinition['camp'], string> = {
  GOOD: '好人阵营',
  WEREWOLF: '狼人阵营',
  NEUTRAL: '第三方阵营',
};
