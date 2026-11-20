import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags
} from 'discord.js';
import { LEVEL_CONFIG } from './levelConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('levelreset')
    .setDescription('تصفير ليفل عضو معين أو تصفير ليفلات السيرفر بالكامل (للإدارة فقط)')
    .addSubcommand((sub) =>
      sub
        .setName('user')
        .setDescription('تصفير ليفل وـ XP عضو معين')
        .addUserOption((option) =>
          option
            .setName('target')
            .setDescription('العضو المراد تصفير ليفله')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('server')
        .setDescription('تصفير ليفلات جميع أعضاء السيرفر بالكامل')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  category: 'Leveling',

  async execute(interaction, config, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ تحتاج إلى صلاحية **Manage Server** لاستخدام هذا الأمر.')
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'user') {
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('target');
      const key = `${interaction.guildId}:leveling:users:${targetUser.id}`;

      await client.db.set(key, {
        xp: 0,
        level: 0,
        totalXp: 0,
        lastMessage: 0
      });

      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (member && LEVEL_CONFIG?.roleRewards) {
        const rewardRoleIds = Object.values(LEVEL_CONFIG.roleRewards);
        for (const roleId of rewardRoleIds) {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId, 'Level reset by admin').catch(() => null);
          }
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🔄 تم تصفير ليفل العضو')
        .setDescription(`تم تصفير ليفل ونقاط خبرة **${targetUser.tag}** إلى **0** بنجاح.`)
        .setTimestamp();

      return await interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'server') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const confirmEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('⚠️ تحذير: تصفير ليفلات السيرفر بالكامل')
        .setDescription(
          'هل أنت متأكد أنك تريد تصفير ليفلات وـ XP **جميع أعضاء السيرفر**؟\n' +
          'هذا الإجراء **لا يمكن التراجع عنه**!'
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_server_reset')
          .setLabel('✅ نعم، صفّر الكل')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_server_reset')
          .setLabel('❌ إلغاء')
          .setStyle(ButtonStyle.Secondary)
      );

      const replyMsg = await interaction.editReply({
        embeds: [confirmEmbed],
        components: [row]
      });

      const collector = replyMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000,
        max: 1
      });

      collector.on('collect', async (btnInteraction) => {
        if (btnInteraction.user.id !== interaction.user.id) return;

        if (btnInteraction.customId === 'cancel_server_reset') {
          return await btnInteraction.update({
            embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('✅ تم إلغاء عملية التصفير.')],
            components: []
          });
        }

        if (btnInteraction.customId === 'confirm_server_reset') {
          await btnInteraction.update({
            embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription('⏳ جاري تصفير بيانات جميع الأعضاء...')],
            components: []
          });

          const members = await interaction.guild.members.fetch().catch(() => new Map());
          const rewardRoleIds = LEVEL_CONFIG?.roleRewards ? Object.values(LEVEL_CONFIG.roleRewards) : [];
          let resetCount = 0;

          for (const [userId, member] of members) {
            if (member.user.bot) continue;

            const key = `${interaction.guildId}:leveling:users:${userId}`;
            const existing = await client.db.get(key);
            if (existing && (existing.totalXp > 0 || existing.level > 0)) {
              await client.db.delete(key);
              resetCount++;
            }

            for (const roleId of rewardRoleIds) {
              if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId, 'Server level reset by admin').catch(() => null);
              }
            }
          }

          return await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🔄 تم تصفير السيرفر بالكامل')
                .setDescription(`تم تصفير بيانات الليفل لـ **${resetCount}** عضو وسحب رتب المكافآت بنجاح.`)
                .setTimestamp()
            ],
            components: []
          });
        }
      });

      collector.on('end', async (collected) => {
        if (collected.size === 0) {
          await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('⌛ انتهى وقت التأكيد، تم إلغاء العملية.')],
            components: []
          }).catch(() => null);
        }
      });
    }
  }
};
