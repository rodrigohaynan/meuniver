export type ThemeDefinition = {
  key: string;
  label: string;
  group: "adult" | "kids";
  description: string;
  colors: {
    background: string;
    panel: string;
    text: string;
    muted: string;
    accent: string;
    accentSoft: string;
    border: string;
  };
};

export const THEMES: ThemeDefinition[] = [
  {
    key: "wine-rose",
    label: "Vinho & Rosé",
    group: "adult",
    description: "Elegante e romântico",
    colors: {
      background: "#fbf5f2",
      panel: "#fffdfb",
      text: "#391a22",
      muted: "#725f63",
      accent: "#7d1f37",
      accentSoft: "#f4e7e0",
      border: "#dfd0c6",
    },
  },
  {
    key: "sage",
    label: "Verde Sálvia",
    group: "adult",
    description: "Leve e sofisticado",
    colors: {
      background: "#f5f7f2",
      panel: "#ffffff",
      text: "#26362d",
      muted: "#68756c",
      accent: "#56725f",
      accentSoft: "#e7eee8",
      border: "#ccd8ce",
    },
  },
  {
    key: "midnight",
    label: "Azul Noite",
    group: "adult",
    description: "Moderno e marcante",
    colors: {
      background: "#f3f6fa",
      panel: "#ffffff",
      text: "#17263c",
      muted: "#657287",
      accent: "#264a78",
      accentSoft: "#e3ebf5",
      border: "#cbd6e5",
    },
  },
  {
    key: "sand-gold",
    label: "Areia & Dourado",
    group: "adult",
    description: "Clássico e acolhedor",
    colors: {
      background: "#fbf8f1",
      panel: "#fffefb",
      text: "#3d3226",
      muted: "#766a5c",
      accent: "#9a7438",
      accentSoft: "#f4ead5",
      border: "#e3d6be",
    },
  },
  {
    key: "kids-pink",
    label: "Infantil Rosa",
    group: "kids",
    description: "Doce e divertido",
    colors: {
      background: "#fff5f9",
      panel: "#ffffff",
      text: "#51243a",
      muted: "#866477",
      accent: "#d6588a",
      accentSoft: "#fde4ee",
      border: "#f2c9da",
    },
  },
  {
    key: "kids-blue",
    label: "Infantil Azul",
    group: "kids",
    description: "Alegre e delicado",
    colors: {
      background: "#f2f9ff",
      panel: "#ffffff",
      text: "#1d3950",
      muted: "#61788b",
      accent: "#3d8cc9",
      accentSoft: "#dff1ff",
      border: "#c6e2f5",
    },
  },
  {
    key: "kids-confetti",
    label: "Confete",
    group: "kids",
    description: "Colorido para crianças",
    colors: {
      background: "#fffaf0",
      panel: "#ffffff",
      text: "#35284b",
      muted: "#746b82",
      accent: "#7856c9",
      accentSoft: "#eee6ff",
      border: "#dfd2f7",
    },
  },
];

export const DEFAULT_THEME = THEMES[0];

export function getTheme(key: string) {
  return THEMES.find((theme) => theme.key === key) ?? DEFAULT_THEME;
}

export const LAYOUTS = [
  { key: "elegant" as const, label: "Elegante", description: "Foto ampla, tipografia clássica e seções suaves." },
  { key: "modern" as const, label: "Moderno", description: "Blocos compactos, título forte e visual contemporâneo." },
  { key: "kids" as const, label: "Infantil", description: "Formas arredondadas, elementos divertidos e maior destaque para foto." },
];

export const TEMPLATES = [
  { key: "adult-elegant", label: "Adulto elegante", theme: "wine-rose", layout: "elegant" as const, emoji: "🥂" },
  { key: "adult-sage", label: "Sálvia minimalista", theme: "sage", layout: "modern" as const, emoji: "🌿" },
  { key: "adult-night", label: "Azul noite", theme: "midnight", layout: "modern" as const, emoji: "✨" },
  { key: "kids-pink", label: "Infantil rosa", theme: "kids-pink", layout: "kids" as const, emoji: "🎀" },
  { key: "kids-blue", label: "Infantil azul", theme: "kids-blue", layout: "kids" as const, emoji: "🎈" },
  { key: "kids-confetti", label: "Infantil confete", theme: "kids-confetti", layout: "kids" as const, emoji: "🎉" },
];
