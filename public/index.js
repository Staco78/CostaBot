function resize() {
    const headerSize = document.querySelector("header").clientHeight;

    document.body.style.marginTop = headerSize + "px";
}

window.onresize = resize;
window.onload = resize;