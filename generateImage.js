const canvas = require("canvas");

class XpStatus extends canvas.Canvas {
    constructor(PPUrl, xp, username, discriminator, level, rank, onEnd) {
        super(500, 200);
        this.context = this.getContext("2d");
        this.PP = new canvas.Image();
        this.context.strokeStyle = "rgb(48, 49, 54)";
        this.context.fillStyle = "rgb(48, 49, 54)";


        //arriere plan
        this.context.fillRect(100, 0, 360, 200);

        this.context.beginPath();
        this.context.arc(460, 40, 39, 0, 2 * Math.PI);
        this.context.fill();
        this.context.stroke();

        this.context.beginPath();
        this.context.arc(460, 160, 39, 0, 2 * Math.PI);
        this.context.fill();
        this.context.stroke();

        this.context.fillRect(460, 40, 40, 120);

        //dessin du cercle
        this.context.strokeStyle = "rgb(0, 0, 0)";
        this.context.beginPath();
        this.context.arc(100, 100, 100, 0, 2 * Math.PI);
        this.context.fill();
        this.context.save();
        this.context.clip();
        this.context.stroke();


        //fin de l'arriere plan

        this.PP.src = PPUrl;
        this.PP.onerror = (err) => console.log(err);
        this.PP.onload = () => {
            this.context.drawImage(this.PP, 0, 0, 200, 200);
            this.context.restore();
            this.context.fillStyle = "white";
            this.context.font = "40px Arial"
            this.context.fillText(username + "#" + discriminator, 210, 50, 250)
            this.context.font = "25px Arial"
            this.context.fillText(`Xp: ${xp}`, 210, 120, 250);
            this.context.fillText(`Niveau: ${level}`, 210, 150, 250);
            this.context.fillText(`Rang: ${rank}`, 210, 180, 250);
            onEnd();
        }

    }

}

class LevelPass extends canvas.Canvas {
    constructor(PPUrl, xp, username, discriminator, level, rank, onEnd) {
        super(500, 400);
        this.context = this.getContext("2d");
        this.PP = new canvas.Image();
        this.context.strokeStyle = "rgb(48, 49, 54)";
        this.context.fillStyle = "rgb(48, 49, 54)";


        //arriere plan
        this.context.fillRect(40, 40, 420, 320);

        this.context.beginPath();
        this.context.arc(40, 40, 39, 0, 2 * Math.PI);
        this.context.fill();
        this.context.stroke();

        this.context.beginPath();
        this.context.arc(40, 360, 39, 0, 2 * Math.PI);
        this.context.fill();
        this.context.stroke();

        this.context.beginPath();
        this.context.arc(460, 40, 39, 0, 2 * Math.PI);
        this.context.fill();
        this.context.stroke();

        this.context.beginPath();
        this.context.arc(460, 360, 39, 0, 2 * Math.PI);
        this.context.fill();
        this.context.stroke();

        this.context.fillRect(0, 40, 500, 320);
        this.context.fillRect(40, 0, 420, 400);

        //Texte
        this.context.font = "40px Arial";
        this.context.fillStyle = "white";
        this.context.fillText("Et un niveau de plus !", 60, 40);


        //Fleche
        this.context.fillStyle = "red";
        this.context.beginPath();
        this.context.moveTo(70, 220);
        this.context.lineTo(130, 220);
        this.context.lineTo(130, 150);
        this.context.lineTo(175, 150);
        this.context.lineTo(100, 70);
        this.context.lineTo(25, 150);
        this.context.lineTo(70, 150);
        this.context.lineTo(70, 220);
        this.context.fill();

        //dessin du cercle
        this.context.strokeStyle = "rgb(0, 0, 0)";
        this.context.lineWidth = 3;
        this.context.beginPath();
        this.context.arc(350, 160, 80, 0, 2 * Math.PI);
        this.context.save();
        this.context.stroke();

        //text du bas
        this.context.fillStyle = "black";
        this.context.font = "30px Arial";
        this.context.fillText("Bravo", 20, 300);
        this.context.fillText(`${username}#${discriminator}`, 20, 360, 300);

        this.context.font = "25px Arial";
        this.context.fillText(`Xp: ${xp}\nLevel: ${level}\nRang: ${rank}`, 325, 300);

        this.PP.src = PPUrl;
        this.PP.onload = () => {

            this.context.clip();
            this.context.drawImage(this.PP, 270, 80, 160, 160);
            this.context.restore();

            onEnd();
        }
    }

}

module.exports = {
    XpStatus,
    LevelPass
}