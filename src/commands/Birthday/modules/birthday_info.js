import { EmbedBuilder } from 'discord.js';
import { getUserBirthday } from '../../../services/birthdayService.js';
import { logger } from '../../../utils/logger.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const targetUser = interaction.options.getUser("user") || interaction.user;
        const userId = targetUser.id;
        const guildId = interaction.guildId;

        const birthdayData = await getUserBirthday(client, guildId, userId);

        if (!birthdayData) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('للأسف مفيش تاريخ ميلاد متسجل بأسمه')
                .setDescription(targetUser.id === interaction.user.id 
                    ? "أنت لسه مدخلتش تاريخ ميلادك، استخدم الأمر `/birthday set` و بعدها دخل تاريخ الميلاد."
                    : `مفيش تاريخ ميلاد للفحل ${targetUser.username} عشان لسه مسجلش تاريخ ميلاده.`);
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('معلومات تواريخ الميلاد')
            .setDescription(`**تاريخ المستخدم:** ${birthdayData.monthName} ${birthdayData.day} ${birthdayData.year}\n**أسم المستخدم:** ${targetUser.toString()}`);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });

        logger.info('Birthday info retrieved successfully', {
            userId: interaction.user.id,
            targetUserId: targetUser.id,
            guildId,
            commandName: 'birthday_info'
        });
    }
};
