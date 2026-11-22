// Arranca servidor (tsx watch, puerto 3000) y cliente (Vite, puerto 5173) juntos.
import { spawn } from 'node:child_process';

const procs = [
  { name: 'server', color: '\x1b[35m', args: ['run', 'dev', '-w', '@duo/server'] },
  { name: 'web', color: '\x1b[36m', args: ['run', 'dev', '-w', '@duo/web'] },
];
const children = procs.map(({ name, color, args }) => {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: ['inherit', 'pipe', 'pipe'] });
  const prefix = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) =>
    stream.on('data', (d) => {
      for (const line of String(d).split('\n')) if (line.trim()) out.write(prefix + line + '\n');
    });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${prefix}terminó (${code ?? 0})`);
    for (const c of children) if (c !== child) c.kill();
    process.exit(code ?? 0);
  });
  return child;
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => children.forEach((c) => c.kill(sig)));
