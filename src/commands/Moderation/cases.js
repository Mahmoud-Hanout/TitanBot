import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';

// دالة مساعدة لحفظ القضية في قاعدة البيانات (يمكن استدعاؤها من أوامر ban / kick / timeout)
export async function saveCase(client, guildId, caseData) {
  if (!client?.db) return;
  try {
    const key = `moderation_cases_list_${guildId}`;
    const list = (await client.db.get(key)) || [];
    list.push({
      ...caseData,
      createdAt: new Date().toISOString()
    });
    if (list.length > 1000) list.splice(0, list.length - 1000);
    await client.db.set(key, list);
  } catch (err) {
    console.error('Error saving moderation case:', err);
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription('عرض سجل القضايا والمخالفات الإدارية في السيرفر')
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
    .setDMPermission(false)
    .addStringOption(option =>
      option
        .setName('filter')
        .setDescription('تصفية القضايا حسب النوع')
        .addChoices(
          { name: '📋 الكل', value: 'all' },
          { name: '🚫 الباند (Bans)', value: 'Member Banned' },
          { name: '👢 الطرد (Kicks)', value: 'Member Kicked' },
          { name: '⏳ التايم أوت (Timeouts)', value: 'Member Timed Out' },
          { name: '⚠️ التحذيرات (Warnings)', value: 'User Warned' }
        )
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('تصفية القضايا لعضو معين')
    )
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('عدد القضايا المراد عرضها (الافتراضي: 10)')
        .setMinValue(1)
        .setMaxValue(50)
    ),

  category: 'moderation',

  async execute(interaction, config, client) {
    await interaction.deferReply();

    try {
      const filterType = interaction.options.getString('filter') || 'all';
      const targetUser = interaction.options.getUser('user');
      const limit = interaction.options.getInteger('limit') || 10;

      // جلب القضايا من قاعدة البيانات مباشرةً بدون ملفات خارجية
      const caseListKey = `moderation_cases_list_${interaction.guild.id}`;
      let cases = (await client.db?.get(caseListKey)) || [];

      if (targetUser) {
        cases = cases.filter(c => c.targetUserId === targetUser.id);
      }

      if (filterType !== 'all') {
        cases = cases.filter(c => c.action === filterType);
      }

      cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      cases = cases.slice(0, limit);

      // الرد برسالة واضحة إذا لم توجد قضايا مسجلة
      if (cases.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle('📋 سجل القضايا الإدارية')
          .setDescription(
            targetUser
              ? `لا توجد أي قضايا مسجلة للعضو **${targetUser.tag}** حالياً.`
              : `لا توجد أي قضايا مسجلة في سيرفر **${interaction.guild.name}** حالياً.`
          )
          .setTimestamp();

        return await interaction.editReply({ embeds: [emptyEmbed] });
      }

      const CASES_PER_PAGE = 5;
      const totalPages = Math.ceil(cases.length / CASES_PER_PAGE);
      let currentPage = 1;

      const createCasesEmbed = (page) => {
        const startIndex = (page - 1) * CASES_PER_PAGE;
        const pageCases = cases.slice(startIndex, startIndex + CASES_PER_PAGE);

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('📋 سجل القضايا الإدارية')
          .setDescription(`عرض القضايا المسجلة في **${interaction.guild.name}**\n\n**صفحة ${page} من ${totalPages}**`)
          .setTimestamp();

        pageCases.forEach(case_ => {
          const dateObj = new Date(case_.createdAt);
          const date = dateObj.toLocaleDateString('ar-EG');
          const time = dateObj.toLocaleTimeString('ar-EG');

          embed.addFields({
            name: `قضية #${case_.caseId} - ${case_.action}`,
            value: `**العضو:** ${case_.target}\n**المشرف:** ${case_.executor}\n**التاريخ:** ${date} الساعة ${time}\n**السبب:** ${case_.reason || 'لم يتم تحديد سبب'}`,
            inline: false
          });
        });

        embed.setFooter({
          text: `إجمالي القضايا: ${cases.length} | التصفية: ${filterType}${targetUser ? ` | العضو: ${targetUser.tag}` : ''}`
        });

        return embed;
      };

      const createNavigationRow = (page) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('⬅️ السابق')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 1),
          new ButtonBuilder()
            .setCustomId('page_info')
            .setLabel(`صفحة ${page}/${totalPages}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('التالي ➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages)
        );
      };

      const message = await interaction.editReply({
        embeds: [createCasesEmbed(currentPage)],
        components: [createNavigationRow(currentPage)]
      });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000
      });

      collector.on('collect', async (buttonInteraction) => {
        await buttonInteraction.deferUpdate();

        if (buttonInteraction.user.id !== interaction.user.id) {
          return await buttonInteraction.followUp({
            content: '❌ لا يمكنك التحكم في هذه الأزرار. اكتب `/cases` لعرض قائمتك الخاصة.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (buttonInteraction.customId === 'prev_page' && currentPage > 1) {
          currentPage--;
        } else if (buttonInteraction.customId === 'next_page' && currentPage < totalPages) {
          currentPage++;
        }

        await interaction.editReply({
          embeds: [createCasesEmbed(currentPage)],
          components: [createNavigationRow(currentPage)]
        });
      });

      collector.on('end', async () => {
        const disabledRow = createNavigationRow(currentPage);
        disabledRow.components.forEach(btn => btn.setDisabled(true));
        await message.edit({ components: [disabledRow] }).catch(() => null);
      });

    } catch (error) {
      console.error('Error in cases command:', error);
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ حدث خطأ أثناء جلب سجل القضايا. حاول مرة أخرى لاحقاً.')
        ]
      });
    }
  }
};
