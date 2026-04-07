"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * GALACTIC SIEGE — mini gioco arcade da mostrare durante il caricamento
 * dell'analisi. Logica di gioco portata 1:1 dal prototipo `index.html`.
 * Si avvia automaticamente al mount, si ferma e libera risorse all'unmount.
 */
export function GalacticSiegeGame() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const starfieldRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  const [hi, setHi] = useState(0);
  const [overlay, setOverlay] = useState<"intro" | "gameover" | "win" | null>("intro");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs per stato di gioco mutabile (evita re-render ad ogni frame)
  const stateRef = useRef({
    running: false,
    paused: false,
    score: 0,
    hi: 0,
    lives: 3,
    wave: 1,
  });

  useEffect(() => {
    const sf = starfieldRef.current;
    const canvas = gameRef.current;
    if (!sf || !canvas) return;

    // ─── STARFIELD ─────────────────────────────────────────────────────────
    const sfCtx = sf.getContext("2d")!;
    const resizeStarfield = () => {
      const parent = sf.parentElement!;
      sf.width = parent.clientWidth;
      sf.height = parent.clientHeight;
    };
    resizeStarfield();
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * sf.width,
      y: Math.random() * sf.height,
      r: Math.random() * 1.5,
      s: 0.1 + Math.random() * 0.4,
      b: Math.random(),
    }));
    let starAnimId = 0;
    const animateStars = () => {
      sfCtx.clearRect(0, 0, sf.width, sf.height);
      stars.forEach((s) => {
        s.y += s.s;
        if (s.y > sf.height) {
          s.y = 0;
          s.x = Math.random() * sf.width;
        }
        const alpha = 0.3 + 0.7 * Math.abs(Math.sin((s.b += 0.01)));
        sfCtx.fillStyle = `rgba(180,220,255,${alpha})`;
        sfCtx.beginPath();
        sfCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        sfCtx.fill();
      });
      starAnimId = requestAnimationFrame(animateStars);
    };
    animateStars();
    window.addEventListener("resize", resizeStarfield);

    // ─── GAME ──────────────────────────────────────────────────────────────
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;

    const COLORS = {
      player: "#00ff88",
      bullet: "#ffffff",
      enemy1: "#00aaff",
      enemy2: "#00ff88",
      enemy3: "#aaffcc",
      ufo: "#ff3366",
      shield: "#00ff44",
      explosion: ["#00ff88", "#aaffcc", "#ffffff", "#00ddff"],
    };

    let player: any = {};
    let bullets: any[] = [];
    let enemyBullets: any[] = [];
    let enemies: any[] = [];
    let explosions: any[] = [];
    let shields: any[] = [];
    let ufo: any = null;
    let ufoTimer = 0;
    const keys: Record<string, boolean> = {};
    let shootCooldown = 0;
    let enemyDir = 1;
    let enemySpeed = 0.5;
    let enemyShootTimer = 0;
    let enemyMoveDelay = 0;
    let animId = 0;

    const s = stateRef.current;

    const syncUI = () => {
      setScore(s.score);
      setWave(s.wave);
      setLives(s.lives);
      setHi(s.hi);
    };

    const initPlayer = () => {
      player = { x: W / 2, y: H - 40, w: 36, h: 20, speed: 4 };
    };
    const initShields = () => {
      shields = [];
      const positions = [100, 220, 380, 500];
      positions.forEach((px) => {
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 6; col++) {
            shields.push({ x: px + col * 8, y: H - 120 + row * 8, w: 8, h: 8, hp: 3 });
          }
        }
      });
    };
    const initEnemies = () => {
      enemies = [];
      const rows = Math.min(4 + Math.floor(s.wave / 2), 6);
      const cols = 11;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const type = r === 0 ? 3 : r <= 2 ? 2 : 1;
          enemies.push({
            x: 60 + c * 46,
            y: 50 + r * 40,
            w: 28,
            h: 20,
            type,
            frame: 0,
            alive: true,
            points: type === 3 ? 30 : type === 2 ? 20 : 10,
          });
        }
      }
      enemyDir = 1;
      enemySpeed = 0.5 + s.wave * 0.1;
      enemyMoveDelay = 60;
    };

    const startGame = () => {
      setOverlay(null);
      s.score = 0;
      s.lives = 3;
      s.wave = 1;
      syncUI();
      s.running = true;
      s.paused = false;
      initPlayer();
      initShields();
      initEnemies();
      bullets = [];
      enemyBullets = [];
      explosions = [];
      ufo = null;
      ufoTimer = 200 + Math.random() * 400;
      enemyShootTimer = 60;
      if (animId) cancelAnimationFrame(animId);
      gameLoop();
    };

    const nextWave = () => {
      s.wave++;
      syncUI();
      initShields();
      initEnemies();
      bullets = [];
      enemyBullets = [];
      ufo = null;
      ufoTimer = 200 + Math.random() * 400;
      enemyMoveDelay = 60;
    };

    const gameOver = (won: boolean) => {
      s.running = false;
      if (s.score > s.hi) s.hi = s.score;
      syncUI();
      setOverlay(won ? "win" : "gameover");
    };

    // ─── DRAW ────────────────────────────────────────────────────────────
    const drawPlayer = () => {
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = COLORS.player;
      ctx.strokeStyle = COLORS.player;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 14);
      ctx.lineTo(player.x + 16, player.y + 6);
      ctx.lineTo(player.x + 8, player.y + 6);
      ctx.lineTo(player.x + 8, player.y + 10);
      ctx.lineTo(player.x - 8, player.y + 10);
      ctx.lineTo(player.x - 8, player.y + 6);
      ctx.lineTo(player.x - 16, player.y + 6);
      ctx.closePath();
      ctx.fillStyle = "#001f1f";
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(player.x, player.y - 4, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#0ff8";
      ctx.fill();
      if (Math.random() > 0.3) {
        ctx.strokeStyle = "#f80";
        ctx.shadowColor = "#f80";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(player.x - 5, player.y + 10);
        ctx.lineTo(player.x, player.y + 14 + Math.random() * 6);
        ctx.lineTo(player.x + 5, player.y + 10);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawEnemy = (e: any) => {
      if (!e.alive) return;
      ctx.save();
      ctx.shadowBlur = 10;
      let col;
      if (e.type === 3) col = COLORS.enemy3;
      else if (e.type === 2) col = COLORS.enemy2;
      else col = COLORS.enemy1;
      ctx.shadowColor = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      const cx = e.x,
        cy = e.y,
        f = e.frame;
      if (e.type === 1) {
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 4 + f * 2);
        ctx.lineTo(cx - 6, cy - 8);
        ctx.lineTo(cx + 6, cy - 8);
        ctx.lineTo(cx + 10, cy - 4 + f * 2);
        ctx.lineTo(cx + 14, cy - 8 + f * 2);
        ctx.lineTo(cx + 10, cy + 2);
        ctx.lineTo(cx + 6, cy + 8);
        ctx.lineTo(cx - 6, cy + 8);
        ctx.lineTo(cx - 10, cy + 2);
        ctx.lineTo(cx - 14, cy - 8 + f * 2);
        ctx.closePath();
        ctx.fillStyle = "#001a0e";
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillRect(cx - 3, cy - 4, 3, 3);
        ctx.fillRect(cx + 1, cy - 4, 3, 3);
      } else if (e.type === 2) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 9);
        ctx.lineTo(cx + 8, cy - 4);
        ctx.lineTo(cx + 8, cy + 4);
        ctx.lineTo(cx + 4, cy + 8);
        ctx.lineTo(cx - 4, cy + 8);
        ctx.lineTo(cx - 8, cy + 4);
        ctx.lineTo(cx - 8, cy - 4);
        ctx.closePath();
        ctx.fillStyle = "#001408";
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy + 8);
        ctx.lineTo(cx - 12 + f * 2, cy + 14);
        ctx.moveTo(cx, cy + 8);
        ctx.lineTo(cx, cy + 14);
        ctx.moveTo(cx + 8, cy + 8);
        ctx.lineTo(cx + 12 - f * 2, cy + 14);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillRect(cx - 5, cy - 2, 4, 4);
        ctx.fillRect(cx + 1, cy - 2, 4, 4);
      } else {
        ctx.beginPath();
        ctx.ellipse(cx, cy + 2, 12, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#0a1400";
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy - 2, 7, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#0f1a00";
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillRect(cx - 8, cy, 4, 3);
        ctx.fillRect(cx - 2, cy, 4, 3);
        ctx.fillRect(cx + 4, cy, 4, 3);
      }
      ctx.restore();
    };

    const drawUFO = () => {
      if (!ufo) return;
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = COLORS.ufo;
      ctx.strokeStyle = COLORS.ufo;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ufo.x, ufo.y, 22, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#1a0008";
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(ufo.x, ufo.y - 6, 10, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#250010";
      ctx.fill();
      ctx.stroke();
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(ufo.x + i * 9, ufo.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${Date.now() / 10 + i * 60}, 100%, 70%)`;
        ctx.fill();
      }
      ctx.restore();
    };

    const drawBullets = () => {
      bullets.forEach((b) => {
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = COLORS.bullet;
        ctx.fillStyle = COLORS.bullet;
        ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12);
        ctx.restore();
      });
      enemyBullets.forEach((b) => {
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#f00";
        ctx.fillStyle = "#f44";
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 6);
        ctx.lineTo(b.x + 3, b.y);
        ctx.lineTo(b.x - 3, b.y + 3);
        ctx.lineTo(b.x, b.y + 8);
        ctx.strokeStyle = "#f44";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      });
    };

    const drawShields = () => {
      shields.forEach((sh) => {
        if (sh.hp <= 0) return;
        const alpha = sh.hp / 3;
        ctx.fillStyle = `rgba(0,${Math.floor(170 * alpha)},${Math.floor(100 * alpha)},${alpha})`;
        ctx.shadowBlur = 4;
        ctx.shadowColor = COLORS.shield;
        ctx.fillRect(sh.x, sh.y, sh.w, sh.h);
      });
    };

    const drawExplosions = () => {
      explosions.forEach((e) => {
        e.particles.forEach((p: any) => {
          ctx.save();
          ctx.globalAlpha = p.life / p.maxLife;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      });
    };

    const drawGround = () => {
      ctx.fillStyle = "#00ff8822";
      ctx.fillRect(0, H - 18, W, 2);
      ctx.fillStyle = "#00ff8810";
      ctx.fillRect(0, H - 16, W, 16);
    };

    const drawHUD = () => {
      for (let y = 0; y < H; y += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.03)";
        ctx.fillRect(0, y, W, 2);
      }
    };

    const spawnExplosion = (x: number, y: number, big: boolean) => {
      const n = big ? 20 : 10;
      const particles = Array.from({ length: n }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * (big ? 4 : 2);
        const life = 20 + Math.random() * 20;
        return {
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 1 + Math.random() * 3,
          color: COLORS.explosion[Math.floor(Math.random() * 4)],
          life,
          maxLife: life,
        };
      });
      explosions.push({ particles });
    };

    const update = () => {
      if (!s.running || s.paused) return;

      if (keys["ArrowLeft"] || keys["a"]) player.x = Math.max(player.w / 2, player.x - player.speed);
      if (keys["ArrowRight"] || keys["d"]) player.x = Math.min(W - player.w / 2, player.x + player.speed);

      if ((keys[" "] || keys["Space"]) && shootCooldown <= 0) {
        bullets.push({ x: player.x, y: player.y - 14, speed: 8 });
        shootCooldown = 18;
      }
      if (shootCooldown > 0) shootCooldown--;

      bullets = bullets.filter((b) => {
        b.y -= b.speed;
        return b.y > 0;
      });

      enemyBullets = enemyBullets.filter((b) => {
        b.y += b.speed;
        if (b.y > player.y - 14 && b.y < player.y + 10 && Math.abs(b.x - player.x) < 16) {
          spawnExplosion(player.x, player.y, true);
          s.lives--;
          syncUI();
          enemyBullets = [];
          bullets = [];
          if (s.lives <= 0) {
            setTimeout(() => gameOver(false), 400);
          }
          return false;
        }
        shields.forEach((sh) => {
          if (sh.hp > 0 && b.x > sh.x && b.x < sh.x + sh.w && b.y > sh.y && b.y < sh.y + sh.h) {
            sh.hp--;
            spawnExplosion(b.x, b.y, false);
            b.y = -99;
          }
        });
        return b.y < H;
      });

      const aliveEnemies = enemies.filter((e) => e.alive);
      if (aliveEnemies.length === 0) {
        nextWave();
        return;
      }

      if (enemyMoveDelay > 0) enemyMoveDelay--;
      const speedMultiplier = 1 + (1 - aliveEnemies.length / (enemies.length || 1)) * 2;
      enemies.forEach((e) => {
        if (!e.alive) return;
        e.x += enemyDir * enemySpeed * speedMultiplier;
      });

      if (enemyMoveDelay === 0) {
        const maxX = Math.max(...aliveEnemies.map((e) => e.x));
        const minX = Math.min(...aliveEnemies.map((e) => e.x));
        if (maxX > W - 30 || minX < 30) {
          enemyDir *= -1;
          enemies.forEach((e) => {
            if (e.alive) e.y += 20;
          });
          const lowest = Math.max(...aliveEnemies.map((e) => e.y));
          if (lowest > H - 80) setTimeout(() => gameOver(false), 200);
        }
      }

      if (Math.floor(Date.now() / 500) % 2 === 0) {
        enemies.forEach((e) => (e.frame = 1));
      } else {
        enemies.forEach((e) => (e.frame = 0));
      }

      enemyShootTimer--;
      if (enemyShootTimer <= 0) {
        const shooters = aliveEnemies.filter((e) => {
          const col = aliveEnemies.filter((x) => Math.abs(x.x - e.x) < 5);
          return col.every((x) => x.y <= e.y);
        });
        if (shooters.length > 0) {
          const shooter = shooters[Math.floor(Math.random() * shooters.length)];
          enemyBullets.push({ x: shooter.x, y: shooter.y + 10, speed: 3 + s.wave * 0.3 });
        }
        enemyShootTimer = Math.max(20, 60 - s.wave * 5);
      }

      bullets.forEach((b) => {
        enemies.forEach((e) => {
          if (!e.alive) return;
          if (b.x > e.x - 14 && b.x < e.x + 14 && b.y > e.y - 10 && b.y < e.y + 10) {
            e.alive = false;
            s.score += e.points;
            syncUI();
            spawnExplosion(e.x, e.y, false);
            b.y = -99;
          }
        });
        if (ufo && b.x > ufo.x - 22 && b.x < ufo.x + 22 && b.y > ufo.y - 10 && b.y < ufo.y + 10) {
          const bonus = [50, 100, 150, 200, 300][Math.floor(Math.random() * 5)];
          s.score += bonus;
          syncUI();
          spawnExplosion(ufo.x, ufo.y, true);
          ufo = null;
          ufoTimer = 300 + Math.random() * 500;
          b.y = -99;
        }
        shields.forEach((sh) => {
          if (sh.hp > 0 && b.x > sh.x && b.x < sh.x + sh.w && b.y > sh.y && b.y < sh.y + sh.h) {
            sh.hp--;
            b.y = -99;
          }
        });
      });

      ufoTimer--;
      if (ufoTimer <= 0 && !ufo) {
        ufo = { x: -30, y: 30, speed: 2 + s.wave * 0.2, dir: 1 };
        if (Math.random() > 0.5) {
          ufo.x = W + 30;
          ufo.dir = -1;
        }
      }
      if (ufo) {
        ufo.x += ufo.speed * ufo.dir;
        if (ufo.x > W + 40 || ufo.x < -40) {
          ufo = null;
          ufoTimer = 400 + Math.random() * 600;
        }
      }

      explosions.forEach((e) => {
        e.particles.forEach((p: any) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.05;
          p.life--;
        });
        e.particles = e.particles.filter((p: any) => p.life > 0);
      });
      explosions = explosions.filter((e) => e.particles.length > 0);
    };

    const gameLoop = () => {
      ctx.fillStyle = "#080808";
      ctx.fillRect(0, 0, W, H);
      drawGround();
      drawShields();
      if (s.running) drawPlayer();
      enemies.forEach(drawEnemy);
      drawUFO();
      drawBullets();
      drawExplosions();
      drawHUD();
      update();
      if (s.running) animId = requestAnimationFrame(gameLoop);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
      if (e.key === "p" || e.key === "P") s.paused = !s.paused;
      if (e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Espone startGame al click del bottone overlay
    (canvas as any).__startGame = startGame;
    // Prima frame statico (overlay visibile)
    ctx.fillStyle = "#080808";
    ctx.fillRect(0, 0, W, H);
    drawGround();

    return () => {
      cancelAnimationFrame(animId);
      cancelAnimationFrame(starAnimId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resizeStarfield);
      s.running = false;
    };
  }, []);

  const handleStart = () => {
    const canvas = gameRef.current as any;
    if (canvas?.__startGame) canvas.__startGame();
  };

  const toggleFullscreen = async () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative overflow-hidden rounded-md border border-[#00ff8833] bg-[#080808]"
      style={{ fontFamily: "'Share Tech Mono', ui-monospace, monospace" }}
    >
      <canvas ref={starfieldRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center px-4 py-4 sm:py-6">
        {/* HUD */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-1 mb-3 text-[12px] tracking-[3px] text-[#00ff88]" style={{ textShadow: "0 0 10px #00ff8888" }}>
          <div>SCORE <span className="text-white">{score}</span></div>
          <div>WAVE <span className="text-white">{wave}</span></div>
          <div>LIVES <span className="text-white">{"♦".repeat(lives)}</span></div>
          <div>HI <span className="text-white">{hi}</span></div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="ml-2 inline-flex items-center gap-1 px-2 py-1 border border-[#00ff8855] text-[#00ff88] hover:bg-[#00ff8811] transition-colors"
            title={isFullscreen ? "Esci da fullscreen" : "Schermo intero"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="text-[10px] tracking-widest">{isFullscreen ? "EXIT" : "FULL"}</span>
          </button>
        </div>

        <div className="relative">
          <canvas
            ref={gameRef}
            width={600}
            height={520}
            className="block max-w-full h-auto"
            style={{
              border: "1px solid #00ff8833",
              boxShadow: "0 0 40px #00ff8820, inset 0 0 40px #0001",
            }}
          />

          {overlay && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
              style={{ background: "rgba(8,8,8,0.88)" }}
            >
              <h1
                className="font-black tracking-[8px] text-[#00ff88] mb-2"
                style={{
                  fontSize: "clamp(24px, 5vw, 48px)",
                  textShadow: "0 0 20px #00ff88, 0 0 60px #00ff8866",
                }}
              >
                {overlay === "intro" ? "GALACTIC SIEGE" : overlay === "win" ? "VITTORIA!" : "GAME OVER"}
              </h1>
              <div className="text-[12px] tracking-[4px] text-[#aaffcc] mb-6" style={{ textShadow: "0 0 10px #00ff8844" }}>
                {overlay === "intro"
                  ? "// ANALISI IN CORSO — DIFENDI LA TERRA //"
                  : overlay === "win"
                  ? "// TERRA SALVATA //"
                  : "// TERRA DISTRUTTA //"}
              </div>
              {overlay !== "intro" && (
                <div className="text-[#00ff88] text-[16px] tracking-[3px] mb-5" style={{ textShadow: "0 0 15px #00ff8888" }}>
                  PUNTEGGIO: {score}
                </div>
              )}
              <div className="text-[11px] tracking-[2px] text-[#666] leading-7 mb-5">
                <span className="text-[#00ff88] font-bold">← →</span> Sposta &nbsp;|&nbsp;{" "}
                <span className="text-[#00ff88] font-bold">SPAZIO</span> Spara &nbsp;|&nbsp;{" "}
                <span className="text-[#00ff88] font-bold">P</span> Pausa
              </div>
              <button
                type="button"
                onClick={handleStart}
                className="font-bold tracking-[5px] text-[14px] text-[#080808] bg-[#00ff88] px-10 py-3 hover:bg-white transition-all"
                style={{
                  clipPath: "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)",
                  boxShadow: "0 0 30px #00ff8866",
                }}
              >
                {overlay === "intro" ? "▶ INIZIA" : "▶ RIGIOCA"}
              </button>
            </div>
          )}
        </div>

        <p className="mt-3 text-[10px] tracking-[2px] text-[#444]">
          ← → MOVE &nbsp;|&nbsp; SPACE FIRE &nbsp;|&nbsp; P PAUSE
        </p>
      </div>
    </div>
  );
}
