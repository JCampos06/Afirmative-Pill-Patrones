/**
 * Logger minimalista con colores ANSI. Pensado para que en la sustentación
 * se lean fácilmente las operaciones GraphQL, los SQL y los lotes de DataLoader.
 */
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const;

type Color = keyof typeof colors;

const useColor = !process.env.VERCEL && process.stdout.isTTY !== false;

function paint(color: Color, text: string): string {
  return useColor ? `${colors[color]}${text}${colors.reset}` : text;
}

function time(): string {
  return new Date().toISOString().slice(11, 23);
}

function line(tag: string, color: Color, message: string) {
  console.log(`${paint('dim', time())} ${paint(color, tag.padEnd(11))} ${message}`);
}

export const logger = {
  info: (msg: string) => line('INFO', 'blue', msg),
  warn: (msg: string) => line('WARN', 'yellow', msg),
  error: (msg: string, err?: unknown) => {
    line('ERROR', 'red', msg);
    if (err) console.error(err);
  },
  graphql: (msg: string) => line('GRAPHQL', 'magenta', msg),
  sql: (msg: string) => line('SQL', 'dim', msg),
  loader: (msg: string) => line('DATALOADER', 'cyan', msg),
  command: (msg: string) => line('COMMAND', 'green', msg),
  event: (msg: string) => line('PROJECTOR', 'yellow', msg),
  paint,
};
