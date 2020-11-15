module.exports = {
    formatUserInList: ({first_name, last_name}) => `🎁 ${first_name} ${last_name}`,
    formatUser: async (vk, user_id) => {
        const [{first_name, last_name}] = await vk.call('users.get', {user_ids: user_id});
        return `🎁 ${first_name} ${last_name}`;
    },
    offerSignUp: () => `❄️ Привет! Это бот для Тайного Санты. 🎅 Хочешь участвовать?`,
    signUpButton: () => `🌟 Участвовать в Тайном Санте!`,
    offerAccepted: () => `Отлично, теперь ты участвуешь в Тайном Санте. Список участников:`,
    alreadyAccepted: () => `Ты уже участвуешь в Тайном Санте. Список участников:`,
    targetReady: () => `🎅 Твоя новогодняя жервта уже известна!`,
    targetReadyBtn: () => `🎅 Узнать свою жертву!`,
    formatTarget: async (vk, user_id) => {
        const [{first_name, last_name}] = await vk.call('users.get', {user_ids: user_id});
        return `🎁 Твоя жертва: ${first_name} ${last_name}`;
    },
};