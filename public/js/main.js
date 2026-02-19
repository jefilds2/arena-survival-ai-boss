import { PixiRenderer } from "./game/renderer/PixiRenderer.js";
import { createHud } from "./game/ui/hud.js";
import { Game } from "./game/Game.js";

const canvas = document.getElementById("gameCanvas");

const renderer = new PixiRenderer({ canvas });
await renderer.init();

const hud = createHud();
const game = new Game({ canvas, renderer, hud });

game.start();

window.__fx = renderer;
window.__game = game;
