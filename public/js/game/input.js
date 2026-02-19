export class Input {
    constructor() {
        this.keys = new Set();
        this.justPressed = new Set();

        window.addEventListener("keydown", (e) => {
            const k = e.key.toLowerCase();
            if (!this.keys.has(k)) this.justPressed.add(k);
            this.keys.add(k);
        });

        window.addEventListener("keyup", (e) => {
            this.keys.delete(e.key.toLowerCase());
        });
    }

    down(k) { return this.keys.has(k); }
    pressed(k) { return this.justPressed.has(k); }
    endFrame() { this.justPressed.clear(); }
}
