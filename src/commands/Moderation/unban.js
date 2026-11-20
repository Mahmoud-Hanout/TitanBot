import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('فك الحظر (الباند) عن عضو في السيرفر')
    .addStringOption((option) =>
      option
        .setName('target')
        .setDescription('آيدي (ID) العضو المراد فك الحظر عنه')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('سبب فك الحظر')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  category: 'moderation',

  async execute(interaction, config, client) {
    await interaction.deferReply();

    const rawTarget = interaction.options.getString('target');
    const targetId = rawTarget.replace(/[<@!>]/g, '').trim();
    const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';

    // 1. التحقق من صحة الآيدي
    if (!/^\d{17,20}$/.test(targetId)) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ يرجى كتابة آيدي (ID) صحيح للعضو.')
        ]
      });
    }

    // 2. التأكد من صلاحية البوت
    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ البوت لا يملك صلاحية **Ban Members**.')
        ]
      });
    }

    // 3. التأكد من وجود العضو في قائمة المحظورين
    try {
      const bans = await interaction.guild.bans.fetch();
      const banInfo = bans.get(targetId);

      if (!banInfo) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setDescription(`❌ هذا العضو (\`${targetId}\`) غير محظور في السيرفر حالياً.`)
          ]
        });
      }

      const targetUser = banInfo.user;
      const caseId = Math.floor(1000 + Math.random() * 9000);

      // 4. تنفيذ فك الحظر
      await interaction.guild.members.unban(targetId, `${reason} | بواسطة: ${interaction.user.tag}`);

      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ تم فك الحظر عن العضو بنجاح')
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
      console.error('Unban Error:', error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ حدث خطأ أثناء محاولة فك الحظر. تأكد من صحة الآيدي وصلاحيات البوت.')
        ]
      });
    }
  }
};
