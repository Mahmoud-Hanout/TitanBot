import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';

const TEXT_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement
];

export default {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('إرسال رسالة نصية باسم البوت في أي روم')
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('نص الرسالة التي سيرسلها البوت')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('الروم المراد الإرسال فيها (الافتراضي: الروم الحالية)')
        .addChannelTypes(...TEXT_CHANNEL_TYPES)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  category: 'moderation',

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const message = interaction.options.getString('message')?.trim();
    if (!message) {
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ لا يمكن إرسال رسالة فارغة.')
        ]
      });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    if (!channel || !TEXT_CHANNEL_TYPES.includes(channel.type)) {
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ يرجى اختيار روم نصية صالحة أو تنفيذ الأمر داخل روم نصية.')
        ]
      });
    }

    // فحص صلاحيات المشرف وصلاحيات البوت في الروم المستهدفة
    const memberPermissions = channel.permissionsFor(interaction.member);
    const botPermissions = channel.permissionsFor(interaction.guild.members.me);

    if (!memberPermissions?.has(PermissionFlagsBits.SendMessages)) {
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription(`❌ ليس لديك صلاحية إرسال رسائل في ${channel}.`)
        ]
      });
    }

    if (!botPermissions?.has(PermissionFlagsBits.SendMessages)) {
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription(`❌ البوت لا يملك صلاحية إرسال رسائل في ${channel}.`)
        ]
      });
    }

    try {
      const sentMessage = await channel.send({ content: message });

      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ تم إرسال الرسالة بنجاح')
        .setDescription(`تم نشر الرسالة في ${channel}.\n🔗 [الانتقال إلى الرسالة](${sentMessage.url})`)
        .setTimestamp();

      return await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error('Say command error:', error);
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
