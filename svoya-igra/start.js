'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

async function start() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (!((major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22)) {
    throw new Error('Нужен Node.js 20.19+, 22.12+ или 24 LTS.');
  }
  try { require.resolve('vite'); }
  catch {
    const bin = path.dirname(process.execPath);
    const candidates = [
      path.join(bin, 'node_modules/npm/bin/npm-cli.js'),
      path.resolve(bin, '../lib/node_modules/npm/bin/npm-cli.js'),
      process.env.npm_execpath,
    ].filter(Boolean);
    const npmCli = candidates.find(file => fs.existsSync(file));
    if (!npmCli) throw new Error('Не найден npm-cli.js. Переустановите Node.js вместе с npm и повторите node start.js.');
    console.log('Первый запуск: устанавливаем Vite. Потребуется интернет…');
    const result = spawnSync(process.execPath, [npmCli, 'ci'], {
      cwd: __dirname, stdio: 'inherit', shell: false, windowsHide: true,
    });
    if (result.error || result.status !== 0) throw new Error('Не удалось установить зависимости. Проверьте подключение и повторите node start.js.');
  }
  const { createServer } = await import('vite');
  const server = await createServer({
    root: __dirname,
    configFile: path.join(__dirname, 'vite.config.mjs'),
    server: { open: !process.argv.includes('--no-open') },
  });
  await server.listen();
  server.printUrls();
  console.log('Оставьте это окно открытым во время игры. Для остановки нажмите Ctrl+C.');
  const stop = async () => { await server.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  return server;
}
if (require.main === module) start().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { start };
