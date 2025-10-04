const config = {
    type: Phaser.AUTO,
    parent: "game-container",
    title: "5S Dashboard",
    version: "1.0.0",
    autoFocus: true,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    backgroundColor: 0xffffff,
    antialias: false,
    pixelArt: true,
    roundPixels: true,
    transparent: true,
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let graphics;
let tooltipText;
let apiData = [];

function preload() {
}

async function create() {
    graphics = this.add.graphics();

    drawGrid(this.scale.width, this.scale.height);
    this.scale.on('resize', (gameSize) => drawGrid(gameSize.width, gameSize.height));

    tooltipText = this.add.text(0, 0, '', { font: "14px Arial", fill: "#000", backgroundColor: "#fff" });
    tooltipText.setDepth(1000);
    tooltipText.setVisible(false);

    // เพิ่ม zoom controls
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
        // ตรวจสอบว่ากด Ctrl อยู่หรือไม่
        if (pointer.event.ctrlKey) {
            // ป้องกันการ zoom ของ browser
            pointer.event.preventDefault();
            
            // deltaY < 0 คือลูกกลิ้งขึ้น (zoom in), > 0 คือลูกกลิ้งลง (zoom out)
            const zoomAmount = deltaY < 0 ? 0.1 : -0.1;
            const newZoom = this.cameras.main.zoom + zoomAmount;
            
            // จำกัด zoom ไม่ให้เล็กหรือใหญ่เกินไป
            if (newZoom >= 0.5 && newZoom <= 2) {
                this.cameras.main.zoom = newZoom;
            }
        }
    });

    apiData = await fetch5SData();

    for (let i = 1; i <= 7; i++) {
        createDraggableCircle(this, 64 * i, 64);
    }
}

function update() { }

function drawGrid(width, height) {
    graphics.clear();
    graphics.lineStyle(1, 0x000000, 0.3);
    for (let x = 0; x < width; x += 64) graphics.moveTo(x, 0), graphics.lineTo(x, height);
    for (let y = 0; y < height; y += 64) graphics.moveTo(0, y), graphics.lineTo(width, y);
    graphics.strokePath();
}

function createDraggableCircle(scene, x, y) {
    let color = 0xaaaaaa;

    const circle = scene.add.circle(x + 32, y + 32, 28, color);
    circle.setInteractive({ draggable: true });
    scene.input.setDraggable(circle);

    circle.selectedItem = null;

    circle.on('drag', (pointer, dragX, dragY) => {
        if (pointer.event.ctrlKey) {
            // ถ้ากด Ctrl ให้ snap to grid
            circle.x = Phaser.Math.Snap.To(dragX, 64) + 32;
            circle.y = Phaser.Math.Snap.To(dragY, 64) + 32;
        } else {
            // ถ้าไม่ได้กด Ctrl สามารถลากวางที่ไหนก็ได้
            circle.x = dragX;
            circle.y = dragY;
        }
    });

    circle.on('pointerover', () => {
        if (circle.selectedItem) {
            tooltipText.setText(`${circle.selectedItem[0]}\n${circle.selectedItem[1]}\n${circle.selectedItem[2]}`);
        } else {
            tooltipText.setText("Click for select data");
        }
        tooltipText.setVisible(true);
    });
    circle.on('pointerout', () => tooltipText.setVisible(false));
    circle.on('pointermove', (pointer) => tooltipText.setPosition(pointer.x + 10, pointer.y + 10));

        circle.on('pointerdown', (pointer) => {
            if (pointer.rightButtonDown()) {
                showCircleDataSelection(scene, circle);
            }
        });

    return circle;
}

function showCircleDataSelection(scene, circle) {
    if (!apiData || apiData.length === 0) return;

    // ป้องกันซ้อน
    const existing = document.getElementById('dataSelect');
    if (existing) existing.remove();

    // แปลงตำแหน่ง circle (Phaser) เป็นตำแหน่งบนจอ (canvas)
    const canvas = scene.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const left = rect.left + circle.x - 40;
    const top = rect.top + circle.y - 20;

    const select = document.createElement('select');
    select.id = 'dataSelect';
    select.style.position = 'absolute';
    select.style.left = `${left}px`;
    select.style.top = `${top}px`;
    select.style.zIndex = 1000;

    apiData.forEach((item, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.text = `${item[0]} - ${item[1]} - ${item[2]}`;
        select.appendChild(option);
    });
        // เลือก index 0 ทันที เพื่อให้เลือกอันแรกได้
        select.selectedIndex = 0;

    // เมื่อเลือกข้อมูล
    select.addEventListener('change', (e) => {
        const index = parseInt(e.target.value);
        const item = apiData[index];
        let color = 0xaaaaaa;
        switch (item[2]) {
            case "5S": color = 0x00ff00; break;
            case "4S": color = 0x99ff66; break;
            case "3S": color = 0xffff00; break;
            case "2S": color = 0xff9900; break;
            case "1S": color = 0xff0000; break;
            case "0N": color = 0x000000; break;
        }
        circle.fillColor = color;
        circle.selectedItem = item;
        tooltipText.setText(`${item[0]}\n${item[1]}\n${item[2]}`);
        if (document.body.contains(select)) select.remove();
    });

    // ปิด select เมื่อ blur
    select.addEventListener('blur', () => {
        if (document.body.contains(select)) select.remove();
    });

    document.body.appendChild(select);
    select.focus();
}

async function fetch5SData() {
    const url = "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLi7xd-OAAmZ8AescjJL34a8FCTvhUUU9SkhzWKZrqoH8lkKJgP0nSmeO9uJKgaVgznwq8smArQemYEWgNSbnRoJZ3XSVmB4evh-Gnp1Fm1RxnVjk1jlGct9ATAqO_-x-p1Z43TfJgIIWQu0A2Fbxz8ZTIRzQRvCd2CoiqAsAbQ00hz6-NAOhTjrEJOUdsemb41OJe-QD8M7udfihqf9_eSwCWGJXN8UqSjKf7jXLwVPDr7iQ1vlCAbzOaYkGiVuLS2asvY8MWtONgLUI1ebQH173U5hKJjFkpiEMBEi&lib=M-g_o_A83U2A5xS2kBj8I5jgMzyICubym";
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Response status: ${response.status}`);
        const result = await response.json();
        return result.data;
    } catch (err) {
        console.error(err);
        return [];
    }
}
