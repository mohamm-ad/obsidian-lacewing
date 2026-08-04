import { access, readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));

if (manifest.version !== packageJson.version) {
	throw new Error("manifest.json and package.json versions must match.");
}

if (versions[manifest.version] !== manifest.minAppVersion) {
	throw new Error("versions.json must map the release to minAppVersion.");
}

for (const file of ["main.js", "manifest.json", "styles.css"]) {
	await access(file);
}

const bundle = await readFile("main.js", "utf8");
if (!bundle.includes('require("obsidian")')) {
	throw new Error("The production bundle must leave Obsidian external.");
}

if (bundle.includes("node_modules/obsidian")) {
	throw new Error("The production bundle appears to contain the Obsidian runtime.");
}

process.stdout.write("Release artifacts validated.\n");

