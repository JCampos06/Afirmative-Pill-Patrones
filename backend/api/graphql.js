// Función serverless de Vercel. Reutiliza el backend compilado (npm run build → dist/).
// vercel.json reescribe /graphql → /api/graphql, así el cliente siempre llama a /graphql.
export { default } from '../dist/vercel-handler.js';
