import express from "express";
import ytdl from "ytdl-core";

import { server } from "./data/config.json";
import sanitize from "sanitize-filename";
const ytbVideoLink = "https://youtube.com/watch?v=";

const app = express();
app.use(express.static(server.public));

app.get("/", (req, res) => {
  res
    .status(200)
    .sendFile("./api doc.txt", {
      root: "C:\\Users\\maxim\\Desktop\\code\\CostaBot\\Bot ts",
    });
});

app.get("/download", async (req, res) => {
  let id = req.query.id;
  if (typeof id != "string") {
    res.status(400).end("No video id found");
    return;
  }
  let format = req.query.f;
  if (typeof format != "string") {
    res.status(400).end("No format found");
    return;
  }

  let title = (await ytdl.getBasicInfo(ytbVideoLink + id)).videoDetails.title;

  if (format == "audio") {
    res.header(
      "Content-Disposition",
      'attachment; filename="' + sanitize(title) + '.mp4"'
    );
    ytdl(ytbVideoLink + id, { filter: "audioonly", quality: "highestaudio" }).pipe(res);
  } else if (format == "video") {
    res.header(
      "Content-Disposition",
      'attachment; filename="' + sanitize(title) + '.mp4"'
    );
    ytdl(ytbVideoLink + id, { filter: "videoandaudio", quality: "highestvideo" }).pipe(res);
  } else res.status(400).end("Unknown format");
});

export default function start(port?: number) {
  app.listen(port || server.port);
  console.log("server started at port", port || server.port);
}
