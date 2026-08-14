const ball = document.getElementById("ball");
const game = document.getElementById("game");

const gameWidth = game.clientWidth;
const gameHeight = game.clientHeight;
const ballSize = ball.offsetWidth;

let posX = 0;
let posY = 0;
const step = 10;

document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowUp":
      posY = Math.max(0, posY - step);
      break;
    case "ArrowDown":
      posY = Math.min(gameHeight - ballSize, posY + step);
      break;
    case "ArrowLeft":
      posX = Math.max(0, posX - step);
      break;
    case "ArrowRight":
      posX = Math.min(gameWidth - ballSize, posX + step);
      break;
    default:
      return;
  }

  ball.style.left = posX + "px";
  ball.style.top = posY + "px";

  e.preventDefault();
});
