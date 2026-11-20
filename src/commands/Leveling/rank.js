import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

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
    const xpNeeded = 5 * Math.pow(nextLevel, 2) + 50 * nextLevel + 50;
    const progress = xpNeeded > 0 ? Math.min(100, Math.max(0, Math.floor((safeUserData.xp / xpNeeded) * 100))) : 0;

    const filled = Math.round((progress / 100) * 20);
    const progressBar = '█'.repeat(filled) + '░'.repeat(20 - filled);

    const embed = new EmbedBuilder()
      .setTitle(`📊 مستوى ${member.displayName}`)
      .setThumbnail(member.displayAvatarURL({ extension: 'png', size: 256 }))
      .addFields(
        {
          name: 'الليفل',
          value: safeUserData.level.toString(),
          inline: true
        },
        {
          name: 'نقاط الخبرة (XP)',
          value: `${safeUserData.xp}/${xpNeeded}`,
          inline: true
        },
        {
          name: 'إجمالي الـ XP',
          value: safeUserData.totalXp.toString(),
          inline: true
        },
        {
          name: `التقدم نحو ليفل ${nextLevel}`,
          value: `${progressBar} **${progress}%**`
        }
      )
      .setColor(0x2ecc71)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
