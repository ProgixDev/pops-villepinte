export const colors = {
  primary: "#FFCE00",
  primaryDark: "#E6B800",
  accent: "#E3000F",
  accentDark: "#B3000C",
  ink: "#111111",
  inkMuted: "#6B6B6B",
  surface: "#FFFFFF",
  background: "#FFFEF7",
  cardDark: "#1A1A1A",
  cardDarkMuted: "#2A2A2A",
  border: "#EDE7D3",
  success: "#1DB954",
  danger: "#E3000F",
  error: "#ba1a1a",
  white: "#FFFFFF",
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  14: 56,
  18: 72,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const font = {
  display: "BebasNeue_400Regular",
  body: "Poppins_400Regular",
  bodyMedium: "Poppins_500Medium",
  bodySemi: "Poppins_600SemiBold",
  bodyBold: "Poppins_700Bold",
  bodyExtraBoldItalic: "Poppins_800ExtraBold_Italic",
} as const;

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  hero: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  float: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
} as const;
