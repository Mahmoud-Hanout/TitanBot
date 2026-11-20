import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leveladd')
    .setDescription('إضافة ليفلات لعضو معين')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('العضو المراد إضافة ليفلات له')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('levels')
        .setDescription('عدد الليفلات المراد إضافتها')
        .setRequired(true)
        .setMinValue(1)
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
    const levelsToAdd = interaction.options.getInteger('levels');

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

    const newLevel = Math.min(1000, (existingData.level || 0) + levelsToAdd);

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
      .setTitle('✅ تمت إضافة الليفلات')
      .setDescription(`تمت إضافة **${levelsToAdd}** ليفل إلى ${targetUser.tag}.\n**الليفل الجديد:** ${newLevel}`)
      .setColor(0x2ecc71)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
