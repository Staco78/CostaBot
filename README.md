# CostaBot <img src="https://cdn.discordapp.com/attachments/804650627459448844/817360465071439902/logo.png" alt="logo" width="30"/>


A discord bot

## Requirements

[Nodejs](https://nodejs.org/en/download) >= 12

[Npm](https://www.npmjs.com/get-npm) (include with Nodejs)

[Ffmpeg](https://ffmpeg.org/download.html) (to include in the path)

[Git](https://git-scm.com/downloads)

A [MongoDb](https://www.mongodb.com/) session (local or cloud)

## Installation


``` bash
git clone https://github.com/Staco78/CostaBot.git
cd CostaBot
npm i -g typescript
npm run restart
```

Make a config.json at out/config.json like
```json
{
    "token": "[Your discord bot token]",
    "keyWord": "costa",
    "dmTo": "[discord id who dm]",
    "xp": {
        "text": {
            "min": 5,
            "max": 50
        },
        "voc": {
            "min": 50,
            "max": 100
        }
    },
    "antispamMs": 30000,
    "levels": [
        { "xp": 0 },
        { "xp": 200 },
        { "xp": 1000 },
        { "xp": 3000 },
        { "xp": 8000 },
        { "xp": 15000 },
        { "xp": 25000 },
        { "xp": 40000 },
        { "xp": 60000 },
        { "xp": 90000 },
        { "xp": 130000 },
        { "xp": 180000 }
    ],
    "interface": {
        "active": true,
        "port": 1000,
        "token": "[Password to connect at the interface]"
    },
    "api": {
        "active": true,
        "port": 100,
        "music": {
            "defaultTextChannel": "[Default text Channel]",
            "defaultVoiceChannel": "[Default voice channel]"
        }
    },
    "server": {
        "active": true,
        "port": 80,
        "url": "http://staco.ddns.net/",
        "public": "public",
        "root": "[Path to the folder]"
    },
    "mongoDb": {
        "uri": "mongodb://localhost:27017/" // link to mongodb
    },
    "ffmpegPath": "./ffmpeg.exe"
}


```

## Usage

```bash
npm start
```
