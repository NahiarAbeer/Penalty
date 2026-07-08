
(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const phone = document.getElementById('phone');
    const scoreEl = document.getElementById('score');
    const shotsEl = document.getElementById('shots');
    const statusEl = document.getElementById('status');
    const startEl = document.getElementById('start');
    const playBtn = document.getElementById('play');
    const toastEl = document.getElementById('toast');
    const hintEl = document.getElementById('hint');
    const titleEl = document.getElementById('title');
    const keeperImg = new Image();
    keeperImg.src = "images/keeper.png"; // তোমার image path
    let W = 0, H = 0, DPR = 1, last = performance.now();
    let running = false,
    score = 0,
    shots = 10,
    cameraY = 0,
    targetCameraY = 0,
    shake = 0;
    let drag = null, particles = [], rings = [];
    let ball, keeper, opponentGoal, hiddenOwnGoal;
    let zoom = 1;
    let shot = null;
    let fireTimer = 0;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    function resize() {
        DPR = Math.min(2, window.devicePixelRatio || 1);
        W = phone.clientWidth; H = phone.clientHeight;
        canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        buildWorld(); resetBall(true);
    }

    function buildWorld() {

    const ballSpawnY = 900;

    opponentGoal = {
        x: W / 2,
        y: ballSpawnY - 450,
        w: Math.min(W * .45, 220),
        h: 55,
        depth: 22
    };

    hiddenOwnGoal = {
        x: W / 2,
        y: ballSpawnY + 900,
        w: opponentGoal.w,
        h: opponentGoal.h,
        depth: opponentGoal.depth
    };

    keeper = {
        x: W / 2,
        y: opponentGoal.y + 140,
        w: 50,
        h: 15,
        tx: W / 2,
        state: 'idle',
        dive: 0,
        side: 0
    };
}

    function resetBall(instant = false) {
        ball = { x: W / 2, y: 900, r: 8, vx: 0, vy: 0, moving: false, trail: [], spin: 0, ghost: false };
        keeper.state = 'idle'; keeper.x = W / 2; keeper.tx = W / 2; keeper.dive = 0; keeper.side = 0;
        shot = null;
        targetCameraY = ball.y - H * .66;
        if (instant) cameraY = targetCameraY;
        statusEl.textContent = 'Ready';
    }
function worldToScreen(x,y){
    return {
        x : x,
        y : y - cameraY
    };
}
function screenToWorld(x,y){
    return {
        x : x,
        y : y + cameraY
    };
}

    function showToast(text) {
        toastEl.textContent = text; toastEl.classList.add('show');
        clearTimeout(showToast.t); showToast.t = setTimeout(() => toastEl.classList.remove('show'), 1050);
    }

    function spawn(x, y, color, n = 18, power = 1) {
        for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - .5) * 230 * power, vy: (Math.random() - .5) * 230 * power, life: .55 + Math.random() * .45, color, r: 2 + Math.random() * 3 });
        rings.push({ x, y, r: 10, life: .55, color });
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    function drawField() {
    const top = cameraY, bottom = cameraY + H;

    const g = ctx.createLinearGradient(0, 0, 0, H);

g.addColorStop(0, "#2f8f3d");
g.addColorStop(.5, "#2a7c35");
g.addColorStop(1, "#23662d");

ctx.fillStyle = g;
ctx.fillRect(0,0,W,H);

    // subtle field grid
    ctx.save();
    ctx.globalAlpha = .13;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    const startY = Math.floor(top / 52) * 52;
    const stripeHeight = 80;

for(let y = 0; y < H + stripeHeight; y += stripeHeight){

    ctx.fillStyle =
        Math.floor((y + cameraY)/stripeHeight)%2
        ? "#2e8b3c"
        : "#338f43";

    ctx.fillRect(
        0,
        y,
        W,
        stripeHeight
    );
}
    for (let y = startY; y < bottom + 80; y += 52) {
        const sy = y - cameraY;
        ctx.beginPath();
        ctx.moveTo(24, sy);
        ctx.lineTo(W - 24, sy + 14);
        ctx.stroke();
    }

    for (let x = -40; x < W + 80; x += 56) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 70, H);
        ctx.stroke();
    }

    ctx.restore();
    drawCrowd();
    drawPitchLines();
}
function drawCrowd(){

    const top = -cameraY;

    ctx.fillStyle = "#222";

    ctx.fillRect(
        0,
        top - 300,
        W,
        250
    );

    for(let i=0;i<1200;i++){

        const x =
            (i*17)%W;

        const y =
            top - 250 +
            ((i*31)%180);

        const colors = [
            "#ffffff",
            "#ffcc00",
            "#00aaff",
            "#ff4444"
        ];

        ctx.fillStyle =
            colors[i%4];

        ctx.fillRect(
            x,
            y,
            2,
            2
        );
    }
}
 function drawPitchLines() {

    const g = opponentGoal;

    const gx = g.x;
    const gy = g.y;

    const goalLineY = gy + g.h / 2 + g.depth;
    const goalLineScreenY = goalLineY - cameraY;

    const penaltyBoxWidth = Math.min(W * 0.82, 390);
    const penaltyBoxHeight = 280;

    const goalBoxWidth = Math.min(W * 0.45, 180);
    const goalBoxHeight = 110;

    const penaltyMarkY = goalLineY + 190;
    const penaltyMarkScreenY = penaltyMarkY - cameraY;

    const penaltyArcRadius = 150;

    ctx.save();

    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    // ==========================
    // GOAL LINE
    // ==========================

    ctx.beginPath();
    ctx.moveTo(20, goalLineScreenY);
    ctx.lineTo(W - 20, goalLineScreenY);
    ctx.stroke();

    // ==========================
    // PENALTY AREA
    // ==========================

    ctx.strokeRect(
        gx - penaltyBoxWidth / 2,
        goalLineScreenY,
        penaltyBoxWidth,
        penaltyBoxHeight
    );

    // ==========================
    // GOAL AREA
    // ==========================

    ctx.strokeRect(
        gx - goalBoxWidth / 2,
        goalLineScreenY,
        goalBoxWidth,
        goalBoxHeight
    );

    // ==========================
    // PENALTY MARK
    // ==========================

    ctx.fillStyle = "rgba(255,255,255,0.55)";

    ctx.beginPath();
    ctx.arc(
        gx,
        penaltyMarkScreenY,
        4,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // ==========================
    // PENALTY ARC
    // ==========================

    ctx.beginPath();

    ctx.arc(
        gx,
        penaltyMarkScreenY,
        penaltyArcRadius,
        30*Math.PI/180,
        150*Math.PI/180
       );

    ctx.stroke();

    ctx.restore();
}

    function drawOpponentGoal() {
    const { x, y, w, h, depth } = opponentGoal; 
    const sy = y - cameraY;
    
    // Early exit if off-screen
    if (sy < -160 || sy > H + 160) return;
    
    ctx.save();
    
    // 1. Goal Shadow & Backing Fill
    ctx.shadowColor = 'rgba(0,0,0,.35)'; 
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(239,71,111,.15)'; 
    ctx.fillRect(x - w / 2, sy - h / 2, w, h + depth);
    
    // 2. The Net Mesh (Drawn first so posts sit on top)
    ctx.strokeStyle = 'rgba(255,255,255,.20)'; 
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0; // Turn off shadows for the thin net lines to prevent blurriness
    
    // Vertical net lines
    for (let i = 0; i < 8; i++) { 
        const xx = x - w / 2 + i * w / 7; 
        ctx.beginPath(); 
        ctx.moveTo(xx, sy - h / 2); 
        ctx.lineTo(xx, sy + h / 2 + depth); 
        ctx.stroke(); 
    }
    // Horizontal net lines
    for (let i = 0; i < 6; i++) { // Increased to 6 for tighter grid spacing
        const yy = sy - h / 2 + i * (h + depth) / 5; 
        ctx.beginPath(); 
        ctx.moveTo(x - w / 2, yy); 
        ctx.lineTo(x + w / 2, yy); 
        ctx.stroke(); 
    }

    // 3. Solid Goal Posts (Main Outline)
    ctx.strokeStyle = 'rgba(255,255,255,.92)'; 
    ctx.lineWidth = 7; 
    ctx.lineCap = 'round';
    ctx.shadowBlur = 18; // Re-enable shadow for prominent posts
    
    ctx.beginPath(); 
    ctx.moveTo(x - w / 2, sy + h / 2); 
    ctx.lineTo(x - w / 2, sy - h / 2); // Left Post
    ctx.lineTo(x + w / 2, sy - h / 2); // Crossbar
    ctx.lineTo(x + w / 2, sy + h / 2); // Right Post
    ctx.stroke();

    // 4. Net Base Line (Closes the visual box at the bottom)
    ctx.strokeStyle = 'rgba(255,255,255,.40)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, sy + h / 2 + depth);
    ctx.lineTo(x + w / 2, sy + h / 2 + depth);
    ctx.stroke();
    
    // 5. Text Label
    ctx.fillStyle = 'rgba(255,255,255,.9)'; 
    ctx.font = '900 11px system-ui'; 
    ctx.textAlign = 'center';
    
    ctx.restore();
}
    function drawHiddenOwnGoal() {
    const { x, y, w, h, depth } = hiddenOwnGoal; 
    const sy = y - cameraY;
    
    // Early exit if off-screen
    if (sy < -160 || sy > H + 160) return;
    
    ctx.save();
    
    // 1. Goal Shadow & Backing Fill
    ctx.shadowColor = 'rgba(0,0,0,.35)'; 
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(239,71,111,.15)'; 
    ctx.fillRect(x - w / 2, sy - h / 2, w, h + depth);
    
    // 2. The Net Mesh (Drawn first so posts sit on top)
    ctx.strokeStyle = 'rgba(255,255,255,.20)'; 
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0; // Turn off shadows for the thin net lines to prevent blurriness
    
    // Vertical net lines
    for (let i = 0; i < 8; i++) { 
        const xx = x - w / 2 + i * w / 7; 
        ctx.beginPath(); 
        ctx.moveTo(xx, sy - h / 2); 
        ctx.lineTo(xx, sy + h / 2 + depth); 
        ctx.stroke(); 
    }
    // Horizontal net lines
    for (let i = 0; i < 6; i++) { // Increased to 6 for tighter grid spacing
        const yy = sy - h / 2 + i * (h + depth) / 5; 
        ctx.beginPath(); 
        ctx.moveTo(x - w / 2, yy); 
        ctx.lineTo(x + w / 2, yy); 
        ctx.stroke(); 
    }

    // 3. Solid Goal Posts (Main Outline)
    ctx.strokeStyle = 'rgba(255,209,102,.15)'; 
    ctx.lineWidth = 7; 
    ctx.lineCap = 'round';
    ctx.shadowBlur = 18; // Re-enable shadow for prominent posts
    
    ctx.beginPath(); 
    ctx.moveTo(x - w / 2, sy + h / 2); 
    ctx.lineTo(x - w / 2, sy - h / 2); // Left Post
    ctx.lineTo(x + w / 2, sy - h / 2); // Crossbar
    ctx.lineTo(x + w / 2, sy + h / 2); // Right Post
    ctx.stroke();

    // 4. Net Base Line (Closes the visual box at the bottom)
    ctx.strokeStyle = 'rgba(255,255,255,.40)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, sy + h / 2 + depth);
    ctx.lineTo(x + w / 2, sy + h / 2 + depth);
    ctx.stroke();
    
    // 5. Text Label
    ctx.fillStyle = 'rgba(255,255,255,.9)'; 
    ctx.font = '900 11px system-ui'; 
    ctx.textAlign = 'center';
    ctx.fillText('YOUR GOAL', x, sy + h / 2 + depth + 20);
    
    ctx.restore();
}

    function drawKeeper(dt) {

    const sy = keeper.y - cameraY;

    if (sy < -130 || sy > H + 130) return;

    if (keeper.state === 'idle') {
        keeper.x = W/2 + Math.sin(performance.now()/420) * Math.min(70, W*.18);
    } else {
        keeper.x = lerp(keeper.x, keeper.tx, .16);
        keeper.dive = clamp(keeper.dive + dt*3, 0, 1);
    }

    ctx.save();

    ctx.translate(keeper.x, sy);

    ctx.rotate(
        keeper.side * keeper.dive * .38
    );

    ctx.shadowColor = 'rgba(0,0,0,.38)';
    ctx.shadowBlur = 16;

    const keeperWidth = 80;
    const keeperHeight = 80;

    ctx.drawImage(
        keeperImg,
        -keeperWidth / 2,
        -keeperHeight / 2,
        keeperWidth,
        keeperHeight
    );

    ctx.restore();
}

    
    function drawBall() {

    for (let i = 0; i < ball.trail.length; i++) {

        const p = ball.trail[i];
        const s = worldToScreen(p.x, p.y);

        const a = (i + 1) / ball.trail.length;

        ctx.globalAlpha = a * .25;

        ctx.fillStyle = ball.ghost
            ? '#ff7b00'
            : '#ffffff';

        ctx.beginPath();
        ctx.arc(
            s.x,
            s.y,
            ball.r * a * .9,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    ctx.globalAlpha = 1;

    const s = worldToScreen(ball.x, ball.y);

    ctx.save();

    ctx.translate(s.x, s.y);

    // FIRE AURA
    if (ball.moving) {

        const pulse =
            1 +
            Math.sin(performance.now() * 0.02) *
            0.15;

        const aura =
            ctx.createRadialGradient(
                0,
                0,
                0,
                0,
                0,
                40 * pulse
            );

        aura.addColorStop(
            0,
            "rgba(255,255,200,.9)"
        );

        aura.addColorStop(
            0.3,
            "rgba(255,180,0,.8)"
        );

        aura.addColorStop(
            0.7,
            "rgba(255,60,0,.45)"
        );

        aura.addColorStop(
            1,
            "rgba(255,0,0,0)"
        );

        ctx.globalCompositeOperation =
            "lighter";

        ctx.fillStyle = aura;

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            40 * pulse,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.globalCompositeOperation =
            "source-over";
    }

    ctx.rotate(ball.spin);

    ctx.shadowColor =
        "rgba(255,120,0,.9)";

    ctx.shadowBlur = 30;

    ctx.fillStyle = "#fff";

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        ball.r,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.strokeStyle = "#111";

    ctx.lineWidth = 2;

    for (let i = 0; i < 5; i++) {

        ctx.beginPath();

        ctx.moveTo(0, 0);

        ctx.lineTo(
            Math.cos(i * 1.256) * ball.r,
            Math.sin(i * 1.256) * ball.r
        );

        ctx.stroke();
    }

    ctx.restore();
}
    function drawDrag() {
        if (!drag) return;
        const b = worldToScreen(ball.x, ball.y);
        const dx = drag.x - b.x, dy = drag.y - b.y, len = Math.hypot(dx, dy);
        ctx.save();
        ctx.strokeStyle = dy > 0 ? 'rgba(255,209,102,.9)' : 'rgba(255,255,255,.75)';
        ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.setLineDash([12, 8]);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(drag.x, drag.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '800 12px system-ui'; ctx.textAlign = 'center';
        const power = Math.round(clamp(len / 150, 0, 1) * 100);
        ctx.fillText('POWER ' + power + '%', b.x, b.y - 28);
        ctx.restore();
    }
function drawEffects(dt) {

    ctx.globalCompositeOperation = "lighter";

    for (const p of particles) {

        p.life -= dt;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        p.vx *= 0.97;
        p.vy *= 0.94;

        const s = worldToScreen(
            p.x,
            p.y
        );

        const alpha =
            clamp(
                p.life,
                0,
                1
            );

        ctx.globalAlpha =
            alpha;

        ctx.fillStyle =
            `rgba(255,120,0,${alpha})`;

        ctx.beginPath();

        ctx.arc(
            s.x,
            s.y,
            p.r * 2,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    particles =
        particles.filter(
            p => p.life > 0
        );

    // rings

    for (const r of rings) {

        r.life -= dt;
        r.r += 220 * dt;

        const s =
            worldToScreen(
                r.x,
                r.y
            );

        const alpha =
            clamp(
                r.life,
                0,
                1
            );

        ctx.globalAlpha =
            alpha * 0.5;

        ctx.strokeStyle =
            `rgba(255,160,0,${alpha})`;

        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.arc(
            s.x,
            s.y,
            r.r,
            0,
            Math.PI * 2
        );

        ctx.stroke();
    }

    rings =
        rings.filter(
            r => r.life > 0
        );

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation =
        "source-over";
}
function spawnFireBall(x, y) {

    for (let i = 0; i < 2; i++) {

        const a = Math.random() * Math.PI * 2;
        const sp = 20 + Math.random() * 100;

        particles.push({
            x,
            y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            r: 2 + Math.random() * 4,
            life: 0.15 + Math.random() * 0.25,
            color: "#ff6a00"
        });
    }
}
    function directFinalX() {
        const gy = opponentGoal.y + opponentGoal.h * .15;
        const t = clamp((ball.y - gy) / Math.max(1, -ball.vy), 0, 3);
        return clamp(ball.x + ball.vx * t + Math.sin(t * 8) * ball.spin * 10, opponentGoal.x - opponentGoal.w * .43, opponentGoal.x + opponentGoal.w * .43);
    }

    function startShot(screenX, screenY) {
        if (!running || ball.moving || shots <= 0) return;
        const b = worldToScreen(ball.x, ball.y);
        const dx = screenX - b.x, dy = screenY - b.y;
        const len = clamp(Math.hypot(dx, dy), 20, 175);
        const nx = dx / (Math.hypot(dx, dy) || 1), ny = dy / (Math.hypot(dx, dy) || 1);
        const power = lerp(380, 780, len / 175);
        shots--; shotsEl.textContent = shots;
        ball.moving = true; ball.trail = [];
        titleEl.style.opacity = '.18';

        if (ny > 0.18) {
            // Secret reverse shot: hardcoded cinematic route. Hidden own post is invisible but exists in the world.
            ball.ghost = true;
            shot = {
                type: 'reverse', t: 0, phase: 0,
                sx: ball.x, sy: ball.y,
                hx: hiddenOwnGoal.x + clamp(nx * hiddenOwnGoal.w * .38, -hiddenOwnGoal.w * .38, hiddenOwnGoal.w * .38),
                hy: hiddenOwnGoal.y - hiddenOwnGoal.h / 2,
                gx: opponentGoal.x + clamp(nx * opponentGoal.w * .22, -opponentGoal.w * .22, opponentGoal.w * .22),
                gy: opponentGoal.y,
            };
            statusEl.textContent = 'Curve';
            hintEl.textContent = 'The ball is bending through the field...';
        } else {
            // Normal visible-goal shot: player can curve/spin, but keeper computes landing and saves.
            ball.ghost = false;
            ball.vx = nx * power * .52;
            ball.vy = ny * power;
            ball.spin = clamp(nx * 2.2, -2.2, 2.2);
            shot = { type: 'direct', saved: false, t: 0 };
            keeper.state = 'dive'; keeper.tx = directFinalX(); keeper.side = Math.sign(keeper.tx - W / 2) || 1;
            statusEl.textContent = 'Read';
            hintEl.textContent = 'Keeper calculated the final point.';
        }

}

    function updateDirect(dt) {
        
        ball.vx +=
    ball.spin *
    220 *
    dt;
        ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.spin += ball.vx * dt * .04;
        ball.vx *= 0.995;
        // Sideline check
        if(ball.x < 0 || ball.x > W){
            showToast('OUT');
            statusEl.textContent = 'Out';

            shot = null;

            setTimeout(() => {
                nextShot();
            }, 300);

            return;
        }

        // SIDELINE OUT
        if (ball.x < 0 || ball.x > W) {
            showToast('OUT');
            statusEl.textContent = 'Out';

            setTimeout(() => {
                nextShot();
            }, 300);

            shot = null;
            return;
        }

        const saveLine = keeper.y + 4;
        if (!shot.saved && ball.y < saveLine + 18 && ball.y > saveLine - 34) {
            keeper.tx = clamp(ball.x, opponentGoal.x - opponentGoal.w * .44, opponentGoal.x + opponentGoal.w * .44);
            if (Math.abs(ball.x - keeper.x) < 82 || true) {
                shot.saved = true; ball.vx = (ball.x - keeper.x) * 4; ball.vy = 390; shake = 10;
                spawn(ball.x, ball.y, '#06d6a0', 24, 1.15); showToast('SAVED BY Vozinha'); statusEl.textContent = 'Saved';
            }
        }
        if (ball.y > 900 || ball.x < -80 || ball.x > W + 80) { setTimeout(nextShot, 260); shot = null; }
    }

    function bezier(p0, p1, p2, p3, t) {
        const u = 1 - t;
        return {
            x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
            y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
        };
    }

    function updateReverse(dt) {
        shot.t += dt;
        if (shot.phase === 0) {
            const T = clamp(shot.t / 1.15, 0, 1), e = ease(T);
            const p = bezier({ x: shot.sx, y: shot.sy }, { x: shot.sx + 70, y: shot.sy + 260 }, { x: shot.hx - 80, y: shot.hy - 120 }, { x: shot.hx, y: shot.hy }, e);
            ball.x = p.x; ball.y = p.y; ball.spin += dt * 12;
            if (T >= 1) {
                shot.phase = 1; shot.t = 0; shake = 14;
                spawn(ball.x, ball.y, '#ffd166', 36, 1.35); showToast('BAR REBOUND'); statusEl.textContent = 'Rebound';
            }
        } else if (shot.phase === 1) {
            const T = clamp(shot.t / 1.45, 0, 1), e = ease(T);
            const p = bezier({ x: shot.hx, y: shot.hy }, { x: shot.hx + 140, y: shot.hy - 520 }, { x: shot.gx - 160, y: shot.gy + 300 }, { x: shot.gx, y: shot.gy + 18 }, e);
            ball.x = p.x; ball.y = p.y; ball.spin += dt * 16;
            if (T > .72) keeper.tx = opponentGoal.x + (shot.gx < opponentGoal.x ? opponentGoal.w * .38 : -opponentGoal.w * .38), keeper.state = 'dive', keeper.side = Math.sign(keeper.tx - W / 2) || 1;
            if (T >= 1) {
                shot.phase = 2; shot.t = 0; score++; scoreEl.textContent = score; shake = 18;
                spawn(ball.x, ball.y, '#ef476f', 46, 1.5); showToast('GOAL — KEEPER FROZEN'); statusEl.textContent = 'Goal';
            }
        } else {
            shot.t += dt;
            if (shot.t > .55) { nextShot(); shot = null; }
        }
    }

    function nextShot() {
        if (shots <= 0) {
            startEl.style.display = 'flex';
            startEl.querySelector('h2').textContent = 'Match Over';
            startEl.querySelector('p').textContent = `You scored ${score}. Normal shots were impossible. The broken route was the only route.`;
            startEl.querySelector('button').textContent = 'PLAY AGAIN';
            running = false;
            return;
        }
        resetBall(false); titleEl.style.opacity = '1'; hintEl.textContent = 'Drag from the ball to shoot. The keeper reads every normal shot.';
    }
    function drawFloodlights(){

    const lights = [
        [40,40],
        [W-40,40],
        [40,H*.3],
        [W-40,H*.3]
    ];

    for(const l of lights){

        const grad =
            ctx.createRadialGradient(
                l[0],
                l[1],
                0,
                l[0],
                l[1],
                220
            );

        grad.addColorStop(
            0,
            "rgba(255,255,255,.15)"
        );

        grad.addColorStop(
            1,
            "rgba(255,255,255,0)"
        );

        ctx.fillStyle = grad;

        ctx.beginPath();

        ctx.arc(
            l[0],
            l[1],
            220,
            0,
            Math.PI*2
        );

        ctx.fill();
    }
}

    function update(dt) {
        if (!running) return;
        if (ball.moving) {

    spawnFireBall(
        ball.x,
        ball.y
    );

    ball.trail.push({
        x: ball.x,
        y: ball.y
    });

    if (ball.trail.length > 18)
        ball.trail.shift();

    if (shot?.type === 'reverse')
        updateReverse(dt);
    else if (shot?.type === 'direct')
        updateDirect(dt);
}
       zoom =
    lerp(
        zoom,
        ball.moving ? 1.15 : 1,
        0.05
    );
targetCameraY =
    ball.y - H * .65;



cameraY =
    lerp(
        cameraY,
        targetCameraY,
        0.105
    );
    shake = Math.max(0, shake - dt * 38);
    }

    function render(dt) {

    ctx.save();

    if (shake > 0)
        ctx.translate(
            (Math.random()-.5)*shake,
            (Math.random()-.5)*shake
        );

    ctx.translate(W/2,H/2);
    ctx.scale(zoom,zoom);
    ctx.translate(-W/2,-H/2);

    drawField();
    drawOpponentGoal();
    drawHiddenOwnGoal();
    drawKeeper(dt);
    drawEffects(dt);
    drawBall();
    drawDrag();
    drawFloodlights();

    ctx.restore();
}
    function loop(now) {
        const dt = Math.min(.033, (now - last) / 1000); last = now;
        update(dt); render(dt); requestAnimationFrame(loop);
    }

    function pointerPos(e) {
        const r = canvas.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function down(e) {
        e.preventDefault(); if (!running || ball.moving) return;
        const p = pointerPos(e), b = worldToScreen(ball.x, ball.y);
        if (Math.hypot(p.x - b.x, p.y - b.y) < 70) drag = p;
    }
    function move(e) { if (!drag) return; e.preventDefault(); drag = pointerPos(e); }
    function up(e) {
        if (!drag) return; e.preventDefault(); const p = drag; drag = null; startShot(p.x, p.y);
    }

    playBtn.addEventListener('click', () => {
        score = 0; shots = 10; scoreEl.textContent = score; shotsEl.textContent = shots;
        running = true; startEl.style.display = 'none'; resetBall(true); showToast('MATCH START');
    });
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up, { passive: false });
    canvas.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('resize', resize);
    document.addEventListener('gesturestart', e => e.preventDefault());

    resize(); requestAnimationFrame(loop);
})();