"use client";
import { useEffect, useState } from "react";
import type { AvatarLook, Seat } from "@/lib/seats";

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function HairBack({ l }: { l: AvatarLook }) {
  const c = l.hairColor;
  if (l.hair === "longF")
    return <path d="M42 100 C40 40 160 40 158 100 L166 200 C150 214 50 214 34 200 Z" fill={c} />;
  if (l.hair === "bob")
    return <path d="M44 100 C42 40 158 40 156 100 L160 165 C140 176 60 176 40 165 Z" fill={c} />;
  if (l.hair === "wavy")
    return <path d="M42 100 C38 40 162 40 158 100 C168 130 156 150 164 178 C150 196 128 192 120 200 L80 200 C72 192 50 196 36 178 C44 150 32 130 42 100 Z" fill={c} />;
  if (l.hair === "bangs")
    return <path d="M42 100 C40 40 160 40 158 100 L164 210 C150 220 50 220 36 210 Z" fill={c} />;
  if (l.hair === "curlyShort")
    return (
      <g fill={c}>
        <circle cx={52} cy={112} r={16} />
        <circle cx={148} cy={112} r={16} />
        <circle cx={56} cy={138} r={12} />
        <circle cx={144} cy={138} r={12} />
      </g>
    );
  if (l.hair === "long" || l.hair === "curly")
    return <path d="M44 96 C40 36 160 36 156 96 L162 175 C140 186 60 186 38 175 Z" fill={c} />;
  return null;
}

function HairFront({ l }: { l: AvatarLook }) {
  const c = l.hairColor;
  const d = shade(c, -25);
  switch (l.hair) {
    case "bald":
      return (
        <g fill={c} opacity={0.85}>
          <path d="M49 98 C48 84 52 76 56 72 L58 104 Z" />
          <path d="M151 98 C152 84 148 76 144 72 L142 104 Z" />
        </g>
      );
    case "short":
      return <path d="M48 96 C44 46 80 34 104 36 C134 36 158 52 152 98 C148 76 136 62 112 60 C86 58 60 66 48 96 Z" fill={c} stroke={d} strokeWidth={1.5} />;
    case "white":
      return (
        <g fill={c} stroke="#cfcfcf" strokeWidth={1.5}>
          <path d="M46 102 C36 60 64 34 100 34 C140 34 166 58 154 102 C150 80 140 64 120 60 C100 66 76 62 62 72 C54 80 50 90 46 102 Z" />
          <ellipse cx={50} cy={100} rx={8} ry={14} />
          <ellipse cx={150} cy={100} rx={8} ry={14} />
        </g>
      );
    case "spiky":
      return (
        <path
          d="M48 98 C44 70 50 52 60 46 L62 30 L76 42 L84 22 L96 38 L108 20 L116 38 L130 24 L134 44 L146 38 L146 56 C154 66 156 82 152 98 C146 76 130 66 104 64 C78 64 58 74 48 98 Z"
          fill={c}
          stroke={d}
          strokeWidth={1.5}
        />
      );
    case "fringe":
      return <path d="M48 98 C42 50 74 34 102 34 C132 34 160 50 152 98 C150 80 144 70 136 66 C120 72 96 74 78 66 C64 70 52 82 48 98 Z" fill={c} stroke={d} strokeWidth={1.5} />;
    case "cap":
      return (
        <g>
          <path d="M50 102 C46 92 46 84 48 78 L56 104 Z M150 102 C154 92 154 84 152 78 L144 104 Z" fill={c} />
          <path d="M44 82 C44 30 156 30 156 82 Z" fill="#26262c" stroke="#111" strokeWidth={1.5} />
          <path d="M40 82 C70 72 130 72 160 82 C160 90 40 90 40 82 Z" fill="#1b1b20" />
          {l.capText && (
            <text x={100} y={64} textAnchor="middle" fontSize={11} fontWeight={700} fill="#d9d9d9" fontFamily="sans-serif" letterSpacing={1}>
              {l.capText}
            </text>
          )}
        </g>
      );
    case "wavy":
      return (
        <path
          d="M46 106 C38 46 80 30 104 32 C138 34 164 56 154 106 C152 86 144 74 134 68 C130 78 120 80 112 70 C100 82 82 76 76 68 C64 74 52 88 46 106 Z"
          fill={c}
          stroke={d}
          strokeWidth={1.5}
        />
      );
    case "bangs":
      return <path d="M46 100 C40 46 80 32 102 32 C134 32 162 50 154 100 C152 90 150 86 148 84 L56 84 C52 88 48 94 46 100 Z" fill={c} stroke={d} strokeWidth={1.5} />;
    case "curlyShort":
      return (
        <g fill={c} stroke={d} strokeWidth={1.2}>
          <circle cx={62} cy={76} r={16} />
          <circle cx={82} cy={58} r={18} />
          <circle cx={106} cy={52} r={19} />
          <circle cx={130} cy={60} r={17} />
          <circle cx={145} cy={80} r={14} />
          <circle cx={52} cy={96} r={11} />
          <circle cx={150} cy={98} r={10} />
        </g>
      );
    case "longF":
    case "bob":
      return <path d="M46 104 C40 46 82 32 104 34 C136 36 160 56 154 104 C150 82 138 66 120 62 C100 72 70 70 58 76 C52 84 48 94 46 104 Z" fill={c} stroke={d} strokeWidth={1.5} />;
    default:
      return <path d="M48 96 C44 46 80 34 104 36 C134 36 158 52 152 98 C148 76 136 62 112 60 C86 58 60 66 48 96 Z" fill={c} />;
  }
}

export function CartoonFace({ look: l, speaking }: { look: AvatarLook; speaking?: boolean }) {
  const skinD = shade(l.skin, -30);
  const shirtD = shade(l.shirt, -30);
  const bc = l.beardColor ?? l.hairColor;
  return (
    <svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <radialGradient id={`sk-${l.skin.slice(1)}`} cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor={shade(l.skin, 18)} />
          <stop offset="100%" stopColor={l.skin} />
        </radialGradient>
      </defs>
      <HairBack l={l} />
      {/* body */}
      <path d="M14 240 C18 196 52 176 100 176 C148 176 182 196 186 240 Z" fill={l.shirt} stroke={shirtD} strokeWidth={2} />
      {l.hoodie && (
        <g stroke={shade(l.shirt, 40)} strokeWidth={3} fill="none">
          <path d="M60 182 C70 206 130 206 140 182" />
          <path d="M88 200 L86 226 M112 200 L114 226" strokeLinecap="round" />
        </g>
      )}
      {/* neck */}
      <path d="M82 150 L82 184 C92 192 108 192 118 184 L118 150 Z" fill={skinD} />
      {!l.hoodie && (
        <g>
          <path d="M80 178 L100 200 L120 178 L114 174 L100 190 L86 174 Z" fill="#f4f4f4" />
          {l.tie && <path d="M96 192 L104 192 L108 236 L100 240 L92 236 Z" fill={l.tie} />}
          {l.necklace && <path d="M84 182 C90 200 110 200 116 182" stroke={l.necklace} strokeWidth={2.5} fill="none" />}
          {l.necklace && <circle cx={100} cy={199} r={4} fill={l.necklace} />}
        </g>
      )}
      {/* ears */}
      <ellipse cx={50} cy={108} rx={9} ry={14} fill={l.skin} stroke={skinD} strokeWidth={1.5} />
      <ellipse cx={150} cy={108} rx={9} ry={14} fill={l.skin} stroke={skinD} strokeWidth={1.5} />
      {/* head */}
      <ellipse cx={100} cy={102} rx={51} ry={62} fill={`url(#sk-${l.skin.slice(1)})`} stroke={skinD} strokeWidth={1.5} />
      {/* beard */}
      {l.beard === "full" && (
        <path d="M50 104 C52 150 74 170 100 172 C126 170 148 150 150 104 C146 128 132 138 118 138 C110 134 90 134 82 138 C68 138 54 128 50 104 Z" fill={bc} />
      )}
      {l.beard === "stubble" && (
        <path d="M54 118 C58 152 78 166 100 166 C122 166 142 152 146 118 C140 136 126 146 100 146 C74 146 60 136 54 118 Z" fill={bc} opacity={0.28} />
      )}
      {l.beard === "goatee" && (
        <g fill={bc}>
          <path d="M84 140 C86 162 114 162 116 140 C108 146 92 146 84 140 Z" />
          <path d="M82 134 C90 126 110 126 118 134 C110 132 90 132 82 134 Z" />
        </g>
      )}
      {l.beard === "mustache" && <path d="M78 136 C86 124 98 128 100 131 C102 128 114 124 122 136 C112 132 104 134 100 136 C96 134 88 132 78 136 Z" fill={bc} />}
      {/* cheeks */}
      <ellipse cx={70} cy={124} rx={10} ry={6} fill="#ff8a80" opacity={0.18} />
      <ellipse cx={130} cy={124} rx={10} ry={6} fill="#ff8a80" opacity={0.18} />
      {/* eyes */}
      {l.eyesClosed ? (
        <g stroke="#2b2b2b" strokeWidth={3} fill="none" strokeLinecap="round">
          <path d="M70 104 C76 110 86 110 90 104" />
          <path d="M110 104 C114 110 124 110 130 104" />
        </g>
      ) : (
        <g>
          <ellipse cx={80} cy={104} rx={10} ry={11} fill="#fff" />
          <ellipse cx={120} cy={104} rx={10} ry={11} fill="#fff" />
          <circle cx={81} cy={105} r={6} fill="#3a2a20" />
          <circle cx={121} cy={105} r={6} fill="#3a2a20" />
          <circle cx={83} cy={102} r={2} fill="#fff" />
          <circle cx={123} cy={102} r={2} fill="#fff" />
        </g>
      )}
      {/* brows */}
      <g stroke={l.hair === "bald" || l.hair === "white" ? shade(l.hairColor, -60) : l.hairColor} strokeWidth={4} strokeLinecap="round" fill="none">
        <path d="M68 88 C74 84 84 84 90 87" />
        <path d="M110 87 C116 84 126 84 132 88" />
      </g>
      {l.glasses && (
        <g stroke="#2a2a2a" strokeWidth={3.5} fill="rgba(255,255,255,0.12)">
          <rect x={64} y={92} width={32} height={26} rx={9} />
          <rect x={104} y={92} width={32} height={26} rx={9} />
          <path d="M96 104 L104 104" />
        </g>
      )}
      {/* nose */}
      <path d="M100 108 C96 120 94 124 100 126 C104 126 106 124 106 122" stroke={skinD} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {/* mouth */}
      {speaking ? (
        <path className="mouth-talk" d="M84 138 C90 150 110 150 116 138 Z" fill="#7a2e2e" stroke={l.lipstick} strokeWidth={l.lipstick ? 3 : 0} />
      ) : l.lipstick ? (
        <path d="M84 139 C90 135 96 136 100 138 C104 136 110 135 116 139 C110 148 90 148 84 139 Z" fill={l.lipstick} />
      ) : (
        <path d="M82 138 C90 148 110 148 118 138" stroke="#7a2e2e" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      )}
      <HairFront l={l} />
      {l.earrings && (
        <g fill={l.earrings}>
          <circle cx={48} cy={126} r={4} />
          <circle cx={152} cy={126} r={4} />
        </g>
      )}
      {l.kippah && <path d="M78 46 C84 34 116 34 122 46 C110 42 90 42 78 46 Z" fill={l.kippah} stroke={shade(l.kippah, -30)} strokeWidth={1.5} />}
    </svg>
  );
}

// Custom portraits: drop /public/avatars/<seat id>.png (or .jpg/.webp) and it replaces the SVG cartoon.
let avatarCache: Promise<Record<string, string>> | null = null;
function useCustomAvatars() {
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!avatarCache) avatarCache = fetch("/api/avatars").then((r) => r.json()).catch(() => ({}));
    avatarCache.then(setMap);
  }, []);
  return map;
}

export default function Avatar({ seat, speaking }: { seat: Seat; speaking?: boolean }) {
  const custom = useCustomAvatars();
  if (custom[seat.id])
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={custom[seat.id]} alt={seat.name} className="avatar-img" />;
  return <CartoonFace look={seat.look} speaking={speaking} />;
}
