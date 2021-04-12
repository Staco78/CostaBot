import Discord from "discord.js";

export default class Radio {
	url: URL;
	channel: Discord.VoiceChannel;
	connection: undefined | Discord.VoiceConnection;

	constructor(link: string, channel: Discord.VoiceChannel) {
		if (channel.isText() || !(channel instanceof Discord.VoiceChannel)) throw new TypeError("The channel must be a voice channel");
		this.url = new URL(link);
		this.channel = channel;
	}

	async connect() {
		if (this.channel.joinable) this.connection = await this.channel.join();
		else throw new Error("Unable to join channel");
	}

	async play() {
		if (!this.connection) throw new Error("Connect before playing");
		this.connection.play(this.url.toString());
	}

	stop(){
		this.connection?.disconnect();
	}
}
