// ⚙️ إعدادات نظام الليفل ومنطق إضافة النقاط (XP)
export const LEVEL_CONFIG = {
  enabled: true,
  xpPerMessage: { min: 150, max: 250 },
  xpCooldown: 1, // بالثواني
  levelUpMessage: '🎉 مبروك يا {user}! وصلت لليفل **{level}**!',
  levelUpChannel: '1568700000148394106',
  ignoredChannels: [],
  ignoredRoles: [],
  blacklistedUsers: [],
  roleRewards: {
    // "5": "آيدي_الرتبة"
  },
  announceLevelUp: true,
  xpMultiplier: 1,
  voiceXp: {
    enabled: true,
    xpAmount: 200,
    intervalMinutes: 5
  }
};

export const getXpForLevel = (level) => 5 * Math.pow(level, 2) + 50 * level + 50;

export async function addXp(client, guild, member, xpToAdd) {
  if (!LEVEL_CONFIG.enabled || !xpToAdd || xpToAdd <= 0 || !member) return null;

  const key = `${guild.id}:leveling:users:${member.user.id}`;
  const levelData = (await client.db.get(key)) || { xp: 0, level: 0, totalXp: 0, lastMessage: 0 };

  levelData.xp = (levelData.xp || 0) + xpToAdd;
  levelData.totalXp = (levelData.totalXp || 0) + xpToAdd;
  levelData.lastMessage = Date.now();

  let xpNeeded = getXpForLevel(levelData.level || 0);
  let didLevelUp = false;

  while (levelData.xp >= xpNeeded && levelData.level < 1000) {
    levelData.xp -= xpNeeded;
    levelData.level += 1;
    didLevelUp = true;
    xpNeeded = getXpForLevel(levelData.level);

    const roleId = LEVEL_CONFIG.roleRewards?.[levelData.level];
    if (roleId) {
      const role = guild.roles.cache.get(roleId);
      if (role && !member.roles.cache.has(roleId)) {
        await member.roles.add(role, `Level ${levelData.level} reward`).catch(() => null);
      }
    }
  }

  if (didLevelUp && LEVEL_CONFIG.announceLevelUp) {
    const channel = LEVEL_CONFIG.levelUpChannel
      ? guild.channels.cache.get(LEVEL_CONFIG.levelUpChannel)
      : guild.systemChannel;

    if (channel && channel.isTextBased()) {
      const msg = LEVEL_CONFIG.levelUpMessage
        .replace(/{user}/g, member.toString())
        .replace(/{level}/g, levelData.level)
        .replace(/{xp}/g, levelData.xp)
        .replace(/{xpNeeded}/g, getXpForLevel(levelData.level + 1));

      await channel.send(msg).catch(() => null);
    }
  }

  await client.db.set(key, levelData);
  return { ...levelData, leveledUp: didLevelUp };
}
