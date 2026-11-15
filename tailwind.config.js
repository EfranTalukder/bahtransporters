/** BAH Transporters website — Tailwind build config (see package.json "build").
 *  Colours are the same as the admin app:
 *    ink   warm charcoal (text, dark sections)
 *    ember the brand orange (main buttons, highlights)
 *    sand  warm paper background
 *    sky   flight blue (small accents)
 *    ok    green for "paid / done" only
 */
module.exports = {
  content: ['./src/**/*.html', './assets/**/*.js'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1C1916', 950: '#100E0C', 900: '#1C1916', 800: '#2E2A26', 700: '#47413B', soft: '#5A534B', faint: '#8F877C', line: '#E7E0D6' },
        ember: { DEFAULT: '#E25A2E', dark: '#C4461D', deep: '#9E3714', light: '#FDEEE7', soft: '#FBD9CB', bright: '#F47A50' },
        sand: { DEFAULT: '#F7F3EE', 2: '#EFE8DF', 3: '#E6DCCF' },
        sky: { DEFAULT: '#1F78C1', dark: '#155E9C', light: '#E7F1FB' },
        ok: { DEFAULT: '#1F9D63', dark: '#177A4C', light: '#E6F5EE' },
        wa: { DEFAULT: '#1DA851', dark: '#168A42' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      maxWidth: { site: '1240px' },
      boxShadow: {
        soft: '0 1px 2px rgba(28,25,22,0.04), 0 10px 30px -18px rgba(28,25,22,0.22)',
        lift: '0 2px 4px rgba(28,25,22,0.04), 0 24px 48px -24px rgba(28,25,22,0.32)',
        float: '0 30px 60px -28px rgba(28,25,22,0.45), 0 10px 24px -14px rgba(28,25,22,0.25)',
        ember: '0 1px 0 rgba(255,255,255,0.25) inset, 0 12px 26px -12px rgba(226,90,46,0.65), 0 3px 8px -4px rgba(158,55,20,0.4)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
