import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('levelset')
    .setDescription('تحديد ليفل معين لعضو')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('العضو المراد تحديد الليفل له')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('level')
        .setDescription('رقم الليفل الجديد')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(1000)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    await interaction.deferReply();

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ تحتاج إلى صلاحية **Manage Server** لاستخدام هذا الأمر.')
        ]
      });
    }

    const targetUser = interaction.options.getUser('user');
    const newLevel = interaction.options.getInteger('level');

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
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
    const existingData = (await client.db.get(key)) || { xp: 0, level: 0, totalXp: 0, lastMessage: 0 };

    // حساب إجمالي الـ XP لليفل الجديد بنفس معادلة السيرفر
    let newTotalXp = 0;
    for (let i = 0; i < newLevel; i++) {
      newTotalXp += 5 * Math.pow(i, 2) + 50 * i + 50;
    }

    const updatedData = {
      xp: 0,
      level: newLevel,
      totalXp: newTotalXp,
      lastMessage: existingData.lastMessage || 0
    };

    await client.db.set(key, updatedData);

    const embed = new EmbedBuilder()
      .setTitle('✅ تم تحديد الليفل بنجاح')
      .setDescription(`تم تحديد ليفل ${targetUser.tag} إلى **${newLevel}**.\n**إجمالي الـ XP:** ${newTotalXp}`)
      .setColor(0x2ecc71)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
