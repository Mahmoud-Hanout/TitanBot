import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('إرسال رسالة خاصة (DM) لعضو عبر البوت (للإدارة فقط)')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو المراد إرسال الرسالة إليه')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('نص الرسالة')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('anonymous')
        .setDescription('إرسال الرسالة باسم الإدارة بدون ذكر اسمك (الافتراضي: لا)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  category: 'moderation',

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetUser = interaction.options.getUser('user');
    const message = interaction.options.getString('message');
    const anonymous = interaction.options.getBoolean('anonymous') || false;

    try {
      // 1. فحوصات الأمان
      if (message.length > 2000) {
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setDescription('❌ الرسالة طويلة جداً، يجب ألا تتعدى 2000 حرف.')
          ]
        });
      }

      if (targetUser.bot) {
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setDescription('❌ لا يمكنك إرسال رسائل خاصة لحسابات البوتات.')
          ]
        });
      }

      // 2. تجهيز وإرسال الرسالة الخاصة للعضو
      const dmEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(anonymous ? `📩 رسالة من إدارة سيرفر ${interaction.guild.name}` : `📩 رسالة من ${interaction.user.tag}`)
        .setDescription(message)
        .setFooter({
          text: `سيرفر ${interaction.guild.name} • لا يمكنك الرد على هذه الرسالة`
        })
        .setTimestamp();

      await targetUser.send({ embeds: [dmEmbed] });

      // 3. تأكيد الإرسال للمشرف
      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ تم إرسال الرسالة الخاصة')
        .addFields(
          { name: 'المستلم', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
          { name: 'الوضع', value: anonymous ? 'مجهول (باسم الإدارة)' : `باسمك (${interaction.user.tag})`, inline: true },
          { name: 'الرسالة', value: message, inline: false }
        )
        .setTimestamp();

      return await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
      console.error('DM command error:', error);

      // خطأ ديسكورد 50007 يعني أن العضو قافل الخاص (DMs Disabled)
      if (error.code === 50007) {
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setDescription(`❌ تعذر إرسال الرسالة إلى **${targetUser.tag}** لأنه قافل الرسائل الخاصة (DMs).`)
          ]
        });
      }

      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription(`❌ حدث خطأ أثناء إرسال الرسالة: ${error.message}`)
        ]
      });
    }
  }
};
