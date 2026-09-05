import config from '../eslint.config.mjs';
export default config.map(entry=>({...entry,files:['**/*.js','**/*.jsx','**/*.mjs']}));
