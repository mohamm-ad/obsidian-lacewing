import { access, readFile, stat } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));

for (const file of ["README.md", "LICENSE"]) {
	await access(file);
}

if (manifest.version !== packageJson.version) {
	throw new Error("manifest.json and package.json versions must match.");
}

if (versions[manifest.version] !== manifest.minAppVersion) {
	throw new Error("versions.json must map the release to minAppVersion.");
}

if (
	manifest.id !== "lacewing" ||
	manifest.name !== "Lacewing Window Transparency" ||
	manifest.minAppVersion !== "1.13.0" ||
	manifest.isDesktopOnly !== true
) {
	throw new Error("The release manifest does not match the supported plugin identity.");
}

if (
	typeof manifest.description !== "string" ||
	manifest.description.length > 250 ||
	!manifest.description.endsWith(".")
) {
	throw new Error("The manifest description must be at most 250 characters and end with a period.");
}

if (
	!/^[a-z-]+$/u.test(manifest.id) ||
	manifest.id.includes("obsidian") ||
	manifest.id.endsWith("plugin")
) {
	throw new Error("The plugin ID does not meet the Community Plugins requirements.");
}

if (manifest.name.includes(":") || /obsidian|plugin/iu.test(manifest.name)) {
	throw new Error("The plugin name does not meet the Community Plugins requirements.");
}

if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== manifest.version) {
	throw new Error("The release tag must exactly match the manifest version.");
}

if (packageJson.packageManager !== "pnpm@9.6.0") {
	throw new Error("Releases must use the pinned pnpm 9.6.0 toolchain.");
}

if (
	packageJson.repository?.url !==
	"git+https://github.com/mohamm-ad/obsidian-lacewing.git"
) {
	throw new Error("The package repository must point to the public Lacewing repository.");
}

for (const file of ["main.js", "manifest.json", "styles.css"]) {
	await access(file);
}

const bundle = await readFile("main.js", "utf8");
const bundleSize = (await stat("main.js")).size;
if (!bundle.includes('require("obsidian")')) {
	throw new Error("The production bundle must leave Obsidian external.");
}

if (!bundle.includes("@electron/remote")) {
	throw new Error("The production bundle is missing the guarded Electron adapter.");
}

if (
	bundle.includes("node_modules/obsidian") ||
	bundle.includes("node_modules/electron") ||
	bundle.includes("node_modules/@electron") ||
	bundle.includes('require("electron")') ||
	bundle.includes("electron.remote")
) {
	throw new Error("The production bundle contains a forbidden runtime dependency.");
}

if (bundleSize > 250_000) {
	throw new Error("The production bundle unexpectedly exceeds 250 KB.");
}

process.stdout.write("Release artifacts validated.\n");
