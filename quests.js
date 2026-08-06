import { markdownToHtml, formatRawHtml, formatRawCanvas } from "./questsParser.js?v=0.2";

let currentChapter = "";
let quests = [];

const GRID_SIZE = 32;

const camera = {
    x: 0,
    y: 0,
    zoom: 1
}

let mouse = {
    x: 0,
    y: 0
};

const WORLD = {
    minX: -100,
    maxX: 100,
    minY: -40,
    maxY: 40
}

let selectedNode = null;

const overlay = document.getElementById("questOverlay");
const questCard = document.getElementById("questCard");

const questTitle = document.getElementById("questTitle");
const questSubtitle = document.getElementById("questSubtitle");
const questDescription = document.getElementById("questDescription");

let activeChapterButton = null;
const chapterButtons = new Map();

let chapterOffset = {
    x: 0,
    y: 0
};

let questLinkCamera = {
    offsetX: 0,
    offsetY: 0,
    zoom: 2
}

let renderGrid = true;

let spriteSheet = null;

let dragging = false;
let lastMouse = { x: 0, y: 0};

let clickedNode = null;

let backgroundImage = null;

const extensions = ["png", "webp", "jpg", "jpeg"];

let pendingQuestId = null;

const gridToggle = document.getElementById("gridToggle");

renderGrid = localStorage.getItem("renderGrid") !== "false";
gridToggle.checked = renderGrid;

gridToggle.addEventListener("change", () => {
    renderGrid = gridToggle.checked;
    localStorage.setItem("renderGrid", renderGrid);
    renderQuest();
});

let canvas;
let ctx;

canvas = document.getElementById("out");
ctx = canvas.getContext("2d");

// TODO:
// fine tune trackpad movement, pan and zoom. pan should be easy, but zoom is a little finicky? need to test more
// add mobile panning, zooming, clicking, as well as proper scaling to fit and start within screen for mobile users.
// [DONE] query parameter to link to specific quests. add a button within a quest window (top right) as well as maybe ctrl+click on quest to copy link to it. something like: "https://enginnx.com/minecraft/wiki/quests?c=modern_industrialization&q=yourfirststeel" where c is chapter and q is quest. keep it short.
// [DONE] when someone goes to quest link, it needs to do camera.zoom: 2 with the camera positioned on the quest coordinates. and then, add the quest icon on the top middle of the quest desc window, like: https://discord.com/channels/754461970870173767/763394390466101279/1532668667073134753

canvas.addEventListener("mousedown", e => {
    if (e.button !== 0) return;

    const rect = canvas.getBoundingClientRect();

    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;

    const node = getNodeAt(mouse.x, mouse.y);

    if (node) {
        openQuest(node);
        return;
    }

    dragging = true;
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
});

window.addEventListener("mouseup", () => {
    dragging = false;
});

canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();

    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;

    if (dragging) {
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        camera.x -= dx / (GRID_SIZE * camera.zoom);
        camera.y += dy / (GRID_SIZE * camera.zoom);

        camera.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, camera.x));
        camera.y = Math.max(WORLD.minY, Math.min(WORLD.maxY, camera.y));

        lastMouse.x = e.clientX;
        lastMouse.y = e.clientY;

        // console.log(camera.x, camera.y);
    }

    renderQuest();
});

document.querySelectorAll("#sidebarButtons [chapter]").forEach(button => {
    button.addEventListener("click", () => {
        loadChapter(button.dataset.chapter);
    });
});

function screenToWorld(x, y) {

    return {
        x: (x - canvas.width / 2) / (GRID_SIZE * camera.zoom) + camera.x,
        y: -(y - canvas.height / 2) / (GRID_SIZE * camera.zoom) + camera.y
    };

}

canvas.addEventListener("wheel", e => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const before = screenToWorld(mouseX, mouseY);

    const factor = e.deltaY < 0 ? 1.1 : 0.9;

    camera.zoom *= factor;

    camera.zoom = Math.max(0.5, Math.min(4, camera.zoom));

    const after = screenToWorld(mouseX, mouseY);

    camera.x += before.x - after.x;
    camera.y += before.y - after.y;

    console.log(camera.zoom);

    renderQuest();
}, { passive: false });

async function loadCredits(chapter) {

    if (activeChapterButton) {
        activeChapterButton.classList.remove("active");
    }

    activeChapterButton = chapterButtons.get(chapter.id);

    if (activeChapterButton) {
        activeChapterButton.classList.add("active");
    }

    currentChapter = chapter.id;

    const response = await fetch(
        `mods/${currentChapter}/!credits.md`
    );

    questTitle.innerHTML = "Credits";

    questSubtitle.innerHTML = "Credits for the " + chapter.title + " chapter."

    questDescription.innerHTML = response.ok ? markdownToHtml(await response.text()) : "";

    const url = new URL(window.location);

    url.searchParams.set("c", chapter.id);
    url.searchParams.set("l", "true")

    if (!pendingQuestId) {
        url.searchParams.delete("q");
    }

    history.replaceState({}, "", url);

    renderQuest();

    overlay.classList.remove("hidden");
}

async function loadChapter(chapter) {

    if (activeChapterButton) {
        activeChapterButton.classList.remove("active");
    }

    activeChapterButton = chapterButtons.get(chapter.id);

    if (activeChapterButton) {
        activeChapterButton.classList.add("active");
    }

    currentChapter = chapter.id;

    if (chapter.background) {
        // console.log("hi");
        // console.log(chapter.background);
        const img = new Image();

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = `mods/${chapter.id}/${chapter.background}`
        });

        backgroundImage = img;
    } else {
        backgroundImage = null;
    }

    const response = await fetch(`mods/${chapter.id}/!quests.json`);
    quests = await response.json();

    spriteSheet = null;

    if (chapter.spriteSheet) {
        const img = new Image();

        await new Promise((resolve, reject) => {
            img.onload = () => resolve(true);
            img.onerror = () => reject(false);

            img.src = `mods/${chapter.id}/!spritesheet.png`;
        });

        spriteSheet = img;
    }

    selectedNode = null;

    if (chapter.camera) {
        camera.x = chapter.camera.x;
        camera.y = chapter.camera.y;
        camera.zoom = chapter.camera.zoom;
    } else {
        camera.x = 0;
        camera.y = 0;
        camera.zoom = 1;
    }

    const url = new URL(window.location);

    url.searchParams.set("c", chapter.id);

    if (!pendingQuestId) {
        url.searchParams.delete("q");
    }

    history.replaceState({}, "", url);

    console.log("pendingQuestId before:", pendingQuestId);

    if (pendingQuestId) {
        const quest = quests.find(q => q.id === pendingQuestId);

        if (quest) {

            questLinkCamera = {
                offsetX: 0,
                offsetY: 0,
                zoom: 2,
                ...(chapter.questLinkCamera ?? {})
            };

            camera.zoom = questLinkCamera.zoom;
            camera.x = quest.location[0] + questLinkCamera.offsetX;
            camera.y = quest.location[1] + questLinkCamera.offsetY;

            renderQuest();
            await openQuest(quest)
        }

        pendingQuestId = null;
    }

    console.log("pendingQuestId after:", pendingQuestId);

    renderQuest();
}

function drawBackground() {

    if (!backgroundImage) return;

    const scale = Math.max(
        canvas.width / backgroundImage.width,
        canvas.height / backgroundImage.height
    );

    const width = backgroundImage.width * scale;
    const height = backgroundImage.height * scale;

    const overscan = 8; //draw image oversized a bit to prevent white blurred edges

    // dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
        backgroundImage,
        (canvas.width - width) / 2 - overscan,
        (canvas.height - height) / 2 - overscan,
        width + overscan * 2,
        height + overscan * 2
    );
}

async function openQuest(node) {
    selectedNode = node;

    questTitle.innerHTML = formatRawHtml(node.title);

    if (node.subtitle) {
        questSubtitle.innerHTML = formatRawHtml(node.subtitle);
        questSubtitle.hidden = false;
    } else {
        questSubtitle.hidden = true;
    }

    const iconCanvas = document.getElementById("questIcon");
    const iconCtx = iconCanvas.getContext("2d");

    iconCtx.clearRect(0, 0, iconCanvas.width, iconCanvas.height);

    if (spriteSheet && node.index != null) {
        const index = node.index - 1;

        const iconsPerRow = Math.floor(spriteSheet.width / ICON_CELL_SIZE);

        const sx = (index % iconsPerRow) * ICON_CELL_SIZE + ICON_PADDING;
        const sy = Math.floor(index / iconsPerRow) * ICON_CELL_SIZE + ICON_PADDING;

        iconCtx.imageSmoothingEnabled = false;

        iconCtx.fillStyle = "white";
        iconCtx.fillRect(0, 0, iconCanvas.width, iconCanvas.height);
        iconCtx.fillStyle = "rgba(0, 0, 0, 0.3)";
        iconCtx.fillRect(0, 0, iconCanvas.width, iconCanvas.height);

        const padding = 6;

        iconCtx.drawImage(
            spriteSheet,
            sx,
            sy,
            ICON_SIZE,
            ICON_SIZE,
            padding,
            padding,
            iconCanvas.width - padding * 2,
            iconCanvas.height - padding * 2
        );

        iconCtx.lineWidth = 10;
        iconCtx.strokeStyle = "black";
        iconCtx.strokeRect(0, 0, iconCanvas.width, iconCanvas.height);
    }

    mouse.x = -9001; //over 9000 lmao
    mouse.y = -9001;

    const url = new URL(window.location);

    url.searchParams.set("c", currentChapter);
    url.searchParams.set("q", node.id);

    history.replaceState({}, "", url);

    const response = await fetch(
        `mods/${currentChapter}/${node.id}.md`
    );

    questDescription.innerHTML = response.ok ? markdownToHtml(await response.text()) : "";

    renderQuest();

    overlay.classList.remove("hidden");
}

function closeQuest() {
    selectedNode = null;

    mouse.x = -9001; //over 9000 lmao
    mouse.y = -9001;

    overlay.classList.add("hidden");

    const url = new URL(window.location);

    url.searchParams.set("c", currentChapter);
    url.searchParams.delete("q");
    url.searchParams.delete("l");

    history.replaceState({}, "", url);

    renderQuest();
}

overlay.addEventListener("click", e => {

    if (e.target === overlay) {
        closeQuest();
    }
});

document.addEventListener("keydown", e => {

    if (e.key === "Escape") {
        closeQuest();
    }

});

function getNodeAt(x, y) {

    for (const node of quests) {

        const p = nodeToScreen(...node.location);

        const half = (32 * camera.zoom) / 2;

        // console.log(half);

        if (
            x >= p.x - half &&
            x <= p.x + half &&
            y >= p.y - half &&
            y <= p.y + half
        ) {
            return node;
        }

    }

    return null;
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    renderQuest();
}

function worldToScreen(x, y) {
    return{
        x: canvas.width / 2 + (x - camera.x) * GRID_SIZE * camera.zoom,
        y: canvas.height / 2 - (y - camera.y) * GRID_SIZE * camera.zoom
    }
}

function nodeToScreen(x,y) {

    return worldToScreen(
        x + chapterOffset.x,
        y + chapterOffset.y
    );
}

function drawGrid() {

    if (!renderGrid) {
        return;
    }

    ctx.strokeStyle = "#44444442";
    ctx.lineWidth = 1;

    const halfX = Math.ceil(canvas.width / (GRID_SIZE * camera.zoom * 2)) + 128;
    const halfY = Math.ceil(canvas.height / (GRID_SIZE * camera.zoom * 2)) + 128;

    for (let x = -halfX; x <= halfX; x++) {
        const p = worldToScreen(x, 0);
        
        ctx.beginPath();
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, canvas.height);
        ctx.stroke();
    }

    for (let y = -halfY; y <= halfY; y++) {
        const p = worldToScreen(0, y);

        ctx.beginPath();
        ctx.moveTo(0, p.y);
        ctx.lineTo(canvas.width, p.y);
        ctx.stroke();
    }
}

const ICON_SIZE = 64;
const ICON_PADDING = 1;
const ICON_CELL_SIZE = ICON_SIZE + ICON_PADDING * 2;

function drawNode(node) {
    const p = nodeToScreen(...node.location);

    const size = 32 * camera.zoom;
    const padding = 2 * camera.zoom;
    
    ctx.fillStyle = "white";
    ctx.fillRect(
        p.x - size / 2,
        p.y - size / 2,
        size,
        size
    );

    if (spriteSheet && node.index != null) {
        const index = node.index - 1;

        const iconsPerRow = Math.floor(spriteSheet.width / ICON_CELL_SIZE);

        const sx = (index % iconsPerRow) * ICON_CELL_SIZE + ICON_PADDING;
        const sy = Math.floor(index / iconsPerRow) * ICON_CELL_SIZE + ICON_PADDING;

        //console.log(sx, sy);

        ctx.drawImage(
            spriteSheet,
            sx,
            sy,
            ICON_SIZE,
            ICON_SIZE,
            p.x - size / 2 + padding,
            p.y - size / 2 + padding,
            size - padding * 2,
            size - padding * 2,
        );
    }

    ctx.lineWidth = 1 * camera.zoom;
    ctx.strokeStyle = "black";
    ctx.strokeRect(
        p.x - size / 2,
        p.y - size / 2,
        size,
        size
    );
}



function drawConnection(from, to, options = {}) {

    const {
        dashed = false,
        arrow = true,
        color = "#fc0000",
        width = 3
    } = options;

    const p1 = nodeToScreen(...from.location);
    const p2 = nodeToScreen(...to.location);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    const length = Math.hypot(dx, dy);

    const ux = dx / length;
    const uy = dy / length;

    const nodeRadius = 16 * camera.zoom;

    const startX = p1.x + ux * nodeRadius;
    const startY = p1.y + uy * nodeRadius;

    const endX = p2.x - ux * nodeRadius;
    const endY = p2.y - uy * nodeRadius;

    const mx = (startX + endX) / 2;
    const my = (startY + endY) / 2;

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, width * camera.zoom);

    if (dashed) {
        ctx.setLineDash([5, 3]);
    } else {
        ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.setLineDash([]);

    if (arrow) {
        drawArrowhead(mx, my, ux, uy);
    }
}

function drawArrowhead(x, y, ux, uy) {
    const length = 12 * camera.zoom;
    const width = 6 * camera.zoom;

    const px = -uy;
    const py = ux;

    ctx.fillStyle = "#fc0000";

    ctx.beginPath();

    ctx.moveTo(
        x + ux * length / 2,
        y + uy * length / 2
    );

    ctx.lineTo(
        x - ux * length / 2 + px * width,
        y - uy * length / 2 + py * width
    );

    ctx.lineTo(
        x - ux * length / 2 - px * width,
        y - uy * length / 2 - py * width
    );

    ctx.closePath();
    ctx.fill();
}

function renderQuest() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    ctx.filter = "blur(4px)"; //blur background a little
    drawBackground();
    
    ctx.restore();

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)"; // dark overlay to make quests pop
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    for (const node of quests) {
        for (const dependency of node.depends ?? []) {
            const from = quests.find(n => n.id === dependency);
            drawConnection(from, node);
        }

        for (const dependency of node.optionalDepends ?? []) {
            const from = quests.find(n => n.id === dependency);
            drawConnection(from, node, {
                dashed: true
            });
        }

        for (const dependency of node.related ?? []) {
            const from = quests.find(n => n.id === dependency);
            drawConnection(from, node, {
                dashed: true,
                arrow: false
            });
        }
    }

    for (const node of quests) {
        drawNode(node);
    }

    if (!selectedNode) {
        for (const node of quests) {
            if (isMouseOverNode(node)) {
                drawTooltip(node);
                break;
            }
        }
    }
}

async function init() {

    const response = await fetch("mods/chapters.json");
    const chapters = await response.json();

    const params = new URLSearchParams(window.location.search);

    const chapterId = params.get("c");
    pendingQuestId = params.get("q");
    const credits = params.get("l");

    const chapter = chapters.find(c => c.id === chapterId);

    if (credits) {
        console.log(chapter);
        loadCredits(chapter);
    }

    document.getElementById("copyQuestLink").onclick = async () => {
        await navigator.clipboard.writeText(window.location.href);
    };

    const copyButton = document.getElementById("copyQuestLink");

    copyButton.onclick = async () => {

        await navigator.clipboard.writeText(window.location.href);

        copyButton.classList.add("copied");

        setTimeout(() => {
            copyButton.classList.remove("copied");
        }, 1000);
    };

    for (const chapter of chapters) {

        const button = document.createElement("button");

        button.innerHTML = formatRawHtml(chapter.title);

        chapterButtons.set(chapter.id, button);

        button.addEventListener("click", (e) => {

            if (e.ctrlKey) {
                loadChapter(chapter);
                console.log("I CLICKED IT")
                loadCredits(chapter);
            } else {
                loadChapter(chapter);
            }
        });

        sidebarButtons.appendChild(button);
    }

    if (chapters.length > 0) {

        let chapter = chapters.find(c => c.id === chapterId);

        const url = new URL(window.location);

        if (!chapter) {
            chapter = chapters.find(c => c.default) ?? chapters[0];

            pendingQuestId = null;
            url.searchParams.delete("q");
            url.searchParams.delete("l");
        }

        url.searchParams.set("c", chapter.id);

        history.replaceState({}, "", url);

        loadChapter(chapter);
    }
}
init();

function isMouseOverNode(node) {

    const p = nodeToScreen(...node.location);

    const halfSize = 16 * camera.zoom;

    return (
        mouse.x >= p.x - halfSize &&
        mouse.x <= p.x + halfSize &&
        mouse.y >= p.y - halfSize &&
        mouse.y <= p.y + halfSize
    );
}

function drawTooltip(node) {

    const titleRuns = formatRawCanvas(node.title);

    const subtitleRuns = node.subtitle ? formatRawCanvas(node.subtitle) : null;

    const padding = 32;

    const titleFont = "28px sans-serif";
    const subtitleFont = "20px sans-serif";

    ctx.font = titleFont;
    const titleWidth = measureRuns(ctx, titleRuns, titleFont);

    let subtitleWidth = 0;
    if (node.subtitle) {
        subtitleWidth = measureRuns(ctx, subtitleRuns, subtitleFont);
    }

    const width = Math.max(titleWidth, subtitleWidth) + padding * 2;
    const height = node.subtitle ? 100 : 70;

    const boxX = mouse.x + 12;
    const boxY = mouse.y + 12;

    ctx.fillStyle = "#222";
    ctx.fillRect(mouse.x + 12, mouse.y + 12, width, height);

    ctx.strokeStyle = "#777";
    ctx.strokeRect(mouse.x + 12, mouse.y + 12, width, height);

    drawRuns(
        ctx,
        titleRuns,
        mouse.x + 12 + padding,
        mouse.y + 48,
        titleFont,
        "#FFF"
    );

    if (subtitleRuns) {
        drawRuns(
            ctx,
            subtitleRuns,
            mouse.x + 12 + padding,
            mouse.y + 84,
            subtitleFont,
            "#a8a8a8"
        );
    }
}

function measureRuns(ctx, runs, font) {
    let width = 0;

    ctx.font = font;

    for (const run of runs) {
        width += ctx.measureText(run.text).width;
    }

    return width;
}

function drawRuns(ctx, runs, x, y, font, defaultColor) {
    let currentX = x;
    ctx.font = font;
    for (const run of runs) {
        ctx.fillStyle = run.color ?? defaultColor;
        ctx.fillText(run.text, currentX, y);
        currentX += ctx.measureText(run.text).width;
    }
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();