// ⚙️ إعدادات نظام الليفل ومنطق إضافة النقاط (XP)
export const LEVEL_CONFIG = {
  enabled: true,
  xpPerMessage: { min: 200, max: 400 },
  xpCooldown: 100,
  levelUpMessage: '🎉 مبروك يا {user}! وصلت لليفل **{level}**!',
  roleRewardMessage: '🏆 عاش يا {user}! وصلت لليفل **{level}** واستلمت رتبة',
  levelUpChannel: '1568700000148394106',
  ignoredChannels: [],
  ignoredRoles: [],
  blacklistedUsers: [],
  roleRewards: {
    "10": "1567416738021253160",
    "20": "1567416737555685536",
    "30": "1567416737094311996",
    "40": "1570269450517741689",
    "50": "1567416716114534511",
    "60": "1570265355291463752",
    "70": "1570269906438455387",
    "80": "1570269907105484940",
    "90": "1570270790845210824",
    "100": "1570270794167353564",
    "200": "1570270795207409685",
    "300": "1570271817887645746",
    "400": "1570273517662896189",
    "500": "1570273527091691570",
    "600": "1570276541869334579",
    "700": "1570276453273182339",
    "800": "1570276454007046214",
    "900": "1570276464170111096",
    "1000": "1570277554672377876",
    "2000": "1570278009301246083",
  },
  removePreviousRoles: true,
  announceLevelUp: true,
  xpMultiplier: 1,
  voiceXp: {
    enabled: true,
    xpAmount: 1000,
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

    let awardedRole = null;

  while (levelData.xp >= xpNeeded && levelData.level < 1000) {
    levelData.xp -= xpNeeded;
    levelData.level += 1;
    didLevelUp = true;
    xpNeeded = getXpForLevel(levelData.level);

    const roleId = LEVEL_CONFIG.roleRewards?.[levelData.level];
    if (roleId) {
      // إزالة الرتب القديمة من قائمة الجوائز إذا كان الخيار مفعلاً
      if (LEVEL_CONFIG.removePreviousRoles) {
        const allRewardRoles = Object.values(LEVEL_CONFIG.roleRewards).filter((id) => id !== roleId);
        for (const oldRoleId of allRewardRoles) {
          if (member.roles.cache.has(oldRoleId)) {
            await member.roles.remove(oldRoleId, `Replaced by Level ${levelData.level} reward`).catch(() => null);
          }
        }
      }

      const role = guild.roles.cache.get(roleId);
      if (role) {
        awardedRole = role;
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(role, `Level ${levelData.level} reward`).catch(() => null);
        }
      }
    }
  }

  if (didLevelUp && LEVEL_CONFIG.announceLevelUp) {
    const channel = LEVEL_CONFIG.levelUpChannel
      ? guild.channels.cache.get(LEVEL_CONFIG.levelUpChannel)
      : guild.systemChannel;

    if (channel && channel.isTextBased()) {
      // لو أخد رتبة مكافأة يبعت الرسالة الخاصة بالرتبة، غير كده يبعت رسالة الترقية العادية
      const template = awardedRole && LEVEL_CONFIG.roleRewardMessage
        ? LEVEL_CONFIG.roleRewardMessage
        : LEVEL_CONFIG.levelUpMessage;

      const msg = template
        .replace(/{user}/g, member.toString())
        .replace(/{level}/g, levelData.level)
        .replace(/{role}/g, awardedRole ? awardedRole.name : '')
        .replace(/{xp}/g, levelData.xp)
        .replace(/{xpNeeded}/g, getXpForLevel(levelData.level + 1));

      await channel.send(msg).catch(() => null);
    }
  }

  await client.db.set(key, levelData);
