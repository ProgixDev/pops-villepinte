/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#FFCE00",
        "primary-dark": "#E6B800",
        accent: "#E3000F",
        "accent-dark": "#B3000C",
        ink: "#111111",
        "ink-muted": "#6B6B6B",
        surface: "#FFFFFF",
        background: "#FFFEF7",
        "card-dark": "#1A1A1A",
        "card-dark-muted": "#2A2A2A",
        border: "#EDE7D3",
        success: "#1DB954",
        danger: "#E3000F",
        error: "#ba1a1a",
      },
      fontFamily: {
        display: ["BebasNeue_400Regular"],
        sans: ["Poppins_400Regular"],
        "sans-medium": ["Poppins_500Medium"],
        "sans-semibold": ["Poppins_600SemiBold"],
        "sans-bold": ["Poppins_700Bold"],
        "sans-extrabold-italic": ["Poppins_800ExtraBold_Italic"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
      },
    },
  },
  plugins: [],
};
