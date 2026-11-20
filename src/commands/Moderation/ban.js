import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('حظر عضو من السيرفر نهائياً')
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('العضو المراد حظره')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('سبب الحظر')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('delete_days')
        .setDescription('حذف رسائل العضو خلال آخر كام يوم (من 0 إلى 7 أيام)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  category: 'moderation',

  async execute(interaction, config, client) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    // 1. فحوصات الأمان الأساسية
    if (!targetUser) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ يجب تحديد عضو صحيح.')]
      });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ لا يمكنك حظر نفسك.')]
      });
    }

    if (targetUser.id === client.user.id) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ لا يمكنك حظري أنا.')]
      });
    }

    if (targetUser.id === interaction.guild.ownerId) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ لا يمكن حظر مالك السيرفر.')]
      });
    }

    // 2. التأكد من صلاحية البوت في السيرفر
    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ البوت لا يملك صلاحية **Ban Members**.')]
      });
    }

    // 3. فحص ترتيب الرتب (Hierarchy) إذا كان العضو داخل السيرفر
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (targetMember) {
      // فحص رتبة البوت مقارنة بالعضو
      if (botMember.roles.highest.position <= targetMember.roles.highest.position) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setDescription(`❌ لا أستطيع حظر **${targetUser.tag}** لأن رتبته (**${targetMember.roles.highest.name}**) أعلى من رتبتي أو مساوية لها.`)
          ]
        });
      }

      // فحص رتبة المشرف مقارنة بالعضو (إلا لو كان المشرف هو أونر السيرفر)
      if (
        interaction.guild.ownerId !== interaction.user.id &&
        interaction.member.roles.highest.position <= targetMember.roles.highest.position
      ) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setDescription(`❌ لا يمكنك حظر **${targetUser.tag}** لأن رتبته (**${targetMember.roles.highest.name}**) أعلى من رتبتك أو مساوية لها.`)
          ]
        });
      }
    }

    // 4. تنفيذ الحظر
    try {
      const caseId = Math.floor(1000 + Math.random() * 9000);

      await interaction.guild.members.ban(targetUser.id, {
        deleteMessageSeconds: deleteDays * 86400,
        reason: `${reason} | بواسطة: ${interaction.user.tag}`
      });

      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🚫 تم حظر العضو بنجاح')
        .addFields(
          { name: 'العضو', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
          { name: 'بواسطة', value: `${interaction.user.tag}`, inline: true },
          { name: 'رقم القضية', value: `#${caseId}`, inline: true },
          { name: 'السبب', value: reason, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 256 }))
        .setTimestamp();

      return interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error('Ban Error:', error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ حدث خطأ أثناء محاولة حظر العضو. تأكد من صلاحيات البوت.')
        ]
      });
    }
  }
};
