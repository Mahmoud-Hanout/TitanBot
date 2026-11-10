import { SlashCommandBuilder, MessageFlags, ChannelType } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import birthdaySet from './modules/birthday_set.js';
import birthdayInfo from './modules/birthday_info.js';
import birthdayList from './modules/birthday_list.js';
import birthdayRemove from './modules/birthday_remove.js';
import nextBirthdays from './modules/next_birthdays.js';
import birthdaySetchannel from './modules/birthday_setchannel.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Birthday system commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription(`لتسجيل تاريخ ميلادك في ${interaction.guild.name}`)
                .addIntegerOption(option =>
                    option
                        .setName('year')
                        .setDescription('أكتب سنة ميلادك: ما بين سنة 1900 و سنة 2034')
                        .setRequired(true)
                        .setMinValue(1900)
                        .setMaxValue(2024)
                )
                .addIntegerOption(option =>
                    option
                        .setName('month')
                        .setDescription('أكتب شهر ميلادك: ما بين شهر 1 و شهر 12')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(12)
                )
                .addIntegerOption(option =>
                    option
                        .setName('day')
                        .setDescription('أكتب يوم ميلادك: ما بين يوم 1 و يوم 31')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(31)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription(`علشان تعرف تاريخ ميلادك الشخصي المتسجل في ${interaction.guild.name} او تاريخ ميلاد شخص تاني.`)
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription(`اختار الشخص اللي عايز تعرف تاريخ ميلاده المتسجل في ${interaction.guild.name}.`)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription(`علشان تشوف قايمة فيها كل تواريخ الميلاد المسجله في ${interaction.guild.name} مع أسماء أصحابها.`)
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription(`علشان تمسح تاريخ ميلادك الشخصي المتسجل في ${interaction.guild.name} او تاريخ ميلاد شخص تاني.`)
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription(`اختار الشخص اللي عايز تمسح تاريخ ميلاده المسجل في ${interaction.guild.name}.`)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('next')
                .setDescription('Show upcoming birthdays')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription(`علشان تقفل أو تشغل احتفالات أعياد الميلاد في ${interaction.guild.name} (لازم تكون مسؤل في السيرفر).`)
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('أختار المكان اللي هيتم فيه كتابة بوست احتفال الأعياد الميلادية (سيبها فاضية لو عايز تقفلها).')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        ),

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'set':
                return await birthdaySet.execute(interaction, config, client);
            case 'info':
                return await birthdayInfo.execute(interaction, config, client);
            case 'list':
                return await birthdayList.execute(interaction, config, client);
            case 'remove':
                return await birthdayRemove.execute(interaction, config, client);
            case 'next':
                return await nextBirthdays.execute(interaction, config, client);
            case 'setchannel':
                return await birthdaySetchannel.execute(interaction, config, client);
            default:
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Unknown subcommand' });
        }
    }
};
