import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// ⚙️ إعدادات نظام الليفل (عدّل براحتك من هنا)
export const LEVEL_CONFIG = {
  enabled: true,
  xpPerMessage: { min: 15, max: 25 },
  xpCooldown: 20, // بالثواني
  levelUpMessage: '🎉 مبروك يا {user}! وصلت لليفل **{level}**!',
  levelUpChannel: 'ضع_هنا_آيدي_روم_الترقيات_أو_اتركها_فارغة',
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

export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('عرض ليفلك أو ليفل عضو آخر في السيرفر')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('العضو المراد عرض ليفله')
        .setRequired(false)
    )
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!member) {
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ هذا العضو غير موجود في السيرفر.')
        ]
      });
    }

    const key = `${interaction.guildId}:leveling:users:${targetUser.id}`;
    const userData = (await client.db.get(key)) || { level: 0, xp: 0, totalXp: 0 };

    const safeUserData = {
      level: userData?.level ?? 0,
      xp: userData?.xp ?? 0,
      totalXp: userData?.totalXp ?? 0
    };

    const nextLevel = safeUserData.level + 1;
    const xpNeeded = getXpForLevel(nextLevel);
    const progress = xpNeeded > 0 ? Math.min(100, Math.max(0, Math.floor((safeUserData.xp / xpNeeded) * 100))) : 0;

    const filled = Math.round((progress / 100) * 20);
    const progressBar = '█'.repeat(filled) + '░'.repeat(20 - filled);

    const embed = new EmbedBuilder()
      .setTitle(`📊 مستوى ${member.displayName}`)
      .setThumbnail(member.displayAvatarURL({ extension: 'png', size: 256 }))
      .addFields(
        { name: 'الليفل', value: safeUserData.level.toString(), inline: true },
        { name: 'نقاط الخبرة (XP)', value: `${safeUserData.xp}/${xpNeeded}`, inline: true },
        { name: 'إجمالي الـ XP', value: safeUserData.totalXp.toString(), inline: true },
        { name: `التقدم نحو ليفل ${nextLevel}`, value: `${progressBar} **${progress}%**` }
      )
      .setColor(0x2ecc71)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
