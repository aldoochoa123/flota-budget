import { useEffect, useRef, useState } from "react";

export function F1RaceTrack() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [speed, setSpeed] = useState<number>(315);
  const [isBoosting, setIsBoosting] = useState(false);
  const [gear, setGear] = useState(7);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let roadOffset = 0;
    let carYOffset = 0;
    let carTilt = 0;
    let particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }> = [];

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || 900;
      canvas.height = 220;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const roadTop = 30;
      const roadBottom = height - 30;
      const roadHeight = roadBottom - roadTop;
      const currentSpeed = isBoosting ? 348 : speed;

      // Velocidad de scroll de la pista
      roadOffset = (roadOffset + currentSpeed * 0.08) % 100;

      // Limpiar canvas con fondo de circuito
      ctx.fillStyle = "#0b0f17";
      ctx.fillRect(0, 0, width, height);

      // Césped / Grava exterior
      const grassGrad = ctx.createLinearGradient(0, 0, 0, roadTop);
      grassGrad.addColorStop(0, "#062b16");
      grassGrad.addColorStop(1, "#0d3d22");
      ctx.fillStyle = grassGrad;
      ctx.fillRect(0, 0, width, roadTop);

      const grassGradBtm = ctx.createLinearGradient(0, roadBottom, 0, height);
      grassGradBtm.addColorStop(0, "#0d3d22");
      grassGradBtm.addColorStop(1, "#062b16");
      ctx.fillStyle = grassGradBtm;
      ctx.fillRect(0, roadBottom, width, height - roadBottom);

      // Pianos / Kerbs (bordillos rojo y blanco de F1)
      const kerbWidth = 40;
      const numKerbs = Math.ceil(width / kerbWidth) + 2;

      // Piano Superior
      for (let i = -1; i < numKerbs; i++) {
        const x = i * kerbWidth - (roadOffset * 1.5) % kerbWidth;
        ctx.fillStyle = Math.floor((i + Math.floor((roadOffset * 1.5) / kerbWidth)) % 2) === 0 ? "#dc2626" : "#f8fafc";
        ctx.fillRect(x, roadTop - 8, kerbWidth, 8);
      }

      // Piano Inferior
      for (let i = -1; i < numKerbs; i++) {
        const x = i * kerbWidth - (roadOffset * 1.5) % kerbWidth;
        ctx.fillStyle = Math.floor((i + Math.floor((roadOffset * 1.5) / kerbWidth)) % 2) === 0 ? "#dc2626" : "#f8fafc";
        ctx.fillRect(x, roadBottom, kerbWidth, 8);
      }

      // Asfalto
      const asphaltGrad = ctx.createLinearGradient(0, roadTop, 0, roadBottom);
      asphaltGrad.addColorStop(0, "#1e2430");
      asphaltGrad.addColorStop(0.5, "#141824");
      asphaltGrad.addColorStop(1, "#181d2a");
      ctx.fillStyle = asphaltGrad;
      ctx.fillRect(0, roadTop, width, roadHeight);

      // Líneas de rodadura de neumáticos (skid marks)
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(0, roadTop + 35, width, 18);
      ctx.fillRect(0, roadBottom - 53, width, 18);

      // Línea discontinua central
      ctx.strokeStyle = "rgba(248, 250, 252, 0.4)";
      ctx.lineWidth = 4;
      ctx.setLineDash([40, 35]);
      ctx.lineDashOffset = -roadOffset * 3;
      ctx.beginPath();
      ctx.moveTo(0, roadTop + roadHeight / 2);
      ctx.lineTo(width, roadTop + roadHeight / 2);
      ctx.stroke();
      ctx.setLineDash([]); // Reset

      // Líneas de velocidad (Speed lines aerodinámicas)
      ctx.strokeStyle = isBoosting ? "rgba(249, 115, 22, 0.3)" : "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1.5;
      for (let s = 0; s < 7; s++) {
        const sx = ((s * 170 - roadOffset * 7) % width + width) % width;
        const sy = roadTop + 20 + ((s * 43) % (roadHeight - 40));
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 50 + (isBoosting ? 60 : 0), sy);
        ctx.stroke();
      }

      // Movimiento y vibración del auto F1
      carYOffset = Math.sin(Date.now() * 0.015) * (isBoosting ? 3 : 1.5);
      carTilt = Math.cos(Date.now() * 0.01) * 0.02;

      const carX = width * 0.42;
      const carY = roadTop + roadHeight / 2 + carYOffset;

      // Partículas de escape / Chispas / Fuego
      if (Math.random() < (isBoosting ? 0.9 : 0.4)) {
        particles.push({
          x: carX - 65,
          y: carY + (Math.random() * 8 - 4),
          vx: -(Math.random() * 8 + (isBoosting ? 14 : 7)),
          vy: Math.random() * 3 - 1.5,
          life: 0,
          maxLife: Math.random() * 20 + (isBoosting ? 25 : 12),
          color: isBoosting
            ? ["#f97316", "#ef4444", "#fbbf24", "#38bdf8"][Math.floor(Math.random() * 4)]
            : ["#f59e0b", "#ea580c", "#fbbf24"][Math.floor(Math.random() * 3)],
          size: Math.random() * (isBoosting ? 4 : 2.5) + 1.5,
        });
      }

      // Dibujar partículas
      for (let p = particles.length - 1; p >= 0; p--) {
        const pt = particles[p];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life++;
        const alpha = 1 - pt.life / pt.maxLife;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        if (pt.life >= pt.maxLife) {
          particles.splice(p, 1);
        }
      }

      // Sombra del auto
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.beginPath();
      ctx.ellipse(carX, carY + 18, 75, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // DIBUJAR COCHE DE FÓRMULA 1 (Lateral estilizado de alta velocidad)
      ctx.save();
      ctx.translate(carX, carY);
      ctx.rotate(carTilt);

      // 1. NEUMÁTICOS (Pirelli P-Zero F1 Wheels)
      const wheelSpin = (Date.now() * 0.05) % (Math.PI * 2);
      const drawWheel = (wx: number, wy: number) => {
        // Goma negra
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.roundRect(wx - 14, wy - 11, 28, 22, 6);
        ctx.fill();
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Banda roja (Soft Tyre)
        ctx.strokeStyle = isBoosting ? "#f97316" : "#dc2626";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, wy, 7, 0, Math.PI * 2);
        ctx.stroke();

        // Rin central y tuerca
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(wx, wy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.arc(wx, wy, 2, 0, Math.PI * 2);
        ctx.fill();
      };

      // Ruedas traseras y delanteras
      drawWheel(-50, 11);
      drawWheel(50, 11);

      // 2. ALERÓN TRASERO (Rear Wing + DRS)
      ctx.fillStyle = "#ea580c"; // Budget Orange
      ctx.beginPath();
      ctx.moveTo(-68, -12);
      ctx.lineTo(-58, -12);
      ctx.lineTo(-54, 4);
      ctx.lineTo(-68, 4);
      ctx.closePath();
      ctx.fill();

      // Placas laterales del alerón
      ctx.fillStyle = "#18181b";
      ctx.fillRect(-70, -18, 14, 18);
      ctx.fillStyle = isBoosting ? "#22c55e" : "#ea580c";
      ctx.fillRect(-70, -16, 12, 3); // Flap DRS activo

      // 3. CHASIS PRINCIPAL & CARROCERÍA (Monocasco aerodinámico F1)
      const bodyGrad = ctx.createLinearGradient(-60, 0, 75, 0);
      bodyGrad.addColorStop(0, "#c2410c");
      bodyGrad.addColorStop(0.4, "#ea580c"); // Color Budget
      bodyGrad.addColorStop(0.7, "#fb923c");
      bodyGrad.addColorStop(1, "#f97316");

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      // Nariz puntiaguda y perfil bajo
      ctx.moveTo(-60, 4);
      ctx.lineTo(-45, -4);
      ctx.lineTo(-20, -6);
      ctx.lineTo(-5, -14); // Airbox / Toma de aire superior
      ctx.lineTo(8, -14);
      ctx.lineTo(15, -4);  // Cockpit
      ctx.lineTo(55, 3);   // Morro / Nariz delantera
      ctx.lineTo(72, 6);   // Punta extrema
      ctx.lineTo(65, 11);
      ctx.lineTo(-55, 11);
      ctx.closePath();
      ctx.fill();

      // Borde de fibra de carbono inferior (Sidepod & Bargeboard)
      ctx.fillStyle = "#18181b";
      ctx.beginPath();
      ctx.moveTo(-45, 7);
      ctx.lineTo(35, 7);
      ctx.lineTo(40, 11);
      ctx.lineTo(-50, 11);
      ctx.closePath();
      ctx.fill();

      // Línea decorativa y detalles de patrocinio
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("BUDGET", -12, 5);

      // Número de carrera #1
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(38, 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ea580c";
      ctx.font = "bold 7px sans-serif";
      ctx.fillText("1", 36, 7.5);

      // 4. HALO DE SEGURIDAD & PILOTO
      // Casco del piloto
      ctx.fillStyle = "#fbbf24"; // Casco dorado/amarillo
      ctx.beginPath();
      ctx.arc(0, -6, 5, 0, Math.PI * 2);
      ctx.fill();
      // Visera reflectante
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(1, -7.5, 4, 3);

      // Estructura Halo
      ctx.strokeStyle = "#27272a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(2, -9);
      ctx.lineTo(12, -4);
      ctx.stroke();

      // 5. ALERÓN DELANTERO (Front Wing)
      ctx.fillStyle = "#18181b";
      ctx.fillRect(60, 6, 18, 5);
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(62, 8, 16, 2.5);

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [speed, isBoosting]);

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card/90 to-background shadow-2xl ring-1 ring-white/5">
      {/* Barra de telemetría superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-black/40 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-3 w-3 items-center justify-center">
            <span className="h-2.5 w-2.5 animate-ping rounded-full bg-danger opacity-80" />
          </div>
          <span className="font-mono text-xs font-extrabold tracking-wider text-foreground">
            🏁 BUDGET F1 GP • PISTA EN VIVO
          </span>
        </div>

        {/* Telemetría */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1 border border-border/40 font-mono text-xs">
            <span className="text-muted-foreground">VELOCIDAD:</span>
            <span className={`font-black ${isBoosting ? "text-primary animate-pulse" : "text-ok"}`}>
              {isBoosting ? 348 : speed} KM/H
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1 border border-border/40 font-mono text-xs">
            <span className="text-muted-foreground">MARCHA:</span>
            <span className="font-black text-foreground">G{isBoosting ? 8 : gear}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1 border border-border/40 font-mono text-xs">
            <span className="text-muted-foreground">DRS:</span>
            <span className={`font-bold ${isBoosting ? "text-ok" : "text-muted-foreground"}`}>
              {isBoosting ? "ACTIVADO" : "DISPONIBLE"}
            </span>
          </div>

          {/* Botón de Aceleración / Nitro */}
          <button
            onMouseDown={() => setIsBoosting(true)}
            onMouseUp={() => setIsBoosting(false)}
            onTouchStart={() => setIsBoosting(true)}
            onTouchEnd={() => setIsBoosting(false)}
            className={`rounded-xl px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide transition-all select-none active:scale-95 ${
              isBoosting
                ? "bg-primary text-white shadow-lg shadow-primary/50 scale-105"
                : "border border-primary/50 bg-primary/20 text-primary hover:bg-primary/30"
            }`}
          >
            🔥 {isBoosting ? "TURBO ACTIVO!" : "MANTÉN PARA ACELERAR"}
          </button>
        </div>
      </div>

      {/* Pista animada en Canvas */}
      <div className="relative w-full">
        <canvas ref={canvasRef} className="block w-full h-[220px]" />
      </div>
    </div>
  );
}
