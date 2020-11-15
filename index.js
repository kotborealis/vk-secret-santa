const config = require('./.config.js');
const VK = require('minvk');
const md5 = require('md5');
const btoa = require('btoa');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const l10n = require('./localization');
const debug = require('debug')('secret-santa');

const db = low(new FileSync('data/db.json'));
db.defaults({users: [], santa: []}).write();

process.on('unhandledRejection', error => {
    console.error('unhandledRejection', error.message);
});

debug("Initializing VK", config);

const vk = new VK.community({
    access_token: config.vk_api_token, // access_token for community with at least manage and messages rights
    group_id: config.vk_group_id * 1, // id of group
    url: config.vk_hook_url, // web-hook url
    server_id: config.vk_server_id, // server id from vk interface
    port: config.vk_server_port * 1, // port of callback server
    secret_key: config.vk_secret_key, // secret key
});

const usersHandledByReply = new Set;
const replyFrom = ({user_id}) => new Promise(resolve => {
    debug("Awaiting reply from user", user_id);
    usersHandledByReply.add(user_id);
    vk.once('message_new', (message) => {
        if(message.user_id === user_id){
            debug("Awaited reply from user", user_id, message);
            usersHandledByReply.delete(user_id);
            resolve(message);
        }
    });
});

const shuffleArray = arr => arr
    .map(a => [Math.random(), a])
    .sort((a, b) => a[0] - b[0])
    .map(a => a[1]);

const formatUsersList = async (users = db.get('users').value()) =>
    (await Promise.all(users.map(async user_id => await vk.call('users.get', {user_ids: user_id}))))
        .map(([_]) => _)
        .map(l10n.formatUserInList)
        .join('\n');

async function commandGenerate(santaGenerated, user_id) {
    debug("/generate", user_id);
    if(!santaGenerated){
        debug("Generating new santa hashmap");
        const users = db.get('users').value();
        const usersBag = shuffleArray(users);
        const usersCycledBag = [...usersBag, usersBag[0]];

        const santa = {};
        for(let i = 0; i < usersCycledBag.length - 1; i++){
            const hash = md5(usersCycledBag[i]);
            debug(`user-hash ${hash} sends gift to ${usersCycledBag[i + 1]}`);
            santa[hash] = usersCycledBag[i + 1];
        }

        db.set('santa', santa).write();

        await vk.call('messages.send', {
            message: `Generated!`,
            user_id,
        });

        debug("Sending notifications");
        users.forEach(user_id => {
            debug("Sending notification to", user_id);
            sendTarget(user_id);
        });
    }
    else{
        debug("Already generated, not doing anything");
        await vk.call('messages.send', {
            message: `!Already generated!`,
            user_id,
        });
    }
}

async function userAlreadyExists(user_id) {
    debug("User already exists", user_id);
    await vk.call('messages.send', {
        message: l10n.alreadyAccepted(),
        user_id,
    });
    await vk.call('messages.send', {
        message: await formatUsersList(),
        user_id,
    });
}

async function userSignUp(user_id) {
    debug("User sign up", user_id);
    await vk.call('messages.send', {
        message: l10n.offerSignUp(),
        user_id,
        keyboard: JSON.stringify({
            inline: true,
            buttons: [[{
                action: {
                    type: 'text',
                    label: l10n.signUpButton(),
                    payload: "{}"
                }
            }]]
        })
    });

    const {body} = await replyFrom({user_id});
    if(
        body !== l10n.signUpButton()
        &&
        /да|хочу/.test(body) === false
    ) return;

    if(db.get('users').value().indexOf(user_id) < 0)
        db.get('users').push(user_id).write();

    debug("registered user", user_id);

    await vk.call('messages.send', {
        message: l10n.offerAccepted(),
        user_id,
    });
    await vk.call('messages.send', {
        message: await formatUsersList(),
        user_id,
    });
}

async function sendTarget(user_id) {
    debug("Sending target to", user_id);
    const to = db.get('santa').value()[md5(user_id)];
    await vk.call('messages.send', {
        message: l10n.targetReady(),
        user_id,
        keyboard: JSON.stringify({
            inline: true,
            buttons: [[{
                action: {
                    type: 'open_link',
                    payload: "{\"type\": \"get\"}",
                    label: l10n.targetReadyBtn(),
                    link: `${config.secret_santa_target_page}#${
                        btoa(
                            encodeURIComponent(await l10n.formatTarget(vk, to))
                        )
                    }`
                }
            }]]
        })
    });
}

vk.init().then(async () => {
    vk.on('message_new', async message => {
        const {user_id} = message;
        if(usersHandledByReply.has(user_id)) return;

        const santaGenerated = Object.keys(db.get('santa').value()).length > 0;
        const userExists = db.get('users').value().indexOf(user_id) >= 0;

        if(message.body === `/generate`)
            return await commandGenerate(santaGenerated, user_id);

        if(userExists && !santaGenerated)
            return await userAlreadyExists(user_id);

        if(!userExists && !santaGenerated)
            return await userSignUp(user_id);

        if(userExists && santaGenerated)
            return await sendTarget(user_id);
    });
});
