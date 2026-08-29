import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

async function loadLocalConfig() {
	const text = await readFile(".env.local", "utf8");
	return Object.fromEntries(
		text
			.split(/\r?\n/u)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"))
			.map((line) => {
				const separator = line.indexOf("=");
				return [line.slice(0, separator), line.slice(separator + 1)];
			}),
	);
}

const config = await loadLocalConfig();
const vaultPath = config.OBSIDIAN_VAULT_PATH;

if (!vaultPath || !path.isAbsolute(vaultPath) || vaultPath === path.parse(vaultPath).root) {
	throw new Error("OBSIDIAN_VAULT_PATH must be an explicit absolute vault path.");
}

const destination = path.join(vaultPath, ".obsidian", "plugins", "lacewing");
await mkdir(destination, { recursive: true });

for (const file of ["main.js", "manifest.json", "styles.css"]) {
	await copyFile(file, path.join(destination, file));
}

process.stdout.write(`Installed Lacewing Window Transparency in ${destination}\n`);
