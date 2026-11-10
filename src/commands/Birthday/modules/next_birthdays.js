import { EmbedBuilder } from 'discord.js';
import { getUpcomingBirthdays } from '../../../services/birthdayService.js';
import { deleteBirthday } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const next5 = await getUpcomingBirthdays(client, interaction.guildId, 5);

        if (next5.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('مفيش أعياد ميلاد جايه')
                .setDescription(`مفيش أعياد ميلاد جايه لأن مفيش تواريخ متسجله في ${interaction.guild.name}`);
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
        }

        let displayIndex = 0;
        for (const birthday of next5) {
            const member = await interaction.guild.members.fetch(birthday.userId).catch(() => null);
            if (!member) {
                deleteBirthday(client, interaction.guildId, birthday.userId).catch(() => null);
                continue;
            }
            displayIndex++;

            let timeUntil = '';
            if (birthday.daysUntil === 0) {
                timeUntil = '**أنهارده**';
            } else if (birthday.daysUntil === 1) {
                timeUntil = '**بكرا**';
            } else {
                timeUntil = `${birthday.daysUntil} يوم`;
            }
        }

        if (displayIndex === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('No Upcoming Birthdays')
                .setDescription('No upcoming birthdays found for current server members.');
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
        }

        let birthdayList = `\n\nربنا يديكو و يدينا الصحه و طوله العمر مع حبايبكم\n\n`;
        displayIndex = 0;
        for (const birthday of next5) {
            const member = await interaction.guild.members.fetch(birthday.userId).catch(() => null);
            if (!member) {
                continue;
            }
            displayIndex++;

            let timeUntil = '';
            if (birthday.daysUntil === 0) {
                timeUntil = '**أنهارده**';
            } else if (birthday.daysUntil === 1) {
                timeUntil = '**بكرا**';
            } else {
                timeUntil = `${birthday.daysUntil} يوم`;
            }

            birthdayList += `رقم ${displayIndex}- ** ${member.user.username} **\n **أسم المستخدم:** <@${birthday.userId}>\n📅 **تاريخ الميلاد:** X ${birthdayData.year} ${birthdayData.monthName} ${birthdayData.day}\n⏰ **فاضل علي عيد ميلاده:** ${timeUntil}\n\n`;
        }

        birthdayList += `Use /birthday set to add your birthday!`;

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('الخمس أعياد ميلاد الجايين إن شاء الله')
            .setDescription(birthdayList);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });

        logger.info('Next birthdays retrieved successfully', {
            userId: interaction.user.id,
            guildId: interaction.guildId,
            upcomingCount: displayIndex,
            commandName: 'next_birthdays'
        });
    }
};
