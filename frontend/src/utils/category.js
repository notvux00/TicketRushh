import { Music, PencilRuler, Theater, Trophy } from "lucide-react";

/**
 * The seed data and the admin form use different category vocabularies
 * ("Concert" vs "MUSIC"). Keep both working while presenting one filter UI.
 */
export const CATEGORY_GROUPS = [
  {
    key: "CONCERT",
    name: "Âm nhạc",
    aliases: ["CONCERT", "MUSIC", "ÂM NHẠC"],
    icon: Music,
    tone: "bg-blue-50 text-blue-600",
  },
  {
    key: "STAGE",
    name: "Sân khấu & Phim",
    aliases: ["STAGE", "SÂN KHẤU", "PHIM", "THEATER", "MOVIE"],
    icon: Theater,
    tone: "bg-violet-50 text-violet-600",
  },
  {
    key: "SPORTS",
    name: "Thể thao",
    aliases: ["SPORTS", "THỂ THAO"],
    icon: Trophy,
    tone: "bg-orange-50 text-orange-600",
  },
  {
    key: "WORKSHOP",
    name: "Workshop",
    aliases: ["WORKSHOP"],
    icon: PencilRuler,
    tone: "bg-teal-50 text-teal-600",
  },
];

const CATEGORY_LABELS = {
  CONCERT: "Âm nhạc",
  MUSIC: "Âm nhạc",
  "ÂM NHẠC": "Âm nhạc",
  STAGE: "Sân khấu",
  "SÂN KHẤU": "Sân khấu",
  THEATER: "Sân khấu",
  PHIM: "Phim",
  MOVIE: "Phim",
  SPORTS: "Thể thao",
  "THỂ THAO": "Thể thao",
  WORKSHOP: "Workshop",
};

export function normalizeCategory(value) {
  return String(value || "").trim().toUpperCase();
}

export function categoryGroup(value) {
  const normalized = normalizeCategory(value);
  return CATEGORY_GROUPS.find((group) => group.aliases.includes(normalized)) || null;
}

export function categoryLabel(value) {
  if (!value) return "Sự kiện";
  return CATEGORY_LABELS[normalizeCategory(value)] || String(value);
}

export function matchesCategoryGroup(value, groupKey) {
  if (!groupKey) return true;
  const group = CATEGORY_GROUPS.find((item) => item.key === groupKey);
  return Boolean(group?.aliases.includes(normalizeCategory(value)));
}
