import dotenv from 'dotenv';
import dotenvParseVariables from 'dotenv-parse-variables';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const targetIndex = args.indexOf('--target');
const target = targetIndex !== -1 ? args[targetIndex + 1] : 'development';

const rootPath = path.resolve(__dirname, '..');
const envConfigPath = path.join(__dirname, `${target}.env`);
const claspConfigPath = path.join(__dirname, '.clasp.json');
const templateConfigPath = path.join(rootPath, 'templates', `${target}.md`);
const serverConfigPath = path.join(rootPath, 'server', `__env.js`);
const templateEnvConfigPath = path.join(rootPath, 'templates', '_includes', `env.njk`);

try {
  if (!fs.existsSync(envConfigPath)) {
    throw new Error(`Archivo no encontrado: ${envConfigPath}`);
  }

  const envConfig = dotenv.config({ path: envConfigPath });
  const parsedEnvConfig = dotenvParseVariables(envConfig.parsed);
  const scriptId = parsedEnvConfig.SCRIPT_ID;
  if (!scriptId) {
    throw new Error(`SCRIPT_ID no definido en ${envConfigPath}`);
  }
  let claspConfig = {};
  if (fs.existsSync(claspConfigPath)) {
    claspConfig = JSON.parse(fs.readFileSync(claspConfigPath, 'utf-8'));
  }
  claspConfig.scriptId = scriptId;
  fs.writeFileSync(claspConfigPath, JSON.stringify(claspConfig, null, 2));
  console.log(`✨ ScriptId actualizado a [${target}] en .clasp.json`);

  if(!fs.existsSync(templateConfigPath)) {
    throw new Error(`Archivo de plantilla no encontrado: ${target}.md`);
  }
  let templateConfig = '---\n';
  for (const key in parsedEnvConfig) {
    templateConfig += `${key.toLocaleLowerCase()}: ${parsedEnvConfig[key]}\n`;
  }
  templateConfig += '---\n';
  fs.writeFileSync(templateConfigPath, templateConfig);
  console.log(`✨ Plantilla actualizada a [${target}] en ${target}.md`);
  
  if(!fs.existsSync(serverConfigPath)) {
    throw new Error(`Archivo de plantilla no encontrado: ${target}.md`);
  }
  let serverConfig = '';
  for (const key in parsedEnvConfig) {
    const value = typeof parsedEnvConfig[key] === 'string' ? `"${parsedEnvConfig[key]}"` : parsedEnvConfig[key];
    serverConfig += `const ${key.toUpperCase()} = ${value};\n`;
  }
  fs.writeFileSync(serverConfigPath, serverConfig);
  console.log(`✨ Plantilla actualizada a [${target}] en __env.js`);


  if(!fs.existsSync(templateEnvConfigPath)) {
    throw new Error(`Archivo de plantilla no encontrado: env.njk`);
  }
  let templateEnvConfig = '<script>\n';
  for (const key in parsedEnvConfig) {
    const value = typeof parsedEnvConfig[key] === 'string' ? `"{{ ${key.toLowerCase()} }}"` : `{{ ${key.toLowerCase()} }}`;
    templateEnvConfig += `const ${key.toLocaleUpperCase()} = ${value}\n`;
  }
  templateEnvConfig += '</script>\n';
  fs.writeFileSync(templateEnvConfigPath, templateEnvConfig);
  console.log(`✨ Plantilla actualizada a [${target}] en env.njk`);

} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
