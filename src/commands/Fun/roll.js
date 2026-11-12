import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('يطلعلك رقم عشوائي من 0 لـ 100'),
  category: 'Fun',

  async execute(interaction) {
    await InteractionHelper.safeDefer(interaction);

    const randomNumber = Math.floor(Math.random() * 101);

    const embed = successEmbed(
      'الرقم:',
      `الفحل ${interaction.user} رمى الزهر اللي معاه و طلعله **${randomNumber}**`
    );

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    logger.debug(`Simple roll (${randomNumber}) executed by user ${interaction.user.id}`);
  },
};
