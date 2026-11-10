import { EmbedBuilder } from 'discord.js';
import { deleteBirthday } from '../../../services/birthdayService.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isSelf = targetUser.id === interaction.user.id;
        const guildId = interaction.guildId;

        // السماح لصاحب السيرفر فقط بمسح تاريخ ميلاد أي عضو آخر
        if (!isSelf && interaction.user.id !== interaction.guild.ownerId) {
            const noPermEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('غير مسموح')
                .setDescription('صاحب السيرفر فقط هو من يملك صلاحية مسح تاريخ ميلاد عضو آخر.');

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [noPermEmbed]
            });
        }

        const result = await deleteBirthday(client, guildId, targetUser.id);

        if (result.status === 'not_found') {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('غير موجود')
                .setDescription(isSelf
                    ? 'مش موجود ليك تاريخ ميلاد مسجل اصلا علشان تمسحه.'
                    : `العضو ${targetUser.toString()} معندوش تاريخ ميلاد مسجل اصلا.`);

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('تم المسح')
            .setDescription(isSelf
                ? `تم مسح تاريخ ميلادك المسجل في ${interaction.guild.name} بنجاح.`
                : `تم مسح تاريخ ميلاد العضو ${targetUser.toString()} من السيرفر بنجاح.`);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });
    }
};
