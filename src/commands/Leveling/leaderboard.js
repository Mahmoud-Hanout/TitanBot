import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('.علشان تشوف أصحاب أعلى لفلات في السيرفر')
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    await interaction.deferReply();

    const members = await interaction.guild.members.fetch().catch(() => new Map());
    const leaderboard = [];

    // جلب بيانات الليفل لكل عضو من قاعدة البيانات مباشرةً
    for (const [userId, member] of members) {
      if (member.user.bot) continue;

      const key = `${interaction.guildId}:leveling:users:${userId}`;
      const data = await client.db.get(key);

      if (data && (data.totalXp > 0 || data.level > 0)) {
        leaderboard.push({
          userId,
          level: data.level || 0,
          xp: data.xp || 0,
          totalXp: data.totalXp || 0
        });
      }
    }

    leaderboard.sort((a, b) => b.totalXp - a.totalXp);
    const top10 = leaderboard.slice(0, 10);

    if (top10.length === 0) {
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#f1c40f')
            .setDescription('مفيش بيانات ليفلات متسجلة في السيرفر لحد دلوقتي! ابدأوا شات عشان تاخدوا XP.')
        ]
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 قائمة المتصدرين في ${interaction.guild.name}`)
      .setColor('#2ecc71')
      .setDescription('أعلى 10 أعضاء تفاعلاً في السيرفر:')
      .setTimestamp();

    const leaderboardText = top10.map((user, index) => {
      const xpForNextLevel = 5 * Math.pow(user.level + 1, 2) + 50 * (user.level + 1) + 50;

      let rankPrefix = `**${index + 1}.**`;
      if (index === 0) rankPrefix = '🥇';
      else if (index === 1) rankPrefix = '🥈';
      else if (index === 2) rankPrefix = '🥉';

      return `${rankPrefix} <@${user.userId}> - Level ${user.level} (${user.xp}/${xpForNextLevel} XP)`;
    });

    embed.addFields({
      name: 'Rankings',
      value: leaderboardText.join('\n')
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
