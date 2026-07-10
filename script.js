(() => {
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");

    const phone = document.getElementById("phone");
    const scoreEl = document.getElementById("score");
    const shotsEl = document.getElementById("shots");
    const statusEl = document.getElementById("status");
    const startEl = document.getElementById("start");
    const playBtn = document.getElementById("play");
    const toastEl = document.getElementById("toast");
    const hintEl = document.getElementById("hint");
    const titleEl = document.getElementById("title");

    const IMG = {
        playerIdle: loadImage("images/player_idle.png"),
        playerStep: loadImage("images/player_step.png"),
        playerKick: loadImage("images/player_kick.png"),

        keeperIdle: loadImage("images/idle.png"),
        keeperLeft: loadImage("images/left.png"),
        keeperRight: loadImage("images/right.png"),

        ball: loadImage("images/ball_pixel.png")
    };


    let W = 0;
    let H = 0;
    let DPR = 1;
    let last = performance.now();

    let running = false;
    let score = 0;
    let shots = 1;
    let totalAttempts = 0;
    let hintTrigger = 0;
    let quoteStage = 0;

    let cameraY = 0;
    let targetCameraY = 0;
    let shake = 0;
    let zoom = 1;

    let ball;
    let keeper;
    let player;
    let opponentGoal;
    let hiddenOwnGoal;

    let drag = null;
    let aimData = null;
    let shot = null;
    let kickTimer = 0;
    let kickQueued = false;
    let particles = [];
    let rings = [];

    const SECRET_ANGLE_DEG = 1;
    const SECRET_POWER = 0.95;
    const BALL_SPAWN_WORLD_Y = 800;
    const OPPONENT_GOAL_WORLD_Y = 520;
    const HIDDEN_GOAL_WORLD_Y = 2200;
    const BALL_IDLE_SCREEN_Y_RATIO = 0.68;
    const DIRECT_SHOT_MAX_DISTANCE = 1000;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    function loadImage(src) {
        const img = new Image();
        img.src = src;
        return img;
    }

    function randInt(a, b) {
        return Math.floor(a + Math.random() * (b - a + 1));
    }

    function resize() {
        DPR = Math.min(2, window.devicePixelRatio || 1);
        W = phone.clientWidth;
        H = phone.clientHeight;

        canvas.width = Math.floor(W * DPR);
        canvas.height = Math.floor(H * DPR);
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";

        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.imageSmoothingEnabled = false;

        buildWorld();
        resetBall(true);
    }

    function buildWorld() {
        opponentGoal = {
            x: W / 2,
            y: OPPONENT_GOAL_WORLD_Y,
            w: Math.min(W * 0.75, 320),
            h: 90,
            depth: 36
        };

        hiddenOwnGoal = {
            x: W / 2,
            y: HIDDEN_GOAL_WORLD_Y,
            w: opponentGoal.w,
            h: opponentGoal.h,
            depth: opponentGoal.depth
        };

        ball = {
            x: W / 2,
            y: BALL_SPAWN_WORLD_Y,
            r: 8,
            vx: 0,
            vy: 0,
            moving: false,
            ghost: false,
            trail: [],
            spin: 0
        };

        player = {
            x: ball.x - 55,
            y: ball.y + 120,

            startX: ball.x - 55,
            startY: ball.y + 120,

            targetX: ball.x - 6,
            targetY: ball.y + 8,

            w: 64,
            h: 96,

            frame: "idle",
            bob: 0,
            sway: 0,
            runT: 0,
            runDuration: 0,
            running: false
        };

        keeper = {
            x: W / 2,
            y: opponentGoal.y + 25,
            w: 60,
            h: 60,
            side: 0,
            startX: W / 2,
            tx: W / 2,
            state: "idle",
            diveFrame: "idle"
        };
    }

    function resetBall(instant = false) {

        ball.x = W / 2;
        ball.y = BALL_SPAWN_WORLD_Y;
        ball.vx = 0;
        ball.vy = 0;
        ball.moving = false;
        ball.ghost = false;
        ball.trail = [];
        ball.spin = 0;
        resetPlayerPosition();

        keeper.x = W / 2;
        keeper.tx = W / 2;
        keeper.state = "idle";
        keeper.side = 0;
        keeper.diveFrame = "idle";

        drag = null;
        aimData = null;
        shot = null;
        kickQueued = false;
        kickTimer = 0;
        targetCameraY =
            ball.y - H * BALL_IDLE_SCREEN_Y_RATIO;

        if (instant) {
            cameraY = targetCameraY;
        }

        zoom = 1;
        statusEl.textContent = "Ready";
        hintEl.textContent = "Drag from the ball to aim. Release to kick.";
    }

    function worldToScreen(x, y) {
        return { x, y: y - cameraY };
    }

    function screenToWorld(x, y) {
        return { x, y: y + cameraY };
    }

    function showToast(text) {
        toastEl.textContent = text;
        toastEl.classList.add("show");
        clearTimeout(showToast.t);
        showToast.t = setTimeout(() => toastEl.classList.remove("show"), 1100);
    }

    function showQuote(text, callback) {
        startEl.style.display = "flex";
        startEl.querySelector("h2").textContent = "???";
        startEl.querySelector("p").textContent = text;
        startEl.querySelector("button").textContent = "CONTINUE";

        playBtn.onclick = () => {
            startEl.style.display = "none";
            callback && callback();
        };
    }

    function triggerHintSequence() {
        running = false;

        showQuote(
            "Huh, You couldn't crack the code as a BUETian. SHAME SHAME!!!!!!!",
            () => {
                showQuote(
                    "Why can't we go backwards, for once? Backwards, really fast. Fast as we can. Really put the pedal to the metal, you know?\n--ReadyPlayerOne",
                    () => {
                        restartMatch();
                    }
                );
            }
        );
    }

    function restartMatch() {
        score = 0;
        shots = 1;
        totalAttempts = 0;
        quoteStage = 0;
        hintTrigger = randInt(25, 31);

        scoreEl.textContent = score;
        shotsEl.textContent = shots;

        running = true;
        startEl.style.display = "none";
        resetBall(true);
        showToast("MATCH START");
    }

    function hardPowerCurve(raw) {
        raw = clamp(raw, 0, 1);
        return Math.pow(raw, 1.85);
    }

    function angleBetweenVectors(ax, ay, bx, by) {
        const al = Math.hypot(ax, ay) || 1;
        const bl = Math.hypot(bx, by) || 1;

        const dot = (ax / al) * (bx / bl) + (ay / al) * (by / bl);
        const safeDot = clamp(dot, -1, 1);

        return Math.acos(safeDot) * 180 / Math.PI;
    }

    function isSecretShot(dx, dy, power01) {
        const hiddenVectorX = hiddenOwnGoal.x - ball.x;
        const hiddenVectorY = hiddenOwnGoal.y - ball.y;

        const angle = angleBetweenVectors(dx, dy, hiddenVectorX, hiddenVectorY);

        return power01 >= SECRET_POWER && angle <= SECRET_ANGLE_DEG;
    }

    function queueShot(screenX, screenY) {
        if (!running || ball.moving || kickQueued || shots <= 0) return;

        const b = worldToScreen(ball.x, ball.y);

        const dx = screenX - b.x;
        const dy = screenY - b.y;

        const dragLen = clamp(Math.hypot(dx, dy), 20, 190);

        const rawPower = dragLen / 190;
        const power01 = hardPowerCurve(rawPower);

        const nx = dx / (Math.hypot(dx, dy) || 1);
        const ny = dy / (Math.hypot(dx, dy) || 1);

        const secret = isSecretShot(dx, dy, power01);

        aimData = {
            dx,
            dy,
            nx,
            ny,
            power01,
            secret
        };

        player.runDuration =
            1.8 + Math.random() * 0.5;

        player.runT = 0;
        player.running = true;

        kickQueued = true;

        statusEl.textContent = "Run Up";
        hintEl.textContent = "Loading...";
    }

    function executeQueuedShot() {
        if (!aimData) return;

        shots--;
        totalAttempts++;
        shotsEl.textContent = shots;

        ball.moving = true;
        ball.trail = [];
        player.frame = "kick";

        const nx = aimData.nx;
        const ny = aimData.ny;
        const power = lerp(440, 880, aimData.power01);

        if (aimData.secret) {
            ball.ghost = true;

            shot = {
                type: "reverse",
                t: 0,
                sx: ball.x,
                sy: ball.y,

                gx: opponentGoal.x + clamp(
                    nx * opponentGoal.w * 0.22,
                    -opponentGoal.w * 0.22,
                    opponentGoal.w * 0.22
                ),

                gy: opponentGoal.y
            };

            statusEl.textContent = "Magic";
            hintEl.textContent = "The ball is bending through the field...";
        } else {
            ball.ghost = false;

            // 1% chance for an unstoppable direct hit
            const isLuckyGoal = Math.random() < 0.01;

            ball.vx = nx * power * 0.5;
            ball.vy = ny * power;
            ball.spin = clamp(nx * 2.2, -2.2, 2.2);

            shot = {
                type: "direct",
                saved: false,
                isLuckyGoal: isLuckyGoal,
                savedTimer: 0,
                t: 0
            };

            keeper.state = "dive";

            if (isLuckyGoal) {
                // Force trajectory into a corner so the 1% chance isn't wasted by bad aim
                const timeToGoal = Math.abs((opponentGoal.y - ball.y) / ball.vy);
                const targetCornerX = opponentGoal.x + (Math.random() > 0.5 ? 1 : -1) * (opponentGoal.w * 0.4);
                ball.vx = (targetCornerX - ball.x) / timeToGoal;
                ball.spin = 0; // Remove spin to keep trajectory clean

                // Keeper dives the wrong way
                keeper.tx = opponentGoal.x + (ball.vx > 0 ? -1 : 1) * opponentGoal.w * 0.4;
                keeper.side = Math.sign(keeper.tx - W / 2) || 1;
                keeper.diveFrame = keeper.side < 0 ? "left" : "right";

                hintEl.textContent = "Unstoppable Strike!";
            } else {
                // Normal block
                keeper.tx = clamp(ball.x + ball.vx * 0.45, opponentGoal.x - opponentGoal.w * 0.42, opponentGoal.x + opponentGoal.w * 0.42);
                keeper.side = Math.sign(keeper.tx - W / 2) || 1;
                keeper.diveFrame = keeper.side < 0 ? "left" : "right";

                hintEl.textContent = "Saved";
            }
        }

        aimData = null;
        kickQueued = false;
    }

    function updateDirect(dt) {
        if (shot.saved && !shot.isLuckyGoal) {
            shot.savedTimer += dt;
            ball.x = keeper.x;
            ball.y = keeper.y;
            ball.vx = 0;
            ball.vy = 0;

            if (shot.savedTimer > 0.8) {
                shot = null;
                nextShot();
            }
            return;
        }

        ball.vx += ball.spin * 220 * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.spin += ball.vx * dt * 0.04;
        ball.vx *= 0.995;

        const saveLine = keeper.y + 4;

        // Normal save collision (ignored if it's a lucky goal)
        if (!shot.isLuckyGoal && !shot.saved && ball.y < saveLine + 22 && ball.y > saveLine - 38) {
            shot.saved = true;
            shot.savedTimer = 0;
            ball.x = keeper.x;
            ball.y = keeper.y;
            ball.vx = 0;
            ball.vy = 0;

            shake = 10;
            spawn(ball.x, ball.y, "#06d6a0", 24, 1.1);

            showToast("SAVED");
            statusEl.textContent = "Saved";
            return;
        }

        // Direct Goal Detection
        if (shot.isLuckyGoal && ball.y <= opponentGoal.y + 10 && !shot.scored) {
            shot.scored = true; // Prevent multiple triggers
            ball.vx *= 0.1; // Slow down ball inside the net
            ball.vy *= 0.1;

            score++;
            scoreEl.textContent = score;

            shake = 20;
            spawn(ball.x, ball.y, "#ef476f", 60, 1.7);

            showToast("DIRECT GOAL!");
            statusEl.textContent = "Goal";

            setTimeout(() => {
                shot = null;
                nextShot();
            }, 1200);
            return;
        }

        const tooFarFromSpawn = Math.abs(ball.y - BALL_SPAWN_WORLD_Y) > 1200;

        if (!shot.scored && (tooFarFromSpawn || ball.x < -100 || ball.x > W + 100)) {
            shot = null;
            setTimeout(nextShot, 350);
        }
    }

    function nextShot() {
        if (score >= 1) {
            startEl.style.display = "flex";
            startEl.querySelector("h2").textContent = "GOAL";
            startEl.querySelector("p").textContent = "You cracked the impossible route.";
            
            // Change the button text to indicate a link
            startEl.querySelector("button").textContent = "CLAIM REWARD"; // Change this text as needed

            // Change the click behavior to open your link
            playBtn.onclick = () => {
                // Replace the URL below with your actual desired link
                window.location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1"; 
                
                // Note: If you want it to open in a new tab instead, use this:
                // window.open("https://your-desired-link.com", "_blank");
            };
            running = false;
            return;
        }

        if (totalAttempts >= hintTrigger) {
            triggerHintSequence();
            return;
        }

        shots = 1;
        shotsEl.textContent = shots;
        resetBall(false);
    }

    function updateKickAnimation(dt) {
        if (!kickQueued) return;

        if (player.running) {

            player.runT += dt;

            const t =
                clamp(
                    player.runT /
                    player.runDuration,
                    0,
                    1
                );

            const e = ease(t);

            player.x =
                lerp(
                    player.startX,
                    player.targetX,
                    e
                );

            player.y =
                lerp(
                    player.startY,
                    player.targetY,
                    e
                );

            const frameCycle =
                Math.floor(player.runT * 8) % 2;

            player.frame =
                frameCycle
                    ? "step"
                    : "idle";

            if (t >= 1) {

                player.running = false;

                player.frame = "kick";

                setTimeout(() => {
                    executeQueuedShot();
                }, 120);
            }

            return;
        }
    }
    function resetPlayerPosition() {

        player.startX = ball.x - 55;
        player.startY = ball.y + 120;

        player.targetX = ball.x - 6;
        player.targetY = ball.y + 8;

        player.x = player.startX;
        player.y = player.startY;

        player.runT = 0;
        player.running = false;

        player.frame = "idle";
    }


    function bezier(p0, p1, p2, p3, t) {
        const u = 1 - t;

        return {
            x:
                u * u * u * p0.x +
                3 * u * u * t * p1.x +
                3 * u * t * t * p2.x +
                t * t * t * p3.x,

            y:
                u * u * u * p0.y +
                3 * u * u * t * p1.y +
                3 * u * t * t * p2.y +
                t * t * t * p3.y
        };
    }
    function updateReverse(dt) {

        shot.t += dt;

        const T = clamp(
            shot.t / 1.4,
            0,
            1
        );

        const e = ease(T);

        const p = bezier(

            {
                x: shot.sx,
                y: shot.sy
            },

            {
                x: shot.sx - 120,
                y: shot.sy + 350
            },

            {
                x: shot.gx + 120,
                y: shot.gy + 250
            },

            {
                x: shot.gx,
                y: shot.gy + 18
            },

            e
        );

        ball.x = p.x;
        ball.y = p.y;
        ball.spin += dt * 12;

        if (T > 0.7) {

            keeper.state = "dive";

            keeper.tx =
                opponentGoal.x +
                (
                    shot.gx < opponentGoal.x
                        ? opponentGoal.w * 0.38
                        : -opponentGoal.w * 0.38
                );

            keeper.side =
                Math.sign(
                    keeper.tx - W / 2
                ) || 1;

            keeper.diveFrame =
                keeper.side < 0
                    ? "left"
                    : "right";
        }

        if (T >= 1) {

            score++;

            scoreEl.textContent = score;

            shake = 20;

            spawn(
                ball.x,
                ball.y,
                "#ef476f",
                60,
                1.7
            );

            showToast("GOAL");

            statusEl.textContent = "Goal";

            shot = {
                type: "goalPause",
                t: 0
            };
        }
    }
    function update(dt) {
        if (!running) return;

        updateKickAnimation(dt);

        if (ball.moving) {
            spawnFireBall(ball.x, ball.y);

            ball.trail.push({ x: ball.x, y: ball.y });
            if (ball.trail.length > 18) ball.trail.shift();

            if (shot?.type === "reverse") updateReverse(dt);
            else if (shot?.type === "goalPause") {

                shot.t += dt;

                if (shot.t > 0.75) {

                    shot = null;

                    nextShot();
                }
            }
            else if (shot?.type === "direct") updateDirect(dt);
        }

        const cameraFocusY =
            ball.moving
                ? ball.y - H * 0.65
                : ball.y - H * BALL_IDLE_SCREEN_Y_RATIO;

        targetCameraY = cameraFocusY;

        cameraY = lerp(
            cameraY,
            targetCameraY,
            ball.moving ? 0.105 : 0.16
        );

        shake = Math.max(0, shake - dt * 38);
    }

    function drawField() {
        ctx.fillStyle = "#277e37";
        ctx.fillRect(0, 0, W, H);

        const stripeH = 64;
        const startY = Math.floor(cameraY / stripeH) * stripeH;

        for (let y = startY; y < cameraY + H + stripeH; y += stripeH) {
            const sy = y - cameraY;
            ctx.fillStyle = Math.floor(y / stripeH) % 2 ? "#2f9140" : "#277e37";
            ctx.fillRect(0, sy, W, stripeH);
        }

        drawPitchLines();
    }

    function drawPixelCrowd() {
        const crowdTop =
            opponentGoal.y
            - cameraY
            - 270;

        ctx.fillStyle = "#151515";
        ctx.fillRect(0, crowdTop, W, 220);

        const colors = ["#f7fbff", "#ffd166", "#ef476f", "#06d6a0", "#4cc9f0"];

        for (let y = crowdTop + 20; y < crowdTop + 200; y += 8) {
            for (let x = 0; x < W; x += 8) {
                ctx.fillStyle = colors[(x + y) % colors.length];
                ctx.fillRect(x, y, 4, 4);
            }
        }
    }

    function drawPitchLines() {
        const g = opponentGoal;

        // Accurate goal line placement (front of the goal)
        const goalLineY = g.y + g.h / 2;
        const sy = goalLineY - cameraY;

        // Penalty spot = Ball spawn point (800)
        const penaltySpotWorldY = 800;
        const penSpotY = penaltySpotWorldY - cameraY;

        // Calculate vertical units based on real football rules (Spot is 12 yards out)
        const twelveYards = penaltySpotWorldY - goalLineY;
        const boxH = twelveYards * 1.5;            // 18-yard box height
        const goalBoxH = twelveYards * 0.5;        // 6-yard box height
        const arcRadius = twelveYards * (10 / 12); // 10-yard radius for D-box arc

        // Keep horizontal dimensions beautifully responsive
        const boxW = Math.min(W * 0.92, 460);
        const goalBoxW = Math.min(W * 0.58, 250);

        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,.75)";
        ctx.lineWidth = 2;
        ctx.lineCap = "square";

        // Draw Goal line
        ctx.beginPath();
        ctx.moveTo(20, sy);
        ctx.lineTo(W - 20, sy);
        ctx.stroke();

        // Draw 6-yard Goal Box
        ctx.strokeRect(g.x - goalBoxW / 2, sy, goalBoxW, goalBoxH);

        // Draw 18-yard Penalty Box
        ctx.strokeRect(g.x - boxW / 2, sy, boxW, boxH);

        // Draw Penalty Mark (exactly at the ball's spawn point)
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(g.x, penSpotY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw Perfect D-box (Penalty Arc)
        // Distance from spot to box edge is 6 yards, radius is 10 yards.
        // The intersection angle is mathematically exactly arccos(6/10) = arccos(0.6)
        const arcAngle = Math.acos(0.6);

        ctx.beginPath();
        ctx.arc(
            g.x,
            penSpotY,
            arcRadius,
            Math.PI / 2 - arcAngle, // Start angle
            Math.PI / 2 + arcAngle  // End angle
        );
        ctx.stroke();

        ctx.restore();
    }

    function drawGoal(goal, hidden = false) {
        const { x, y, w, h, depth } = goal;
        const sy = y - cameraY;

        if (sy < -180 || sy > H + 180) return;

        if (hidden && !(shot?.type === "reverse")) return;

        ctx.save();

        ctx.fillStyle = hidden ? "rgba(255,209,102,.22)" : "rgba(255,255,255,.20)";
        ctx.fillRect(Math.floor(x - w / 2), Math.floor(sy - h / 2), Math.floor(w), Math.floor(h + depth));

        ctx.strokeStyle = hidden ? "#ffd166" : "#ffffff";
        ctx.lineWidth = 5;

        ctx.beginPath();
        ctx.moveTo(x - w / 2, sy + h / 2);
        ctx.lineTo(x - w / 2, sy - h / 2);
        ctx.lineTo(x + w / 2, sy - h / 2);
        ctx.lineTo(x + w / 2, sy + h / 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255,255,255,.35)";
        ctx.lineWidth = 1;

        for (let i = 1; i < 7; i++) {
            const xx = x - w / 2 + i * w / 7;
            ctx.beginPath();
            ctx.moveTo(xx, sy - h / 2);
            ctx.lineTo(xx, sy + h / 2 + depth);
            ctx.stroke();
        }

        for (let i = 1; i < 5; i++) {
            const yy = sy - h / 2 + i * (h + depth) / 5;
            ctx.beginPath();
            ctx.moveTo(x - w / 2, yy);
            ctx.lineTo(x + w / 2, yy);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawPlayer() {
        const s = worldToScreen(player.x, player.y);
        const t =
            performance.now() * 0.004;

        const bob =
            Math.sin(t) * 2.5;

        const sway =
            Math.sin(t * 0.6) * 1.5;

        let img = IMG.playerIdle;
        if (player.frame === "step") img = IMG.playerStep;
        if (player.frame === "kick") img = IMG.playerKick;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        if (img.complete && img.naturalWidth) {
            ctx.drawImage(img, Math.floor(s.x - player.w / 2 + sway), Math.floor(s.y - player.h + bob), player.w, player.h);
        } else {
            drawPixelHuman(s.x, s.y + bob, "#4cc9f0", "#ffffff");
        }

        ctx.restore();
    }

    function drawPixelHuman(x, y, shirt, skin) {
        ctx.fillStyle = skin;
        ctx.fillRect(x - 6, y - 62, 12, 12);

        ctx.fillStyle = shirt;
        ctx.fillRect(x - 10, y - 48, 20, 25);

        ctx.fillStyle = "#111";
        ctx.fillRect(x - 11, y - 23, 8, 22);
        ctx.fillRect(x + 3, y - 23, 8, 22);

        ctx.fillStyle = skin;
        ctx.fillRect(x - 18, y - 43, 8, 18);
        ctx.fillRect(x + 10, y - 43, 8, 18);
    }
    function drawKeeper() {
        let drawW = keeper.w;
        let drawH = keeper.h;

        const sy = keeper.y - cameraY;
        if (sy < -140 || sy > H + 140) return;

        if (keeper.state === "dive") {
            // drawW *= 3;
            // drawH *= 1.2;
            keeper.x = lerp(keeper.x, keeper.tx, 0.1);
        }

        // Calculate animation variables
        const t = performance.now() * 0.004;

        // Only apply bob and sway when standing idle
        const isIdle = keeper.state !== "dive";
        const bob = isIdle ? Math.sin(t) * 2.5 : 0;
        const sway = isIdle ? Math.sin(t * 0.6) * 1.5 : 0;

        let img = IMG.keeperIdle;

        if (keeper.diveFrame === "left") img = IMG.keeperLeft;
        if (keeper.diveFrame === "right") img = IMG.keeperRight;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        if (img.complete && img.naturalWidth) {
            ctx.drawImage(
                img,
                Math.floor(keeper.x - drawW / 2 + sway), // Added sway
                Math.floor(sy - drawH / 2 + bob),        // Added bob
                drawW,
                drawH
            );
        } else {
            drawPixelHuman(
                Math.floor(keeper.x + sway),             // Added sway
                Math.floor(sy + 35 + bob),               // Added bob
                "#ef476f",
                "#f5c49b"
            );
        }

        ctx.restore();
    }
    // function drawKeeper() {
    //     let drawW = keeper.w;
    //     let drawH = keeper.h;
    //     const t =
    //         performance.now() * 0.004;

    //     const bob =
    //         Math.sin(t) * 2.5;

    //     const sway =
    //         Math.sin(t * 0.6) * 1.5;
    //     const sy = keeper.y - cameraY;
    //     if (sy < -140 || sy > H + 140) return;


    //     if (keeper.state === "dive") {
    //         drawW *= 3;
    //         drawH *= 1.2;

    //         keeper.x = lerp(keeper.x, keeper.tx, 0.22);
    //     }

    //     let img = IMG.keeperIdle;

    //     if (keeper.diveFrame === "left") img = IMG.keeperLeft;
    //     if (keeper.diveFrame === "right") img = IMG.keeperRight;

    //     ctx.save();
    //     ctx.imageSmoothingEnabled = false;

    //     if (img.complete && img.naturalWidth) {

    //         ctx.drawImage(
    //             img,
    //             keeper.x - drawW / 2,
    //             sy - drawH / 2,
    //             drawW,
    //             drawH
    //         );

    //     } else {

    //         drawPixelHuman(
    //             keeper.x,
    //             sy + 35,
    //             "#ef476f",
    //             "#f5c49b"
    //         );

    //     }
    //     ctx.restore();
    // }

    function drawBall() {
        for (let i = 0; i < ball.trail.length; i++) {
            const p = ball.trail[i];
            const s = worldToScreen(p.x, p.y);
            const a = (i + 1) / ball.trail.length;

            ctx.globalAlpha = a * 0.35;
            ctx.fillStyle = ball.ghost ? "#ffae00" : "#ffffff";
            ctx.fillRect(Math.floor(s.x - 4 * a), Math.floor(s.y - 4 * a), Math.floor(8 * a), Math.floor(8 * a));
        }

        ctx.globalAlpha = 1;

        const s = worldToScreen(ball.x, ball.y);
        ctx.save();
        ctx.imageSmoothingEnabled = false;

        if (IMG.ball.complete && IMG.ball.naturalWidth) {
            ctx.drawImage(IMG.ball, Math.floor(s.x - 8), Math.floor(s.y - 8), 16, 16);
        } else {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(Math.floor(s.x - 7), Math.floor(s.y - 7), 14, 14);

            ctx.fillStyle = "#111";
            ctx.fillRect(Math.floor(s.x - 2), Math.floor(s.y - 7), 4, 14);
            ctx.fillRect(Math.floor(s.x - 7), Math.floor(s.y - 2), 14, 4);
        }

        ctx.restore();
    }

    function drawDrag() {
        if (!drag || kickQueued) return;

        const b = worldToScreen(ball.x, ball.y);
        const dx = drag.x - b.x;
        const dy = drag.y - b.y;
        const len = clamp(Math.hypot(dx, dy), 0, 190);
        const raw = len / 190;
        const power = hardPowerCurve(raw);

        ctx.save();

        ctx.strokeStyle = "rgba(255,255,255,.8)";
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(drag.x, drag.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const barW = 150;
        const barH = 10;
        const bx = b.x - barW / 2;
        const by = b.y - 42;

        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.fillRect(bx, by, barW, barH);

        ctx.fillStyle = power >= 0.95 ? "#ffd166" : "#ffffff";
        ctx.fillRect(bx, by, barW * power, barH);

        ctx.strokeStyle = "#ffffff";
        ctx.strokeRect(bx, by, barW, barH);

        ctx.restore();
    }

    function spawn(x, y, color, n = 18, power = 1) {
        for (let i = 0; i < n; i++) {
            particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 230 * power,
                vy: (Math.random() - 0.5) * 230 * power,
                life: 0.55 + Math.random() * 0.45,
                color,
                r: 2 + Math.random() * 3
            });
        }

        rings.push({ x, y, r: 10, life: 0.55, color });
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
                r: 2 + Math.random() * 3,
                life: 0.15 + Math.random() * 0.2,
                color: "#ff6a00"
            });
        }
    }

    function drawEffects(dt) {
        ctx.save();

        for (const p of particles) {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.97;
            p.vy *= 0.94;

            const s = worldToScreen(p.x, p.y);
            const alpha = clamp(p.life, 0, 1);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.floor(s.x), Math.floor(s.y), Math.floor(p.r * 2), Math.floor(p.r * 2));
        }

        particles = particles.filter(p => p.life > 0);

        for (const r of rings) {
            r.life -= dt;
            r.r += 220 * dt;

            const s = worldToScreen(r.x, r.y);
            const alpha = clamp(r.life, 0, 1);

            ctx.globalAlpha = alpha * 0.55;
            ctx.strokeStyle = r.color;
            ctx.lineWidth = 3;
            ctx.strokeRect(s.x - r.r / 2, s.y - r.r / 2, r.r, r.r);
        }

        rings = rings.filter(r => r.life > 0);

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function render(dt) {
        ctx.save();

        if (shake > 0) {
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }

        ctx.translate(W / 2, H / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-W / 2, -H / 2);

        drawField();
        drawGoal(opponentGoal, false);
        drawGoal(hiddenOwnGoal, true);
        drawKeeper();
        drawPlayer();
        drawEffects(dt);
        drawBall();
        drawDrag();

        ctx.restore();
    }

    function loop(now) {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;

        update(dt);
        render(dt);

        requestAnimationFrame(loop);
    }

    function pointerPos(e) {
        const r = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;

        return {
            x: t.clientX - r.left,
            y: t.clientY - r.top
        };
    }

    function down(e) {
        e.preventDefault();

        if (!running || ball.moving || kickQueued) return;

        const p = pointerPos(e);
        const b = worldToScreen(ball.x, ball.y);

        if (Math.hypot(p.x - b.x, p.y - b.y) < 80) {
            drag = p;
        }
    }

    function move(e) {
        if (!drag) return;

        e.preventDefault();
        drag = pointerPos(e);
    }

    function up(e) {
        if (!drag) return;

        e.preventDefault();

        const p = drag;
        drag = null;

        queueShot(p.x, p.y);
    }

    playBtn.onclick = restartMatch;

    canvas.addEventListener("touchstart", down, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", up, { passive: false });

    canvas.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);

    window.addEventListener("resize", resize);
    document.addEventListener("gesturestart", e => e.preventDefault());

    resize();
    requestAnimationFrame(loop);
})();