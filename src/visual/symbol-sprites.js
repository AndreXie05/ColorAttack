import * as THREE from "three";
import { COLORS, css } from "../base/colors.js";

/* ============================================================
   SÍMBOLO DA COR ACIMA DE CADA JOGADOR
   Bolinha da cor com o símbolo (círculo, triângulo, quadrado, losango, estrela, hexágono).
   Um sprite por cor, criado uma só vez e reutilizado.
   ============================================================ */
const _cache = new Map();

function drawShape(ctx, shape, cx, cy, r) {
  ctx.beginPath();
  const poly = (pts) => pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * r, cy + y * r) : ctx.moveTo(cx + x * r, cy + y * r)));
  if (shape === "circulo") ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  else if (shape === "triangulo") { poly([[0, -0.9], [0.85, 0.7], [-0.85, 0.7]]); ctx.closePath(); }
  else if (shape === "quadrado") ctx.rect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4);
  else if (shape === "diamante") { poly([[0, -0.95], [0.95, 0], [0, 0.95], [-0.95, 0]]); ctx.closePath(); }
  else if (shape === "estrela") {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? 0.4 : 1; pts.push([Math.cos(a) * k, Math.sin(a) * k]); }
    poly(pts); ctx.closePath();
  } else if (shape === "cruz") { poly([[-0.3, -0.9], [0.3, -0.9], [0.3, -0.3], [0.9, -0.3], [0.9, 0.3], [0.3, 0.3], [0.3, 0.9], [-0.3, 0.9], [-0.3, 0.3], [-0.9, 0.3], [-0.9, -0.3], [-0.3, -0.3]]); ctx.closePath(); }
  else { poly([[0, -0.95], [0.82, -0.47], [0.82, 0.47], [0, 0.95], [-0.82, 0.47], [-0.82, -0.47]]); ctx.closePath(); }   // hexágono
  ctx.fillStyle = "#fff"; ctx.fill();
  ctx.lineWidth = r * 0.14; ctx.strokeStyle = "#1a1033"; ctx.lineJoin = "round"; ctx.stroke();
}

// Material de sprite para a cor (null fora do browser)
export function symbolMaterial(colorId) {
  if (typeof document === "undefined") return null;
  let m = _cache.get(colorId);
  if (!m) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const ctx = c.getContext("2d");
    ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fillStyle = css(colorId); ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = "#fff"; ctx.stroke();
    drawShape(ctx, COLORS[colorId].symbol, 64, 66, 30);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true });   // some atrás de paredes
    _cache.set(colorId, m);
  }
  return m;
}
