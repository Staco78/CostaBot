const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const { scrapePlaylist } = require("youtube-playlist-scraper");
const { getUrlfromText } = require("tts-googlehome");


class Player {
    constructor(mess = new Discord.Message()) {
        if (!mess.channel)
            this.channel = mess;
        else
            this.channel = mess.channel;
        this.queue = [];
        this.historique = [];
        this.playing = false;
        this.volume = 1;
        this.message = new Discord.MessageEmbed()
            .setTitle("Aucune musique en lecture")
            .setDescription("")
        let link = mess.content.match(/https?:\/\/www.youtube.com\/watch\?v=\S+/);
        let list = mess.content.match(/https?:\/\/www.youtube.com\/playlist\?list=(\S+)/);
        if (link) {
            new Music(link).getInfo().then(music => {
                this.queue = [music]
                this.message = new Discord.MessageEmbed()
                    .setTitle("En attente...")
                    .setDescription(music.title)
                    .addField("De:", music.author.name)
                    .setThumbnail(music.minia)
                    .setFooter(`Durée: ${music.length.minutes}:${music.length.secondes}`);
                this.send();
            });
        } else if (list) {
            scrapePlaylist(list[1]).then(async result => {
                // console.log(result);
                this.queue = []
                await new Promise((resolve, reject) => {
                    result.playlist.forEach(async(r, i) => {
                        let music = await new Music(r.url).getInfo()
                        this.queue.push(music)
                        if (i == result.playlist.length - 1)
                            resolve();
                    });
                });
                this.message = new Discord.MessageEmbed()
                    .setTitle("En attente...")
                    .setDescription(this.queue[0].title)
                    .addField("De:", this.queue[0].author.name)
                    .setThumbnail(this.queue[0].minia)
                    .setFooter(`Durée: ${this.queue[0].length.minutes}:${this.queue[0].length.secondes}`);
                this.send();
            });
        } else
            this.send();


    }
    send() {
        return new Promise(async(resolve, reject) => {
            this.sentMess = await this.channel.send(this.message);
            Promise.all([
                this.sentMess.react("⏪"),
                this.sentMess.react("▶️"),
                this.sentMess.react("⏯️"),
                this.sentMess.react("⏹️"),
                this.sentMess.react("⏩"),
                this.sentMess.react("➕"),
                this.sentMess.react("🔉"),
                this.sentMess.react("🔊")
            ]);
            let collector = this.sentMess.createReactionCollector((reaction, user) => true);
            collector.on("collect", (reaction, user) => {
                if (reaction.me) return;
                reaction.users.remove(user);

                switch (reaction.emoji.name) {
                    case "➕":
                        if (this.sentMess.guild.member(user.id))
                            if (this.sentMess.guild.member(user.id).voice.channel)
                                this.sentMess.guild.member(user.id).voice.channel.join().catch((reason) => {
                                    console.log(reason);
                                    this.mess.channel.send("Erreur");
                                }).then((connection) => {
                                    this.connection = connection;
                                });
                            else
                                this.mess.channel.send("Pas dans un salon vocal");
                        else
                            this.mess.channel.send("Erreur member inexistant");
                        break;

                    case "⏯️":
                        this.playing = !this.playing;
                        if (this.playing)
                            this.resume();
                        else
                            this.pause()
                        break;

                    case "▶️":
                        this.play();
                        break;

                    case "⏹️":
                        this.destroy();
                        break;

                    case "⏩":
                        this.skip();
                        break;

                    case "⏪":
                        this.retour();
                        break;

                    case "🔉":
                        if (this.volume < 0.2) {
                            this.dispatcher.setVolume(0);
                        } else
                            this.dispatcher.setVolume(this.volume - 0.2);
                        this.volume = this.dispatcher.volume;
                        // console.log(this.dispatcher.volume);
                        break;

                    case "🔊":
                        if (this.volume > 1.8) {
                            this.dispatcher.setVolume(2);
                        } else
                            this.dispatcher.setVolume(this.volume + 0.2);
                        this.volume = this.dispatcher.volume;
                        // console.log(this.dispatcher.volume);
                        break;
                    default:
                        break;
                }
            });
            collector.on("end", () => console.log("end"));
            resolve();
        });
    }
    add(link) {
        new Music(link).getInfo().then(music => {
            this.queue.push(music);
            this.mess.channel.send(`${music.title} a été ajouté à la liste de lecture en position ${this.queue.length} !`);
        });
    }
    add_playlist(list_id) {
        scrapePlaylist(list_id).then(async result => {
            await new Promise((resolve, reject) => {
                result.playlist.forEach(async(r, i) => {
                    let music = await new Music(r.url).getInfo()
                    this.queue.push(music)
                    if (i == result.playlist.length - 1)
                        resolve();
                });
            });
            this.mess.channel.send(`La playlist ${result.title} a été ajouté à la liste de lecture`);
        });
    }
    play() {
        if (this.queue.length == 0) {
            let url = getUrlfromText("Pas de musique en file d'attente, c'est triste...",
                "fr-FR");
            this.connection.play(url);
            return;
        }
        if (this.actualMusic) {
            this.mess.channel.send("Et non...");
            return;
        }
        this.playing = true;
        this.actualMusic = this.queue.shift();
        this.message = new Discord.MessageEmbed()
            .setTitle("Lecture en cours")
            .setDescription(this.actualMusic.title)
            .addField("De:", this.actualMusic.author.name)
            .setThumbnail(this.actualMusic.minia)
            .setFooter(`Durée: ${this.actualMusic.length.minutes}:${this.actualMusic.length.secondes}`);
        this.sentMess.edit(this.message);
        try {
            this.dispatcher = this.connection.play(ytdl(this.actualMusic.link, { filter: "audioonly" }));
            this.dispatcher.setVolume(this.volume || 1);
        } catch (e) {
            this.playing = false;
            this.queue.unshift(this.actualMusic);
            this.actualMusic = null;
            console.log(e);
            this.mess.channel.send("Erreur");
            return;
        }
        this.dispatcher.on("finish", () => {
            console.log("finish");
            this.playing = false;
            this.historique.push(this.actualMusic);
            this.actualMusic = null;
            console.log("musique suivante");
            this.play();
        })
    }
    destroy() {
        if (this.connection)
            if (typeof this.connection.disconnect == "function")
                this.connection.disconnect();
        if (this.sentMess)
            if (this.sentMess.deletable)
                this.sentMess.delete();
            else
                console.log("Error to delete music player");
        this.queue = null;
        this.historique = null;
        this.mess = null;
        this.sentMess = null;
        this.message = null;
        this.volume = null;
        this.playing = null;
        this.queue = null;
    }
    resume() {
        this.dispatcher.resume();
    }
    pause() {
        this.dispatcher.pause();
    }
    skip() {
        if (this.dispatcher)
            this.dispatcher.emit("finish");
    }
    retour() {
        this.queue.unshift(this.actualMusic);
        this.actualMusic = null;
        this.queue.unshift(this.historique.pop());
        this.play();
    }
    resend(mess) {
        this.mess = mess;
        if (this.sentMess)
            if (this.sentMess.deletable)
                this.sentMess.delete();
            else
                console.log("Error to delete music player");
        this.send();
    }
    getInfos() {
        if (this.playing) {
            return [this.actualMusic].concat(this.queue).map(m => {
                return {
                    title: m.title,
                    author: m.author,
                    minia: m.minia,
                    length: m.length,
                    link: m.link
                }
            });
        } else
            return {
                Error: "No musique playing"
            }
    }
    getAllInfos() {
        if (this.playing) {
            return [this.actualMusic].concat(this.queue).map(m => m.info);
        } else
            return {
                Error: "No musique playing"
            }
    }
    getAllHistoricInfos() {
        return this.historique.map(m => m.info);
    }
    getHistoricInfos() {
        return this.historique.map(m => {
            return {
                title: m.title,
                author: m.author,
                minia: m.minia,
                length: m.length,
                link: m.link
            }
        });
    }
}

class Music {
    constructor(link) {
        this.link = link;
    }
    async getInfo() {
        return new Promise(async(resolve, reject) => {
            this.info = await ytdl.getBasicInfo(this.link);
            this.title = this.info.videoDetails.title;
            this.author = this.info.videoDetails.author;
            this.minia = "http://img.youtube.com/vi/" + this.info.videoDetails.videoId + "/0.jpg";
            let s = this.info.videoDetails.lengthSeconds
            this.length = {
                minutes: Math.floor(s / 60),
                secondes: s % 60
            }
            resolve(this);
        });
    }
}

module.exports = {
    Player
};