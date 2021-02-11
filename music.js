const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const { scrapePlaylist } = require("youtube-playlist-scraper");
const events = require("events");
const { getUrlfromText } = require("tts-googlehome");


class Player {
    constructor(mess = new Discord.Message()) {
        this.mess = mess;
        this.queue = [];
        this.historique = [];
        this.Event = new events.EventEmitter();
        this.playing = false;
        this.volume = 1;
        this.message = new Discord.MessageEmbed()
            .setTitle("Aucune musique en lecture")
            .setDescription("")
        this.Event.on("add", () => {

        });
        let link = mess.content.match(/https?:\/\/www.youtube.com\/watch\?v=\S+/);
        let list = mess.content.match(/https?:\/\/www.youtube.com\/playlist\?list=(\S+)/);
        if (link) {
            new Music(link).getInfo().then(music => {
                this.queue = [music]
                this.Event.emit("add");
                this.message = new Discord.MessageEmbed()
                    .setTitle("En attente...")
                    .setDescription(music.title)
                    .addField("De:", music.author.name)
                    .setThumbnail(music.minia)
                    .setFooter(`Durée: ${music.length.minutes}:${music.length.secondes}`);
                this.send();
            });
        }
        else if (list) {
            scrapePlaylist(list[1]).then(async result => {
                // console.log(result);
                this.queue = []
                await new Promise((resolve, reject) => {
                    result.playlist.forEach(async (r, i) => {
                        let music = await new Music(r.url).getInfo()
                        this.queue.push(music)
                        this.Event.emit("add");
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
        }
        else
            this.send();


    }
    send() {
        return new Promise(async (resolve, reject) => {
            this.sentMess = await this.mess.channel.send(this.message);
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
                            this.mess.channel.send("Erreur");
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
                        this.stop();
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
                        }
                        else
                            this.dispatcher.setVolume(this.volume - 0.2);
                        this.volume = this.dispatcher.volume;
                        // console.log(this.dispatcher.volume);
                        break;

                    case "🔊":
                        if (this.volume > 1.8) {
                            this.dispatcher.setVolume(2);
                        }
                        else
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
            this.Event.emit("add");
            this.mess.channel.send(`${music.title} a été ajouté à la liste de lecture en position ${this.queue.length} !`);
        });
    }
    add_playlist(list_id) {
        scrapePlaylist(list_id).then(async result => {
            await new Promise((resolve, reject) => {
                result.playlist.forEach(async (r, i) => {
                    let music = await new Music(r.url).getInfo()
                    this.queue.push(music)
                    this.Event.emit("add");
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
        }
        catch (e) {
            this.playing = false;
            this.queue.unshift(this.actualMusic);
            this.actualMusic = null;
            this.mess.channel.send("Erreur");
            return;
        }
        this.dispatcher.on("finish", () => {
            this.playing = false;
            this.historique.push(this.actualMusic);
            this.actualMusic = null;
            console.log("musique suivante");
            this.play();
        })
    }
    stop() {
        if (this.connection)
            if (typeof this.connection.disconnect == "function")
                this.connection.disconnect();
        if (this.sentMess)
            if (this.sentMess.deletable)
                this.sentMess.delete();
            else
                console.log("Error to delete music player");
        this.queue = [];
    }
    resume() {
        this.dispatcher.resume();
    }
    pause() {
        this.dispatcher.pause();
    }
    skip() {
        this.actualMusic = null;
        this.play();
    }
    retour() {
        console.log(this.actualMusic.title);
        console.log(this.queue[0]);
        console.log(this.historique);
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
}

class Music {
    constructor(link) {
        this.link = link;
    }
    async getInfo() {
        return new Promise(async (resolve, reject) => {
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