import type { Config } from 'tailwindcss';
export default {content:['./index.html','./src/**/*.{ts,tsx}'],darkMode:'class',theme:{extend:{boxShadow:{soft:'0 20px 60px rgba(15,23,42,.10)'},borderRadius:{'2xl':'1.25rem'}}},plugins:[]} satisfies Config;
