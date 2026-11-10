import { EmbedBuilder } from 'discord.js';
import { deleteBirthday } from '../../../services/birthdayService.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        const result = await deleteBirthday(client, guildId, userId);

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
            .setDescription(``تم مسح تاريخ ميلادك المسجل ب${interaction.guild.name} بنجاح`);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });
    }
};
