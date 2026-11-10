import { EmbedBuilder } from 'discord.js';
import { deleteBirthday } from '../../../services/birthdayService.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isSelf = targetUser.id === interaction.user.id;
        const guildId = interaction.guildId;

        if (!isSelf) {
            const isOwner = interaction.user.id === interaction.guild.ownerId;
            const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
                            interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

            if (!isOwner && !isAdmin) {
                const noPermEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('غير مسموح')
                    .setDescription('مينفعش تمسح تاريخ ميلاد شخص تاني غيرك علشان مش معاك الصلاحية اللي تخليك تعمل كدا.');
                
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [noPermEmbed]
                });
            }
        }

        const result = await deleteBirthday(client, guildId, targetUser.id);

        if (result.status === 'not_found') {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('غير موجود')
                .setDescription('مش موجود ليك تاريخ ميلاد مسجل اصلا علشان تمسحه.');
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('تم المسح')
            .setDescription(`تم مسح تاريخ ميلادك المسجل في ${interaction.guild.name} بنجاح.`);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });
    }
};
