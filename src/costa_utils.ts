export interface log {
    type: string,
    data: string
}

export interface basicInfo {
    title: string,
    author: Author,
    minia: string,
    length: {
        minutes: number,
        secondes: number
    },
    link: string
}
interface Author {
    id: string;
    name: string;
    avatar: string; // to remove later
    thumbnails?: thumbnail[];
    verified: boolean;
    user?: string;
    channel_url: string;
    external_channel_url?: string;
    user_url?: string;
    subscriber_count?: number;
}
interface thumbnail {
    url: string;
    width: number;
    height: number;
}

export interface user {
    username: string,
    discriminator: string,
    id: string,
    xp: number,
    lvl: number,
    lastMessage: number,
    rank: number,
    avatarUrl: string
}

export class apiError {
    message: string;
    constructor(string: string) {
        this.message = string;
    }
    toString() {
        return this.message;
    }
}

export function findYtbLink(data: string, option: { return: "id" | "link" } = { return: "id" }): string | undefined {
    let match = data.match(/https?:\/\/www.youtube.com\/watch\?v=(\S+)/i);
    if (match == null) {
        match = data.match(/https?:\/\/youtu.be\/(\S+)/i);
        if (match == null)
            return undefined;
        else {
            if (option.return == "id")
                return match[1];
            else
                return match[0];
        }
    }
    else {
        if (option.return == "id")
            return match[1];
        else
            return match[0];
    }
}

export function findYtbPlaylistLink(data: string, option: { return: "id" | "link" } = { return: "id" }) {
    let match = data.match(/https?:\/\/www.youtube.com\/playlist\?list=(\S+)/i);
    if (match == null) {
        return undefined;
    }
    else {
        if (option.return == "id")
            return match[1];
        else
            return match[0];
    }
}