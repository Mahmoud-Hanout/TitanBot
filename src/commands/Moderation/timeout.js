import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

const durationChoices = [
  { name: '5 دقائق', value: 5 },
  { name: '10 دقائق', value: 10 },
  { name: '30 دقيقة', value: 30 },
  { name: 'ساعة واحدة (1 Hour)', value: 60 },
  { name: '6 ساعات (6 Hours)', value: 360 },
  { name: 'يوم واحد (1 Day)', value: 1440 },
  { name: 'أسبوع واحد (1 Week)', value: 10080 }
];

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('إسكات عضو مؤقتاً (تايم أوت) لمدة محددة')
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('العضو المراد إعطاؤه تايم أوت')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('duration')
        .setDescription('مدة التايم أوت')
        .setRequired(true)
        .addChoices(...durationChoices)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('سبب التايم أوت')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  category: 'moderation',

  async execute(interaction, config, client) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('target');
    const durationMinutes = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';

    // 1. فحوصات الأمان الأساسية
    if (!targetUser) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ يجب تحديد عضو صحيح.')]
      });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ لا يمكنك إعطاء تايم أوت لنفسك.')]
      });
    }

    if (targetUser.id === client.user.id) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ لا يمكنك إعطائي تايم أوت أنا.')]
      });
    }

    if (targetUser.id === interaction.guild.ownerId) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ لا يمكن إعطاء تايم أوت لمالك السيرفر.')]
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
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ البوت لا يملك صلاحية **Moderate Members**.')]
      });
    }

    if (targetMember.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription(`❌ لا يمكن إعطاء تايم أوت للعضو **${targetUser.tag}** لأنه يمتلك صلاحية **Administrator**.`)]
      });
    }

    if (botMember.roles.highest.position <= targetMember.roles.highest.position || !targetMember.moderatable) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription(`❌ لا أستطيع إعطاء تايم أوت للعضو **${targetUser.tag}** لأن رتبته (**${targetMember.roles.highest.name}**) أعلى من رتبتي أو مساوية لها.`)
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
            .setDescription(`❌ لا يمكنك إعطاء تايم أوت للعضو **${targetUser.tag}** لأن رتبته (**${targetMember.roles.highest.name}**) أعلى من رتبتك أو مساوية لها.`)
        ]
      });
    }

    // 4. تنفيذ التايم أوت
    try {
      const durationMs = durationMinutes * 60 * 1000;
      const caseId = Math.floor(1000 + Math.random() * 9000);
      const durationDisplay = durationChoices.find((c) => c.value === durationMinutes)?.name || `${durationMinutes} دقيقة`;

      await targetMember.timeout(durationMs, `${reason} | بواسطة: ${interaction.user.tag}`);

      const successEmbed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('⏳ تم إعطاء تايم أوت للعضو بنجاح')
        .addFields(
          { name: 'العضو', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
          { name: 'المدة', value: durationDisplay, inline: true },
          { name: 'رقم القضية', value: `#${caseId}`, inline: true },
          { name: 'بواسطة', value: `${interaction.user.tag}`, inline: true },
          { name: 'السبب', value: reason, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 256 }))
        .setTimestamp();

      return interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error('Timeout Error:', error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ حدث خطأ أثناء محاولة إعطاء تايم أوت للعضو. تأكد من صلاحيات البوت.')
        ]
      });
    }
  }
};
