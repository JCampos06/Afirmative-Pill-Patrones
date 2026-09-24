// Copia schema.graphql (fuente única de verdad del contrato) a:
//  1. un módulo TS, para que el SDL viaje dentro del bundle y no dependa de
//     leer archivos en tiempo de ejecución (importante en Vercel);
//  2. la sección "Schema SDL completo" del README raíz (si existe).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const sdl = readFileSync(new URL('../schema.graphql', import.meta.url), 'utf8');

writeFileSync(
  new URL('../src/graphql/typeDefs.generated.ts', import.meta.url),
  '// ARCHIVO GENERADO por scripts/embed-schema.mjs a partir de schema.graphql. No editar.\n' +
    `export const typeDefs = ${JSON.stringify(sdl)};\n`,
  'utf8',
);
console.log('✔ schema.graphql embebido en src/graphql/typeDefs.generated.ts');

const readmeUrl = new URL('../../README.md', import.meta.url);
if (existsSync(readmeUrl)) {
  const readme = readFileSync(readmeUrl, 'utf8');
  const pattern = /<!-- SDL:START -->[\s\S]*?<!-- SDL:END -->/;
  if (pattern.test(readme)) {
    const block = `<!-- SDL:START -->\n\n\`\`\`graphql\n${sdl.trim()}\n\`\`\`\n\n<!-- SDL:END -->`;
    const updated = readme.replace(pattern, () => block);
    if (updated !== readme) {
      writeFileSync(readmeUrl, updated, 'utf8');
      console.log('✔ README.md sincronizado con schema.graphql');
    }
  }
}
