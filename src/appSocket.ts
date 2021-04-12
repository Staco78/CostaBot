import WebSocket, { Server } from "ws";
import * as Logger from "./logger";
import { appSocket } from "./data/config.json";
import Discord from "discord.js";

export default class {
  private bot;
  private wss;
  constructor(bot: Discord.Client) {
    this.bot = bot;

    this.wss = new Server({ port: appSocket.port });
    this.wss.on("connection", (ws, r) => {
      Logger.http("Connnection app");
      (ws as any).id = r.headers.authorization;
      (ws as any).user = bot.users.cache.get((ws as any).id);
      if (!(ws as any).user) {
        ws.close(4001, "Unauthorized");
        return;
      }
    });
  }
  dl(id: string, videoId: string, format: string): boolean {
    let client: WebSocket | undefined;
    this.wss.clients.forEach((c) => {
      if (id === (c as any).id) client = c;
    });
    if (!client) return false;
    else {
      client.send(
        JSON.stringify({
          action: "dl",
          videoId: videoId,
          format: format,
        })
      );
      return true;
    }
  }
}
