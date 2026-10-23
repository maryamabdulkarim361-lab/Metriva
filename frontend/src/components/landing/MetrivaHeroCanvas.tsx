import React, { useEffect, useRef } from "react";
import { useTheme } from "../../theme/ThemeContext";

interface MetrivaHeroCanvasProps {
  className?: string;
}

export const MetrivaHeroCanvas: React.FC<MetrivaHeroCanvasProps> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;
    let prefersReducedMotion = false;

    // Check prefers-reduced-motion
    if (typeof window !== "undefined") {
      prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    // High DPI scaling
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Mouse parallax tracking
    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / width - 0.5;
      const y = (e.clientY - rect.top) / height - 0.5;
      targetMouseX = x * 30; // Max 30px offset
      targetMouseY = y * 20; // Max 20px offset
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // IntersectionObserver to pause when off-screen
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    // Visibility change listener
    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Abstract 3D Data Pillars / Financial Towers
    // Coordinates on isometric ground plane (-1 to 1 X, 0 to 1 Z depth)
    interface DataTower {
      x: number;
      z: number;
      baseHeight: number;
      currentHeight: number;
      width: number;
      depth: number;
      pulseSpeed: number;
      pulsePhase: number;
      color: string;
    }

    const towers: DataTower[] = [
      { x: -0.65, z: 0.85, baseHeight: 180, currentHeight: 180, width: 34, depth: 34, pulseSpeed: 0.015, pulsePhase: 0, color: "#06B6D4" },
      { x: -0.45, z: 0.65, baseHeight: 240, currentHeight: 240, width: 38, depth: 38, pulseSpeed: 0.018, pulsePhase: 1.5, color: "#22D3EE" },
      { x: -0.28, z: 0.45, baseHeight: 140, currentHeight: 140, width: 28, depth: 28, pulseSpeed: 0.02, pulsePhase: 3.0, color: "#3B82F6" },
      { x: -0.75, z: 0.40, baseHeight: 160, currentHeight: 160, width: 30, depth: 30, pulseSpeed: 0.012, pulsePhase: 4.2, color: "#00F0FF" },
      { x: 0.32, z: 0.50, baseHeight: 210, currentHeight: 210, width: 32, depth: 32, pulseSpeed: 0.016, pulsePhase: 2.1, color: "#22D3EE" },
      { x: 0.52, z: 0.70, baseHeight: 280, currentHeight: 280, width: 42, depth: 42, pulseSpeed: 0.014, pulsePhase: 0.8, color: "#06B6D4" },
      { x: 0.72, z: 0.90, baseHeight: 190, currentHeight: 190, width: 36, depth: 36, pulseSpeed: 0.022, pulsePhase: 5.1, color: "#3B82F6" },
      { x: 0.82, z: 0.45, baseHeight: 150, currentHeight: 150, width: 26, depth: 26, pulseSpeed: 0.019, pulsePhase: 3.7, color: "#00F0FF" },
    ];

    // Floating Analytics Particles
    interface Particle {
      x: number;
      y: number;
      speedY: number;
      speedX: number;
      size: number;
      opacity: number;
      maxOpacity: number;
    }

    const particles: Particle[] = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speedY: 0.3 + Math.random() * 0.7,
      speedX: (Math.random() - 0.5) * 0.3,
      size: 1 + Math.random() * 2.2,
      opacity: Math.random(),
      maxOpacity: 0.3 + Math.random() * 0.6,
    }));

    // Network connection pulses
    interface NetworkPulse {
      towerFrom: number;
      towerTo: number;
      progress: number;
      speed: number;
    }

    const networkConnections = [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
    ];

    const pulses: NetworkPulse[] = networkConnections.map((c, i) => ({
      towerFrom: c.from,
      towerTo: c.to,
      progress: (i * 0.2) % 1,
      speed: 0.008 + (i % 3) * 0.004,
    }));

    let gridOffset = 0;
    let time = 0;

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Smooth mouse parallax
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      const isDark = resolvedTheme === "dark";

      // 1. Perspective Grid Horizon & Background Atmospheric Glow
      const vanishingX = width * 0.5 + mouseX * 0.4;
      const vanishingY = height * 0.52 + mouseY * 0.3;

      // Atmospheric Radial Glow
      const glowGrad = ctx.createRadialGradient(
        vanishingX,
        vanishingY * 0.8,
        10,
        vanishingX,
        vanishingY,
        width * 0.6
      );
      if (isDark) {
        glowGrad.addColorStop(0, "rgba(6, 182, 212, 0.22)");
        glowGrad.addColorStop(0.35, "rgba(37, 99, 235, 0.12)");
        glowGrad.addColorStop(0.7, "rgba(11, 15, 25, 0.05)");
        glowGrad.addColorStop(1, "rgba(7, 11, 20, 0)");
      } else {
        glowGrad.addColorStop(0, "rgba(6, 182, 212, 0.2)");
        glowGrad.addColorStop(0.4, "rgba(59, 130, 246, 0.1)");
        glowGrad.addColorStop(1, "rgba(248, 250, 252, 0)");
      }

      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Animated Perspective Floor Grid
      const gridFloorY = vanishingY;
      const gridBottomY = height + 40;
      const numRays = 26;

      ctx.save();
      ctx.lineWidth = 1;

      // Radial grid rays spreading from horizon
      for (let i = 0; i <= numRays; i++) {
        const spreadFactor = (i / numRays - 0.5) * 2; // -1 to 1
        const bottomX = vanishingX + spreadFactor * (width * 0.95);

        const rayGrad = ctx.createLinearGradient(vanishingX, gridFloorY, bottomX, gridBottomY);
        if (isDark) {
          rayGrad.addColorStop(0, "rgba(34, 211, 238, 0.02)");
          rayGrad.addColorStop(0.3, "rgba(6, 182, 212, 0.15)");
          rayGrad.addColorStop(1, "rgba(37, 99, 235, 0.3)");
        } else {
          rayGrad.addColorStop(0, "rgba(6, 182, 212, 0.02)");
          rayGrad.addColorStop(0.4, "rgba(6, 182, 212, 0.18)");
          rayGrad.addColorStop(1, "rgba(37, 99, 235, 0.25)");
        }

        ctx.strokeStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(vanishingX, gridFloorY);
        ctx.lineTo(bottomX, gridBottomY);
        ctx.stroke();
      }

      // Horizontal grid lines flowing toward camera
      if (!prefersReducedMotion) {
        gridOffset = (gridOffset + 0.003) % 1;
      }

      const numHorizLines = 16;
      for (let j = 0; j < numHorizLines; j++) {
        const normalizedZ = (j / numHorizLines + gridOffset) % 1;
        // Non-linear depth curve for perspective compression
        const depthCurve = Math.pow(normalizedZ, 2.2);
        const y = gridFloorY + depthCurve * (gridBottomY - gridFloorY);

        const halfWidth = depthCurve * (width * 0.95);
        const xStart = vanishingX - halfWidth;
        const xEnd = vanishingX + halfWidth;

        const alpha = Math.min(depthCurve * (isDark ? 0.35 : 0.25), 0.35);
        ctx.strokeStyle = isDark
          ? `rgba(34, 211, 238, ${alpha})`
          : `rgba(6, 182, 212, ${alpha * 0.9})`;

        ctx.beginPath();
        ctx.moveTo(xStart, y);
        ctx.lineTo(xEnd, y);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Render 3D Abstract Financial Towers / Data Pillars
      // Convert (x, z) ground coordinates to 2D screen positions with perspective
      const projectPoint = (worldX: number, worldZ: number, worldY: number) => {
        const perspectiveDepth = 0.3 + worldZ * 0.7; // 0.3 to 1.0
        const screenX = vanishingX + worldX * (width * 0.48) * perspectiveDepth;
        const screenBaseY = gridFloorY + Math.pow(worldZ, 1.8) * (gridBottomY - gridFloorY);
        const screenY = screenBaseY - worldY * perspectiveDepth;
        return { x: screenX, y: screenY, depth: perspectiveDepth };
      };

      // Sort towers back-to-front by Z depth for correct painter's layering
      const sortedTowers = [...towers].sort((a, b) => a.z - b.z);

      sortedTowers.forEach((tower) => {
        if (!prefersReducedMotion) {
          tower.currentHeight =
            tower.baseHeight + Math.sin(time * tower.pulseSpeed + tower.pulsePhase) * 25;
        }

        const halfW = tower.width * 0.5;
        const halfD = tower.depth * 0.5;

        // Base 4 points on floor
        const b1 = projectPoint(tower.x - halfW / width, tower.z - halfD / height, 0);
        const b2 = projectPoint(tower.x + halfW / width, tower.z - halfD / height, 0);
        const b3 = projectPoint(tower.x + halfW / width, tower.z + halfD / height, 0);
        const b4 = projectPoint(tower.x - halfW / width, tower.z + halfD / height, 0);

        // Top 4 points elevated by currentHeight
        const t1 = projectPoint(tower.x - halfW / width, tower.z - halfD / height, tower.currentHeight);
        const t2 = projectPoint(tower.x + halfW / width, tower.z - halfD / height, tower.currentHeight);
        const t3 = projectPoint(tower.x + halfW / width, tower.z + halfD / height, tower.currentHeight);
        const t4 = projectPoint(tower.x - halfW / width, tower.z + halfD / height, tower.currentHeight);

        // Base shadow on grid
        ctx.save();
        ctx.fillStyle = isDark ? "rgba(0, 0, 0, 0.45)" : "rgba(15, 23, 42, 0.08)";
        ctx.beginPath();
        ctx.moveTo(b1.x, b1.y);
        ctx.lineTo(b2.x, b2.y);
        ctx.lineTo(b3.x, b3.y);
        ctx.lineTo(b4.x, b4.y);
        ctx.closePath();
        ctx.fill();

        // Front Face Fill & Wireframe
        const frontGrad = ctx.createLinearGradient(b4.x, b4.y, t4.x, t4.y);
        if (isDark) {
          frontGrad.addColorStop(0, "rgba(15, 23, 42, 0.2)");
          frontGrad.addColorStop(1, "rgba(6, 182, 212, 0.18)");
        } else {
          frontGrad.addColorStop(0, "rgba(226, 232, 240, 0.3)");
          frontGrad.addColorStop(1, "rgba(6, 182, 212, 0.12)");
        }
        ctx.fillStyle = frontGrad;
        ctx.beginPath();
        ctx.moveTo(b4.x, b4.y);
        ctx.lineTo(b3.x, b3.y);
        ctx.lineTo(t3.x, t3.y);
        ctx.lineTo(t4.x, t4.y);
        ctx.closePath();
        ctx.fill();

        // Right/Side Face Fill
        const sideGrad = ctx.createLinearGradient(b3.x, b3.y, t3.x, t3.y);
        if (isDark) {
          sideGrad.addColorStop(0, "rgba(15, 23, 42, 0.35)");
          sideGrad.addColorStop(1, "rgba(37, 99, 235, 0.25)");
        } else {
          sideGrad.addColorStop(0, "rgba(203, 213, 225, 0.4)");
          sideGrad.addColorStop(1, "rgba(37, 99, 235, 0.16)");
        }
        ctx.fillStyle = sideGrad;
        ctx.beginPath();
        ctx.moveTo(b3.x, b3.y);
        ctx.lineTo(b2.x, b2.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.lineTo(t3.x, t3.y);
        ctx.closePath();
        ctx.fill();

        // Top Cap Face
        ctx.fillStyle = isDark ? "rgba(34, 211, 238, 0.35)" : "rgba(6, 182, 212, 0.25)";
        ctx.beginPath();
        ctx.moveTo(t1.x, t1.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.lineTo(t3.x, t3.y);
        ctx.lineTo(t4.x, t4.y);
        ctx.closePath();
        ctx.fill();

        // Glowing Wireframe Edges
        ctx.strokeStyle = isDark ? tower.color : "#0891B2";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        // Base lines
        ctx.moveTo(b4.x, b4.y);
        ctx.lineTo(b3.x, b3.y);
        ctx.lineTo(b2.x, b2.y);
        // Vertical pillars
        ctx.moveTo(b4.x, b4.y);
        ctx.lineTo(t4.x, t4.y);
        ctx.moveTo(b3.x, b3.y);
        ctx.lineTo(t3.x, t3.y);
        ctx.moveTo(b2.x, b2.y);
        ctx.lineTo(t2.x, t2.y);
        // Top perimeter
        ctx.moveTo(t1.x, t1.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.lineTo(t3.x, t3.y);
        ctx.lineTo(t4.x, t4.y);
        ctx.closePath();
        ctx.stroke();

        // Top intelligence node beacon
        ctx.fillStyle = isDark ? "#00F0FF" : "#0284C7";
        ctx.beginPath();
        ctx.arc(t3.x, t3.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 4. Network Connection Lines & Moving Data Pulses
      networkConnections.forEach((conn, idx) => {
        const fromTower = towers[conn.from];
        const toTower = towers[conn.to];
        const p1 = projectPoint(fromTower.x, fromTower.z, fromTower.currentHeight);
        const p2 = projectPoint(toTower.x, toTower.z, toTower.currentHeight);

        // Delicate connecting wire
        ctx.save();
        ctx.strokeStyle = isDark ? "rgba(34, 211, 238, 0.2)" : "rgba(6, 182, 212, 0.25)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pulse traveling along the wire
        const pulse = pulses[idx];
        if (!prefersReducedMotion) {
          pulse.progress = (pulse.progress + pulse.speed) % 1;
        }

        const pulseX = p1.x + (p2.x - p1.x) * pulse.progress;
        const pulseY = p1.y + (p2.y - p1.y) * pulse.progress;

        ctx.fillStyle = isDark ? "#00F0FF" : "#0284C7";
        ctx.shadowColor = "#22D3EE";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 5. Floating Analytics Particles (Sparks of insight)
      particles.forEach((p) => {
        if (!prefersReducedMotion) {
          p.y -= p.speedY;
          p.x += p.speedX;
          if (p.y < 0) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
        }

        ctx.fillStyle = isDark
          ? `rgba(34, 211, 238, ${p.opacity})`
          : `rgba(8, 145, 178, ${p.opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      time += 1;
      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (prefersReducedMotion) {
      render(); // Single static frame
    } else {
      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      observer.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [resolvedTheme]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

