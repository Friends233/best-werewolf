import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ROLE_ORDER, ROLE_REGISTRY } from '../src/config/roles.ts';
import type { SeatState } from '../src/types/protocol.ts';
import { assignRolesWithPreferences } from '../src/utils/game.ts';

const DEAL_COUNT = 100;
const ROLE_POOL = [...ROLE_ORDER];
const CARD_BACK_ASSET = new URL('../src/assets/cardBack.jpg', import.meta.url);

function createOccupiedSeats(): SeatState[] {
  return ROLE_POOL.map((_, index) => ({
    seatNumber: index + 1,
    peerId: `test-player-${index + 1}`,
    playerName: `测试玩家${index + 1}`,
    roleId: null,
    status: 'ALIVE',
    tags: [],
  }));
}

test('卡背素材是可用的 JPEG 文件', async () => {
  const image = await readFile(CARD_BACK_ASSET);

  assert.ok(image.byteLength > 0, '卡背素材不能为空文件');
  assert.deepEqual(
    [...image.subarray(0, 3)],
    [0xff, 0xd8, 0xff],
    '卡背素材必须以 JPEG 起始标记开头',
  );
  assert.deepEqual(
    [...image.subarray(-2)],
    [0xff, 0xd9],
    '卡背素材必须以 JPEG 结束标记结尾',
  );
});

test('100 局全身份发牌统计', () => {
  const seatRoleCounts = ROLE_POOL.map(() =>
    Object.fromEntries(ROLE_POOL.map((roleId) => [roleId, 0])) as Record<string, number>,
  );
  const expectedRoles = [...ROLE_POOL].sort();

  for (let round = 1; round <= DEAL_COUNT; round += 1) {
    const dealtSeats = assignRolesWithPreferences(
      ROLE_POOL,
      createOccupiedSeats(),
      new Map(),
    );

    assert.equal(dealtSeats.length, ROLE_POOL.length, `第 ${round} 局座位数量不正确`);
    assert.ok(dealtSeats.every((seat) => seat.roleId), `第 ${round} 局存在未发牌座位`);
    assert.deepEqual(
      dealtSeats.map((seat) => seat.roleId!).sort(),
      expectedRoles,
      `第 ${round} 局没有恰好发出一张每种身份`,
    );

    dealtSeats.forEach((seat) => {
      assert.ok(seat.roleId, `第 ${round} 局 ${seat.seatNumber} 号位没有身份`);
      const counts = seatRoleCounts[seat.seatNumber - 1];
      counts[seat.roleId] += 1;
    });
  }

  seatRoleCounts.forEach((counts, seatIndex) => {
    assert.equal(
      Object.values(counts).reduce((sum, count) => sum + count, 0),
      DEAL_COUNT,
      `${seatIndex + 1} 号位统计总数不正确`,
    );
  });
  ROLE_POOL.forEach((roleId) => {
    assert.equal(
      seatRoleCounts.reduce((sum, counts) => sum + counts[roleId], 0),
      DEAL_COUNT,
      `${ROLE_REGISTRY[roleId].name} 的跨座位统计总数不正确`,
    );
  });

  const report = seatRoleCounts.map((counts, seatIndex) => {
    const row: Record<string, string | number> = { 座位: `${seatIndex + 1}号位` };
    ROLE_POOL.forEach((roleId) => {
      const count = counts[roleId];
      row[ROLE_REGISTRY[roleId].name] = `${count}次 / ${((count / DEAL_COUNT) * 100).toFixed(2)}%`;
    });
    return row;
  });

  console.log(`\n9 个身份各 1 张，完整发牌 ${DEAL_COUNT} 局，各座位身份分布：`);
  console.table(report);
});
