(async function () {
    const fs = require("fs");

    const Discord = require("discord.js");
    const bot = new Discord.Client();

    const config = require("./data/config.json");
    const commandes = require("./data/commandes.json");

    const sanitize = require("sanitize-filename");
    const childProcess = require("child_process");

    const ytb = require("ytdl-core");
    const WebSocket = require("ws");
    const wss = new WebSocket.Server({ port: config.interface.port });

    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg.setFfmpegPath(ffmpegPath);

    const GenerateImage = require("./generateImage");
    const { randomInt } = require("crypto");

    const { MongoClient } = require('mongodb');
    const uri = "mongodb://127.0.0.1:27017/?readPreference=primary&gs" +
        "sapiServiceName=mongodb&appname=MongoDB%20Compass&ssl=false";

    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    const db = client.db("CostaBot").collection("users");

    let WS;

    function startInterface() {

    }

    function startServer() {
        let child = childProcess.fork("./server.js");
        child.on("close", (code, signal) => {
            console.log("Server close with code", code, "and signal", signal);
        });
    }


    //gestion des commandes discord
    bot.on("message", async (mess) => {

        if (mess.guild.id != 664438592093028374) { return; }

        global.log("message", mess.author.username, "a dit :", mess.content);

        // xp add  
        await new Promise((resolve, reject) => {
            db.findOne({ id: mess.author.id }, { projection: { _id: 0, id: 1, xp: 1, lvl: 1 } }).then(async (user) => {
                if (user == undefined) {
                    user = await global.createUser(mess.author);
                }
                await addXp(mess.author.id, mess.createdTimestamp);
                await updateUsers(mess);

                resolve();
            }).catch((reason) => {
                reject(reason);
            });
        });

        if (!mess.author.bot) {
            let m = mess.content
            m = m.toLowerCase();
            m = m.replace(/<@\S+>/, "@cible");
            m = m.replace(/http(.*):\/\/www.youtube.com\/watch\?v=\S+/i, "LIEN_YOUTUBE");
            m = m.replace(/audio|video/i, "FORMAT");
            m = m.replace(/[0-9]+/i, "NOMBRE");

            let args = m.split(" ");

            // global.log(mess.content);
            global.log("all", m);
            if (args[0] == config.keyWord) {
                args.splice(0, 1);
                let find = false;
                commandes.forEach((commande) => {
                    if (commande.cmd == args.join(" ")) {
                        global.log("command", `${mess.author.username} a utilise la commande ${commande.name}`);
                        global[commande.action](mess);
                        find = true;
                    }

                });
                if (m.split(" ").length == 1) {
                    global["help"](mess);
                } else if (!find) {
                    mess.channel.send("Je ne connais pas cette commande\n*Faut il que je l'apprenne ?*");
                }
            }
        }
    });


    //toutes les fonctions:

    async function updateUsers(mess) {
        return new Promise((resolve, reject) => {
            db.find({}, { projection: { _id: 0, id: 1, xp: 1, rank: 1, lvl: 1 } }).toArray().then((users) => {
                // console.log(users);
                users.sort((a, b) => b.xp - a.xp);
                // console.log(users);
                users.forEach((user, i) => {
                    db.findOneAndUpdate({ id: user.id }, { $set: { rank: i + 1 } }).then(() => {
                        config.levels.forEach((level, i) => {
                            users.forEach((user) => {
                                if (user.xp >= level.xp && i > user.lvl) {
                                    db.findOneAndUpdate({ id: user.id }, { $set: { lvl: user.lvl + 1 } });
                                    user.lvl++;
                                    global["passeLvl"](mess, bot.users.cache.get(user.id));
                                }
                                if (user.xp < level.xp && i < user.lvl){
                                    db.findOneAndUpdate({ id: user.id }, { $set: { lvl: user.lvl - 1 } });
                                    user.lvl--;
                                }
                            });
                        });
                        resolve();
                    }, (reason) => reject(reason));
                });

            });
        });

    }

    global.startBot = async () => {
        await bot.login(config.token);
        let version = process.env.npm_package_version;
        await bot.user.setActivity("CostaBot v" + version);
        global.log("all", "Bot started !");
    }

    global.stopBot = () => {
        bot.destroy();
        global.log("all", "Bot stoped !");
    }

    global.log = function (type) {
        let args = Array.from(arguments);
        args.splice(0, 1);
        console.log(args.join(" "));
        if (config.interface.active) {
            try {
                WS.send(JSON.stringify({ action: "addLog", data: args.join(" "), type: type }));
            } catch (e) { console.log("error to send log at interface"); }
        }
    }

    global.test = (mess) => {
        mess.reply("test");
    }

    global.help = (mess) => {
        let message = new Discord.MessageEmbed();
        message.title = "Liste des commandes";
        message.description = "";
        commandes.forEach((commande) => {
            if (!commande.masked && commande.access == "") {
                message.description += "**" + commande.name + "** : ";
                message.description += "    " + commande.description + "\n";
                message.description += "Utilisation: *" + config.keyWord + " " + commande.cmd + "*\n";
            }
        });
        mess.channel.send(message);
    }

    global.send_m_xp = async (mess) => {
        return new Promise((resolve, reject) => {
            db.findOne({ id: mess.author.id }, { projection: { _id: 0, xp: 1, username: 1, lvl: 1, rank: 1 } }).then((user) => {
                if (user == null) { reject(new Error("User don't exist in mongo")) }
                let image = new GenerateImage.XpStatus(mess.author.displayAvatarURL({ format: "png" }), user.xp, user.username, mess.author.discriminator, user.lvl, user.rank, () => {
                    let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
                    mess.channel.send(message);
                    resolve();
                });
            });
        });
    }

    global.passeLvl = (mess, u) => {
        return new Promise((resolve, reject) => {
            global.log("levels", "level", u.lvl, "passé par", u.username);
            db.findOne({ id: u.id }, { projection: { _id: 0, xp: 1, username: 1, lvl: 1, rank: 1 } }).then((user) => {
                if (user == null) { reject(new Error("User don't exist in mongo")) }
                let image = new GenerateImage.LevelPass(u.displayAvatarURL({ format: "png" }), user.xp, user.username, u.discriminator, user.lvl, user.rank, () => {
                    let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
                    mess.channel.send(message);
                    resolve();
                });
            });
        });
    }

    global.send_xp_of = (mess) => {
        return new Promise((resolve, reject) => {
            let mentions = [];
            mess.mentions.users.array().forEach((mention) => {
                mentions.push(mention.id);
            });
            db.find({ id: { $in: mentions } }, { projection: { _id: 0, id: 1, username: 1, xp: 1, lvl: 1, rank: 1 } }).toArray().then((result) => {
                if (result == null) {
                    reject(new Error("Utilisateur introuvable"));
                }
                result.forEach((user, i) => {
                    let image = new GenerateImage.XpStatus(mess.mentions.users.array()[i].displayAvatarURL({ format: "png" }), user.xp, user.username, mess.mentions.users.array()[i].discriminator, user.lvl, user.rank, () => {
                        let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
                        mess.channel.send(message);
                    });
                });
                resolve();
            }).catch(reason => reject(reason));
        });
    }

    global.xp_reset = async (mess) => {
        return new Promise((resolve, reject) => {
            let mentions = [];
            mess.mentions.users.array().forEach((mention) => {
                mentions.push(mention.id);
            });
            db.find({ id: { $in: mentions } }, { projection: { _id: 0, id: 1, username: 1, xp: 1, lvl: 1 } }).toArray().then((result) => {
                result.forEach(async (user, i) => {
                    user.xp = 0;
                    user.lvl = 0;
                    await db.findOneAndUpdate({ id: user.id }, { $set: { xp: user.xp, lvl: user.lvl } });
                    mess.channel.send(`L'xp de ${user.username} a été reset (pas de chance...)`);
                });
                resolve();
            }).catch(reason => reject(reason));
        });
    }

    global.download = async (mess) => {
        let args = mess.content.split(" ");
        let audioCodec;
        let format;
        let videoCodec;
        let downloadFormat = "mp4";
        if (args[4] == "audio") {
            format = "mp3";
            audioCodec = "mp4a.40.2";
            videoCodec = null;
        } else if (args[4] == "video") {
            format = "mp4";
            audioCodec = "mp4a.40.2";
            videoCodec = "avc1.64001F"
        }
        let info = await ytb.getBasicInfo(args[2]);
        fs.access("./download/" + info.videoDetails.videoId + "." + format, async (err) => {
            if (err) {
                await new Promise((resolve, reject) => {
                    mess.channel.send("Telechargement en cours...");
                    let downloader = ytb(args[2], { filter: filter => { return filter.container == downloadFormat && filter.audioCodec == audioCodec && filter.videoCodec == videoCodec; } });
                    if (format == downloadFormat) {
                        downloader.pipe(fs.createWriteStream("./download/" + info.videoDetails.videoId + "." + format)).on("finish", () => {
                            fs.writeFile(__dirname + "/download/name/" + info.videoDetails.videoId, sanitize(info.videoDetails.title) + "." + format, (err) => { });
                            resolve();
                        });
                    } else {
                        ffmpeg(downloader)
                            .toFormat(format)
                            .saveToFile("./download/" + info.videoDetails.videoId + "." + format)
                            .on("end", () => {
                                fs.writeFile(__dirname + "/download/name/" + info.videoDetails.videoId, sanitize(info.videoDetails.title) + "." + format, (err) => { });
                                resolve();
                            });
                    }

                });
            }

            fs.stat("./download/" + info.videoDetails.videoId + "." + format, (err, stats) => {
                if (err) throw err;
                if (stats.size > 8000000) {
                    mess.channel.send("Fichier trop gros...\nClique ici: " + config.server.url + "download/" + info.videoDetails.videoId + "." + format);
                } else {
                    mess.channel.send("Envoi en cours...");
                    let message = new Discord.MessageAttachment("./download/" + info.videoDetails.videoId + "." + format);
                    mess.channel.send(message).catch((reason) => {
                        mess.channel.send("Erreur veuillez réessayer !");
                        console.log(reason);
                    });
                }
            });
        });
    }

    global.spam = async (mess) => {
        let x = setInterval(() => {
            mess.channel.send("ET C LE SPAM <@!" + mess.mentions.users.array()[0] + ">")
        }, 1000);
        setTimeout(() => { clearInterval(x); }, 1000 * 60 * 0.5);
    }

    global.createUser = async (user) => {
        return new Promise((resolve, reject) => {
            let newUser = {
                "username": user.username,
                "discriminator": user.discriminator,
                "id": user.id,
                "xp": 0,
                "lvl": 0,
                "lastMessage": null,
                "rank": null,
                "avatarUrl": user.displayAvatarURL({ format: "png" })
            }
            db.insertOne(newUser).then(resolve(newUser)).catch(reason => reject(reason));
        });
    }

    global.help_admin = (mess) => {
        let message = new Discord.MessageEmbed()
            .setTitle("Liste des commandes administrateurs")
            .setDescription("")
            .setColor("RED");

        commandes.forEach((commande) => {
            if (!commande.masked && commande.access == "ADMINISTRATOR") {
                message.description += "**" + commande.name + "** : ";
                message.description += "    " + commande.description + "\n";
                message.description += "Utilisation: *" + config.keyWord + " " + commande.cmd + "*\n";
            }
        });
        mess.channel.send(message);
    }

    async function addXp(id, createdTimestamp, _xp = null) {
        return new Promise((resolve, reject) => {
            db.findOne({ id: id }, { projection: { _id: 0, xp: 1, lastMessage: 1 } }).then((user) => {
                if (user == null) {
                    reject(new Error("Utilisateur introuvable"));
                }
                let add = 0;
                let xp = user.xp;
                if (user.lastMessage == null || createdTimestamp - user.lastMessage > config.antispamMs) {
                    if (_xp != null) {
                        add = _xp;
                    }
                    else {
                        add = randomInt(config.xp.min, config.xp.max);
                    }
                    xp += add;
                    user.lastMessage = createdTimestamp != Infinity ? createdTimestamp : user.lastMessage;
                }
                db.findOneAndUpdate({ id: id }, { $set: { xp: xp, lastMessage: user.lastMessage } })
                    .then(resolve(add))
                    .catch(reason => reject(reason));
            });
        });
    }

    global.add_xp = async (mess) => {
        let mention = mess.mentions.users.array()[0];
        await addXp(mention.id, Infinity, parseInt(mess.content.split(" ")[4]));
        await updateUsers(mess);
        let user = await db.findOne({ id: mention.id }, { projection: { _id: 0, xp: 1, lvl: 1, rank: 1 } });
        mess.channel.send(`${mention.username} vient de gagner ${mess.content.split(" ")[4]}xp et est` +
            ` maintenant level ${user.lvl} avec ${user.xp}xp et rang ${user.rank}`);
    }

    global.set_xp = (mess) => {
        let mention = mess.mentions.users.array()[0];
        db.findOne({ id: mention.id }, { projection: { _id: 0, xp: 1 } }).then(async (user) => {
            await addXp(mention.id, Infinity, parseInt(mess.content.split(" ")[4]) - user.xp);
            await updateUsers(mess);
            user = await db.findOne({ id: mention.id }, { projection: { _id: 0, xp: 1, lvl: 1, rank: 1 } });
            mess.channel.send(`${mention.username} a maintenant ${user.xp}xp et est maintenant level ${user.lvl} et rang ${user.rank}`);
        });

    }

    global.classement = (mess) => {
        updateUsers(mess);
        db.find({}, { _id: 0, id: 1, username: 1, discriminator: 1, avatarUrl: 1, lvl: 1, rank: 1 }).toArray().then((users) => {
            new GenerateImage.Classement(users, (image) => {
                let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
                mess.channel.send(message);
            })
        });
    }

    global.startBot();
    if (config.server.active)
        startServer();
    if (config.interface.active)
        startInterface();

    //ws

    wss.on("connection", (ws) => {
        WS = ws;
        ws.send(JSON.stringify({ action: "start", uptime: bot.uptime }));
        ws.on("message", (data) => {
            let mess = JSON.parse(data);
            if (mess.action == "func") {
                global[mess.func]();
            } else if (mess.action == "log") {
                global.log("all", mess.data);
            }
        });
    });

})()