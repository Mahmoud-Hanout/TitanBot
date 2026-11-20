import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('فك التايم أوت (الإسكات المؤقت) عن عضو في السيرفر')
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('العضو المراد فك التايم أوت عنه')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('سبب فك التايم أوت')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  category: 'moderation',

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'تم فك التايم أوت بواسطة الإدارة';

    // 1. جلب العضو والتأكد من وجوده في السيرفر
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ هذا العضو غير موجود في السيرفر حالياً.')]
      });
    }

    // 2. التأكد من صلاحية البوت وترتيب الرتب (Hierarchy)
    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ البوت لا يملك صلاحية **Moderate Members**.')]
      });
    }

    if (botMember.roles.highest.position <= targetMember.roles.highest.position || !targetMember.moderatable) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription(`❌ لا أستطيع تعديل حالة **${targetUser.tag}** لأن رتبته (**${targetMember.roles.highest.name}**) أعلى من رتبتي أو مساوية لها.`)
        ]
      });
    }

    if (
      interaction.guild.ownerId !== interaction.user.id &&
      interaction.member.roles.highest.position <= targetMember.roles.highest.position
    ) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription(`❌ لا يمكنك فك التايم أوت عن **${targetUser.tag}** لأن رتبته (**${targetMember.roles.highest.name}**) أعلى من رتبتك أو مساوية لها.`)
        ]
      });
    }

    // 3. التأكد من أن العضو عليه تايم أوت بالفعل
    if (!targetMember.isCommunicationDisabled()) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setDescription(`⚠️ العضو **${targetUser.tag}** ليس عليه تايم أوت حالياً.`)
        ]
      });
    }

    // 4. تنفيذ فك التايم أوت
    try {
      await targetMember.timeout(null, `${reason} | بواسطة: ${interaction.user.tag}`);

      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🔓 تم فك التايم أوت عن العضو بنجاح')
        .addFields(
          { name: 'العضو', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
          { name: 'بواسطة', value: `${interaction.user.tag}`, inline: true },
          { name: 'السبب', value: reason, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 256 }))
        .setTimestamp();

      return interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error('Untimeout Error:', error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ حدث خطأ أثناء محاولة فك التايم أوت. تأكد من صلاحيات البوت.')
        ]
      });
    }
  }
};
