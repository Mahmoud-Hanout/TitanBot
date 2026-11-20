import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('طرد عضو من السيرفر')
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('العضو المراد طرده')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('سبب الطرد')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),

  category: 'moderation',

  async execute(interaction, config, client) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';

    // 1. فحوصات الأمان الأساسية
    if (!targetUser) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ يجب تحديد عضو صحيح.')]
      });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ لا يمكنك طرد نفسك.')]
      });
    }

    if (targetUser.id === client.user.id) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ لا يمكنك طردي أنا.')]
      });
    }

    if (targetUser.id === interaction.guild.ownerId) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ لا يمكن طرد مالك السيرفر.')]
      });
    }

    // 2. جلب العضو والتأكد من وجوده في السيرفر
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ هذا العضو غير موجود في السيرفر حالياً.')]
      });
    }

    // 3. التأكد من صلاحية البوت وترتيب الرتب (Hierarchy)
    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ البوت لا يملك صلاحية **Kick Members**.')]
      });
    }

    if (botMember.roles.highest.position <= targetMember.roles.highest.position || !targetMember.kickable) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription(`❌ لا أستطيع طرد **${targetUser.tag}** لأن رتبته (**${targetMember.roles.highest.name}**) أعلى من رتبتي أو مساوية لها.`)
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
            .setDescription(`❌ لا يمكنك طرد **${targetUser.tag}** لأن رتبته (**${targetMember.roles.highest.name}**) أعلى من رتبتك أو مساوية لها.`)
        ]
      });
    }

    // 4. تنفيذ الطرد
    try {
      const caseId = Math.floor(1000 + Math.random() * 9000);

      await targetMember.kick(`${reason} | بواسطة: ${interaction.user.tag}`);

      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('👢 تم طرد العضو بنجاح')
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
      console.error('Kick Error:', error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ حدث خطأ أثناء محاولة طرد العضو. تأكد من صلاحيات البوت.')
        ]
      });
    }
  }
};
