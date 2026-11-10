export const GREET_CONFIG = {
    welcome: {
        channelId: "1321428134091952169", 
        message: "منور يا {user} في سيرفرنا الرائع! دلوقتي عددنا بقى {memberCount}", 
        image: "https://cdn.discordapp.com/attachments/882077635902079076/1569813662359621652/Untitled-1.png?ex=6af4d266&is=6af380e6&hm=77dd9d9fba76ddab192719ef5bbfbc7b2615399c1fe31f476917d0020ccce59b&", // رابط صورة الترحيب (سيبه فاضي "" لو مش عايز صورة)
        ping: true // لو عايزه يعمل منشن للعضو وهو داخل خليها true، لو مش عايزه خليها false
    },
  
    goodbye: {
        channelId: "1321428149602488391", 
        message: "للاسف {username} غادر السيرفر.. الحسابات المتبقية: {memberCount}", 
        image: "https://cdn.discordapp.com/attachments/882077635902079076/1569813662359621652/Untitled-1.png?ex=6af4d266&is=6af380e6&hm=77dd9d9fba76ddab192719ef5bbfbc7b2615399c1fe31f476917d0020ccce59b&", // رابط صورة المغادرة لو عايز (أو سيبه فاضي "")
        ping: true
    },

    // ⚡ إعدادات الرتبة التلقائية (الأوتو رول للأعضاء الجدد)
    autorole: {
        roleId: "" 
    }
};
