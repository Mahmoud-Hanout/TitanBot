import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('حذف عدد معين من الرسائل في الروم')
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('عدد الرسائل المراد حذفها (من 1 إلى 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  category: 'moderation',

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const amount = interaction.options.getInteger('amount');
    const channel = interaction.channel;

    // التأكد من صلاحية البوت لحذف الرسائل
    const botMember = interaction.guild.members.me;
    if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.ManageMessages)) {
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ البوت لا يملك صلاحية **Manage Messages** في هذه الروم.')
        ]
      });
    }

    try {
      const fetched = await channel.messages.fetch({ limit: amount });
      const deleted = await channel.bulkDelete(fetched, true);
      const deletedCount = deleted.size;

      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🧹 تم مسح الرسائل بنجاح')
        .setDescription(`تم حذف **${deletedCount}** رسالة في ${channel}.`)
        .setFooter({ text: 'ستختفي هذه الرسالة تلقائياً خلال 3 ثوانٍ' })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

      setTimeout(() => {
        interaction.deleteReply().catch(() => null);
      }, 3000);

    } catch (error) {
      console.error('Clear command error:', error);
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ حدث خطأ أثناء مسح الرسائل. ملاحظة: ديسكورد يمنع حذف الرسائل الأقدم من 14 يوماً تلقائياً.')
        ]
      });
    }
  }
};
