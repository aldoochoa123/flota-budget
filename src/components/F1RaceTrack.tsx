import { useEffect, useRef, useState } from "react";

export function F1RaceTrack() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [, setIsPlaying] = useState(false);
  const [, setGameOver] = useState(false);
  const [, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem("f1_dino_highscore") || "0", 10);
    } catch {
      return 0;
    }
  });

  // Referencias para el loop de juego sin lag de re-render
  const gameStateRef = useRef({
    isPlaying: false,
    gameOver: false,
    car: {
      x: 60,
      y: 0,
      width: 44,
      height: 18,
      vy: 0,
      isGrounded: true,
      jumpForce: -10.5,
      gravity: 0.58,
    },
    groundY: 135,
    obstacles: [] as Array<{ x: number; y: number; width: number; height: number; type: "cone" | "tires" }>,
    groundOffset: 0,
    speed: 5.5,
    score: 0,
    nextObstacleTimer: 80,
    clouds: [
      { x: 150, y: 30, speed: 0.6, width: 36 },
      { x: 380, y: 45, speed: 0.4, width: 48 },
      { x: 620, y: 25, speed: 0.5, width: 40 },
    ],
  });

  const jump = () => {
    const s = gameStateRef.current;
    if (s.gameOver) {
      // Reiniciar juego
      s.gameOver = false;
      s.isPlaying = true;
      s.score = 0;
      s.speed = 5.5;
      s.obstacles = [];
      s.car.y = 0;
      s.car.vy = 0;
      s.car.isGrounded = true;
      setGameOver(false);
      setIsPlaying(true);
      setScore(0);
      return;
    }
    if (!s.isPlaying) {
      s.isPlaying = true;
      setIsPlaying(true);
    }
    if (s.car.isGrounded) {
      s.car.vy = s.car.jumpForce;
      s.car.isGrounded = false;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = 170;
      gameStateRef.current.groundY = 135;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Loop de juego estilo Chrome Dino (Pixel Art minimalista)
    const updateAndRender = () => {
      const s = gameStateRef.current;
      const width = canvas.width;
      const height = canvas.height;
      const groundY = s.groundY;

      // 1. Limpiar fondo (Estilo minimalista oscuro)
      ctx.fillStyle = "#0c1017";
      ctx.fillRect(0, 0, width, height);

      // 2. Nubes de fondo (Pixel clouds)
      ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
      s.clouds.forEach((cloud) => {
        if (s.isPlaying && !s.gameOver) {
          cloud.x -= cloud.speed;
          if (cloud.x < -cloud.width) cloud.x = width + Math.random() * 80;
        }
        ctx.fillRect(cloud.x, cloud.y, cloud.width, 8);
        ctx.fillRect(cloud.x + 8, cloud.y - 6, cloud.width - 16, 6);
      });

      // 3. Suelo / Línea de pista con textura de píxeles
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();

      // Pequeños guiones en el suelo que avanzan
      if (s.isPlaying && !s.gameOver) {
        s.groundOffset = (s.groundOffset + s.speed) % 40;
      }
      ctx.fillStyle = "rgba(148, 163, 184, 0.3)";
      for (let x = -s.groundOffset; x < width; x += 30) {
        ctx.fillRect(x, groundY + 4, 12, 2);
        ctx.fillRect(x + 16, groundY + 10, 6, 2);
      }

      // 4. Física del auto F1
      if (s.isPlaying && !s.gameOver) {
        s.car.vy += s.car.gravity;
        s.car.y += s.car.vy;

        if (s.car.y >= 0) {
          s.car.y = 0;
          s.car.vy = 0;
          s.car.isGrounded = true;
        }

        // Puntuación
        s.score += 0.15;
        const currentScoreInt = Math.floor(s.score);
        setScore(currentScoreInt);

        // Aumentar velocidad progresivamente
        if (s.score > 0 && Math.floor(s.score) % 100 === 0) {
          s.speed = Math.min(13, 5.5 + s.score * 0.006);
        }

        // Generar obstáculos (Conos o pilas de neumáticos)
        s.nextObstacleTimer--;
        if (s.nextObstacleTimer <= 0) {
          const type = Math.random() > 0.45 ? "cone" : "tires";
          s.obstacles.push({
            x: width + 20,
            y: type === "cone" ? groundY - 20 : groundY - 24,
            width: type === "cone" ? 18 : 24,
            height: type === "cone" ? 20 : 24,
            type,
          });
          s.nextObstacleTimer = Math.floor(Math.random() * 60 + 55 - Math.min(25, s.speed * 1.5));
        }

        // Mover y verificar colisiones de obstáculos
        for (let i = s.obstacles.length - 1; i >= 0; i--) {
          const obs = s.obstacles[i];
          obs.x -= s.speed;

          // Hitbox del auto F1
          const carBox = {
            x: s.car.x + 4,
            y: groundY - s.car.height + s.car.y + 2,
            w: s.car.width - 8,
            h: s.car.height - 4,
          };

          // Colisión AABB
          if (
            carBox.x < obs.x + obs.width &&
            carBox.x + carBox.w > obs.x &&
            carBox.y < obs.y + obs.height &&
            carBox.y + carBox.h > obs.y
          ) {
            // GAME OVER
            s.gameOver = true;
            setGameOver(true);
            const finalScore = Math.floor(s.score);
            if (finalScore > highScore) {
              setHighScore(finalScore);
              try {
                localStorage.setItem("f1_dino_highscore", String(finalScore));
              } catch {}
            }
          }

          // Eliminar obstáculos fuera de pantalla
          if (obs.x < -40) {
            s.obstacles.splice(i, 1);
          }
        }
      }

      // 5. Dibujar Obstáculos (Pixel Art Conos & Neumáticos)
      s.obstacles.forEach((obs) => {
        if (obs.type === "cone") {
          // Cono de tráfico naranja retro
          ctx.fillStyle = "#ea580c";
          ctx.beginPath();
          ctx.moveTo(obs.x + obs.width / 2, obs.y);
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
          ctx.lineTo(obs.x, obs.y + obs.height);
          ctx.closePath();
          ctx.fill();
          // Franja blanca reflectante
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(obs.x + 4, obs.y + 8, obs.width - 8, 4);
        } else {
          // Pila de 2 neumáticos de competición
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(obs.x, obs.y + 12, obs.width, 12);
          ctx.fillRect(obs.x + 2, obs.y, obs.width - 4, 12);
          ctx.strokeStyle = "#ea580c";
          ctx.lineWidth = 2;
          ctx.strokeRect(obs.x + 4, obs.y + 3, obs.width - 8, 6);
          ctx.strokeRect(obs.x + 2, obs.y + 15, obs.width - 4, 6);
        }
      });

      // 6. DIBUJAR AUTO F1 (Estilo Pixel Art Retro Minimalista)
      const carActualY = groundY - s.car.height + s.car.y;
      const carX = s.car.x;

      ctx.save();
      ctx.translate(carX, carActualY);

      // Si está saltando, inclinar ligeramente la trompa
      if (!s.car.isGrounded) {
        ctx.rotate(-0.08);
      }

      // Chasis de F1 (Naranja corporativo Budget)
      ctx.fillStyle = "#ea580c";
      // Morro / Nariz
      ctx.fillRect(18, 8, 22, 5);
      ctx.fillRect(36, 10, 8, 3);
      // Cabina / Cockpit
      ctx.fillRect(6, 4, 16, 9);
      // Alerón trasero
      ctx.fillRect(-6, 0, 6, 12);
      ctx.fillRect(-8, -2, 10, 4);
      // Alerón delantero
      ctx.fillRect(38, 11, 6, 3);

      // Piloto con casco
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(12, 1, 6, 5);

      // Neumáticos negros retro
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 10, 8, 8);
      ctx.fillRect(28, 10, 8, 8);
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(2, 12, 4, 4);
      ctx.fillRect(30, 12, 4, 4);

      // Pequeñas chispas si está en el suelo y corriendo
      if (s.isPlaying && !s.gameOver && s.car.isGrounded && Math.random() > 0.4) {
        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(-8 - Math.random() * 8, 12 + Math.random() * 4, 3, 2);
      }

      ctx.restore();

      // 7. Textos y Marcador
      ctx.font = "bold 13px 'Courier New', Courier, monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "right";
      const scoreStr = String(Math.floor(s.score)).padStart(5, "0");
      const hiStr = String(highScore).padStart(5, "0");
      ctx.fillText(`HI ${hiStr}  ${scoreStr}`, width - 20, 24);

      // Mensaje de inicio o Game Over
      if (!s.isPlaying && !s.gameOver) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ea580c";
        ctx.font = "bold 13px 'Courier New', Courier, monospace";
        ctx.fillText("🏎️ PULSA ESPACIO O TOCA AQUÍ PARA EMPEZAR A CORRER", width / 2, groundY - 35);
      } else if (s.gameOver) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 15px 'Courier New', Courier, monospace";
        ctx.fillText("💥 G A M E   O V E R", width / 2, groundY - 45);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px 'Courier New', Courier, monospace";
        ctx.fillText("TOCA O PULSA ESPACIO PARA REINICIAR", width / 2, groundY - 24);
      }

      animationFrameId = requestAnimationFrame(updateAndRender);
    };

    updateAndRender();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [highScore]);

  return (
    <div
      onClick={jump}
      className="mt-8 w-full overflow-hidden rounded-2xl bg-[#0c1017] cursor-pointer select-none"
      title="Haz clic o pulsa la barra espaciadora para saltar obstáculos"
    >
      <canvas ref={canvasRef} className="block w-full h-[160px]" />
    </div>
  );
}
