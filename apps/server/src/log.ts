/**
 * Registro mínimo en JSON. Por privacidad nunca se registran IPs, nombres,
 * códigos de sala, tokens ni respuestas del quiz.
 */
type Fields = Record<string, string | number | boolean>;

function write(level: 'info' | 'warn' | 'error', msg: string, fields: Fields): void {
  if (process.env.DUO_SILENT === '1') return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields: Fields = {}) => write('info', msg, fields),
  warn: (msg: string, fields: Fields = {}) => write('warn', msg, fields),
  error: (msg: string, fields: Fields = {}) => write('error', msg, fields),
};
