import type { Config } from 'tailwindcss';
export default {content:['./index.html','./src/**/*.{ts,tsx}'],darkMode:'class',theme:{extend:{boxShadow:{soft:'0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',card:'0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)'},borderRadius:{'2xl':'1rem'}}},plugins:[]} satisfies Config;
