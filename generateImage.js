const canvas = require("canvas");

class XpStatus extends canvas.Canvas{
    constructor(PPUrl, xp, username, discriminator, level, onEnd) {
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
            this.context.fillText(`Xp: ${xp}`, 210, 135, 250);
            this.context.fillText(`Niveau: ${level}`, 210, 170, 250);
            onEnd();
        }
        
    }
    
}

module.exports = { 
    XpStatus
}