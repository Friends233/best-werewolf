这份方案针对“零服务器、GitHub Pages 静态托管、React + Vite + PeerJS (WebRTC)”**的技术路线设计。系统聚焦于**发牌流转与上帝记牌看板，不做冗余的胜负规则判定。



### 一、系统拓扑与核心流转

采用**星型 P2P 通信模型**：房主作为中心节点（Host），掌管底牌打乱与派发逻辑；玩家端作为叶子节点（Client）直连房主。



```
                    [ 房主端 (Host) ]
               ┌───────────┴───────────┐
               │  - 洗牌与一对一加密发牌  │
               │  - 座位编排与交换     │
               │  - 上帝标记盘 (存活/出局)│
               └───────────┬───────────┘
            RTCDataChannel │ (点对点直连)
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
[ 玩家 1 (Client) ] [ 玩家 2 (Client) ] [ 玩家 N (Client) ]
 (仅接收自己的身份)   (仅接收自己的身份)   (仅接收自己的身份)
```

### 二、可扩展卡牌配置体系 (`src/config/roles.ts`)

预留卡面渲染规范，当前为纯文字，后续直接在 `visual` 节点配置图片/动效资源，无需重构业务逻辑：



TypeScript

```
export interface RoleDefinition {
  id: string;
  name: string;
  camp: 'GOOD' | 'WEREWOLF' | 'NEUTRAL';
  description: string;
  visual: {
    type: 'text' | 'image';
    badgeColor: string; // 临时视觉背景色
    imageUrl?: string;  // 后续换图使用
  };
}

export const ROLE_REGISTRY: Record<string, RoleDefinition> = {
  villager: {
    id: 'villager',
    name: '村民',
    camp: 'GOOD',
    description: '没有任何特殊能力，靠白天发言与投票找出狼人。',
    visual: { type: 'text', badgeColor: '#4ade80' }
  },
  werewolf: {
    id: 'werewolf',
    name: '狼人',
    camp: 'WEREWOLF',
    description: '夜间与狼同伴一起睁眼击杀一名目标。',
    visual: { type: 'text', badgeColor: '#f87171' }
  },
  seer: {
    id: 'seer',
    name: '预言家',
    camp: 'GOOD',
    description: '每晚可以查验一名玩家的真实阵营（好人或狼人）。',
    visual: { type: 'text', badgeColor: '#60a5fa' }
  },
  witch: {
    id: 'witch',
    name: '女巫',
    camp: 'GOOD',
    description: '拥有一瓶解药和一瓶毒药，解药可救夜间被杀者，毒药可毒杀一人。',
    visual: { type: 'text', badgeColor: '#c084fc' }
  },
  hunter: {
    id: 'hunter',
    name: '猎人',
    camp: 'GOOD',
    description: '在被投票出局或被狼人杀死时，可以开枪带走场上一名玩家。',
    visual: { type: 'text', badgeColor: '#fb923c' }
  }
};
```

### 三、通信协议与状态机 (`src/types/protocol.ts`)

TypeScript

```
// 座位状态
export interface SeatState {
  seatNumber: number; // 1 ~ N
  peerId: string | null; // 绑定的玩家 ID（房主占座时为 host-id）
  playerName: string;
  isHost: boolean;
  roleId: string | null; // 房主端记录，广播给普通玩家时全部脱敏为 null
  status: 'ALIVE' | 'DEAD' | 'VOTED_OUT'; // 上帝标记状态
  tags: string[]; // 预留自定义标签，如 ['警长', '吃毒', '中刀']
}

// 房间主状态
export interface RoomState {
  roomId: string;
  gameStatus: 'SETUP' | 'READY' | 'DEALT' | 'FINISHED';
  hostMode: 'GOD_ONLY' | 'PLAYER_AND_GOD'; // 房主是否下场参战
  totalSeats: number;
  selectedRoleIds: string[]; // 选择的牌池
  seats: SeatState[];
}

// P2P 消息格式
export type ClientMessage =
  | { type: 'JOIN'; playerName: string }
  | { type: 'SELECT_SEAT'; targetSeat: number }
  | { type: 'LEAVE_SEAT' };

export type HostMessage =
  | { type: 'SYNC_ROOM_STATE'; room: Omit<RoomState, 'seats'> & { seats: Omit<SeatState, 'roleId'>[] } }
  | { type: 'ASSIGN_ROLE'; role: RoleDefinition } // 一对一下发，绝不全量广播
  | { type: 'RESET_GAME' };
```

### 四、核心逻辑设计

#### 1. 房主模式与座位自由调换

- **房主模式切换**：

  - `GOD_ONLY`：纯法官。总座位数 = 普通玩家数。
  - `PLAYER_AND_GOD`：房主既当法官也参战，总座位数扣减 1 个作为房主固有座位，或者房主直接点击一个空位将其占为己有。

- **座位调换算法**： 房主端管理 `seats` 数组。玩家进房后调用 `SELECT_SEAT` 选择空位。房主控制台拥有**强制拖拽或交换座位**的操作接口：

  TypeScript

  ```
  function swapSeats(seatIndexA: number, seatIndexB: number) {
    const nextSeats = [...roomState.seats];
    const tempPeerId = nextSeats[seatIndexA].peerId;
    const tempName = nextSeats[seatIndexA].playerName;
  
    nextSeats[seatIndexA].peerId = nextSeats[seatIndexB].peerId;
    nextSeats[seatIndexA].playerName = nextSeats[seatIndexB].playerName;
  
    nextSeats[seatIndexB].peerId = tempPeerId;
    nextSeats[seatIndexB].playerName = tempName;
  
    broadcastRoomState(nextSeats);
  }
  ```

#### 2. 安全发牌流转（防作弊）

1. 房主点击“确认发牌”，本地使用 Fisher-Yates 算法随机打乱 `selectedRoleIds`。
2. 房主遍历所有已占座的 `seats`，将打乱后的 `roleId` 映射到每个座位。
3. **分发阶段**：
   - 房主端维护包含完整 `roleId` 的完整状态。
   - 遍历连接池 `connections`，取出对应玩家的 `peerId`，通过各自的 `conn.send({ type: 'ASSIGN_ROLE', role: ROLE_REGISTRY[seat.roleId] })` 进行**单播发送**。
   - 全局广播给所有玩家的 `SYNC_ROOM_STATE` 报文中，必须强行执行 `delete seat.roleId`。

#### 3. 上帝标记与再来一局

- **状态标记**：房主端上帝面板可点击任一座位的玩家，将其状态切换为 `ALIVE` / `DEAD`。点击状态直接在房主本地更新并可同步广播给全场。
- **再来一局**：房主点击“再来一局”，无需重新建房：
  - 清除所有座位的 `roleId` 和出局状态（保留当前的排座与昵称绑定）。
  - 广播 `RESET_GAME`，玩家端回到等待发牌界面。

### 五、工程构建与 GitHub Pages 配置

#### 1. 目录结构

Plaintext

```
├── .github/
│   └── workflows/
│       └── deploy.yml          # 自动化部署 Actions
├── public/
├── src/
│   ├── config/
│   │   └── roles.ts            # 卡牌与卡面扩展配置
│   ├── hooks/
│   │   ├── usePeerHost.ts      # 房主端信令与消息调度
│   │   └── usePeerClient.ts    # 玩家端接收调度
│   ├── types/
│   │   └── protocol.ts         # 数据传输协议定义
│   ├── components/
│   │   ├── HostSetup.tsx       # 选人选牌板子配置
│   │   ├── GodDashboard.tsx    # 上帝视角记牌与标记面板
│   │   ├── SeatGrid.tsx        # 座位盘（自由选座与调位）
│   │   └── PlayerView.tsx      # 玩家专属底牌视窗
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
└── vite.config.ts
```

#### 2. `vite.config.ts` (适配 GitHub Pages 路径)

部署在 GitHub Pages 必须配置基础路由 `base` 为仓库名：



TypeScript

```
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 替换为你的仓库名称，例如 /werewolf-helper/
  base: process.env.NODE_ENV === 'production' ? '/<REPO_NAME>/' : '/',
  build: {
    outDir: 'dist',
  }
});
```

#### 3. `.github/workflows/deploy.yml` (自动部署脚本)

代码推送到 `main` 分支时触发自动构建部署，无需在本地手动推分支：



YAML

```
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 六、开发推进步骤

1. **Phase 1（数据层与通信联调）**：基于 PeerJS 实现 `Host` 建房生成 4 位房间码，`Client` 连入并完成控制台 Ping-Pong 通信。
2. **Phase 2（排座与发牌）**：完成 `HostSetup`（板子勾选）和 `SeatGrid`（点选排座），接入打乱发牌和脱敏过滤。
3. **Phase 3（上帝管理台）**：开发 `GodDashboard`，提供一键将指定座位标记为“出局/存活”的交互按钮，以及“再来一局”重置能力。
4. **Phase 4（部署验证）**：推送仓库并由 GitHub Actions 部署至 GitHub Pages，在两台真实手机上测试扫码加入与收发牌表现。