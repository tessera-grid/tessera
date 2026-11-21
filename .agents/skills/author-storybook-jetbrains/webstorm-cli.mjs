// Copyright 2000-2026 JetBrains s.r.o. and contributors. Use of this source code is governed by the Apache 2.0 license.
// Generated from plugins/storybook/cli/webstorm-cli.mts. Edit the source, then run `npm run build` in plugins/storybook/cli.
import { accessSync, constants, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import * as nodePath from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";
export const scriptFailedExitCode = 125;
export const noLauncherExitCode = 126;
export const noInstanceExitCode = 127;
const recordSuffix = "-ide-instance.json";
const productInfoFileName = "product-info.json";
const pluginId = "com.intellij.storybook";
const pluginNameMarker = "storybook";
const preferredProductCodes = ["WS"];
export function withCallerDirectory(args, cwd) {
    return args[0] === "storybook-connect" && args.length >= 2 ? [...args, "--cwd", cwd] : [...args];
}
export const callerVariable = "STORYBOOK_CONNECT_CALLER";
export const callerTypes = ["human", "ai_agent", "script", "ci", "ide_action", "unknown"];
export function withCallerType(args, env) {
    if (args[0] !== "storybook-connect" || args.length < 2 || args.includes("--caller")) {
        return [...args];
    }
    const value = (env[callerVariable] ?? "").trim();
    return callerTypes.includes(value) ? [...args, "--caller", value] : [...args];
}
function pathsOf(platform) {
    return platform === "win32" ? nodePath.win32 : nodePath.posix;
}
export function commonDataDirectory(platform = process.platform, env = process.env, home = homedir()) {
    const { join } = pathsOf(platform);
    if (platform === "darwin") {
        return join(home, "Library", "Application Support", "JetBrains");
    }
    if (platform === "win32") {
        return join(env["APPDATA"] || join(home, "AppData", "Roaming"), "JetBrains");
    }
    return join(env["XDG_DATA_HOME"] || join(home, ".local", "share"), "JetBrains");
}
export function discoveryDirectory(platform = process.platform, env = process.env, home = homedir()) {
    return pathsOf(platform).join(commonDataDirectory(platform, env, home), "discovery");
}
export function toolboxDirectory(platform = process.platform, env = process.env, home = homedir()) {
    const { join } = pathsOf(platform);
    if (platform === "win32") {
        return join(env["LOCALAPPDATA"] || join(home, "AppData", "Local"), "JetBrains", "Toolbox");
    }
    return join(commonDataDirectory(platform, env, home), "Toolbox");
}
export function installationScanRoots(platform = process.platform, env = process.env, home = homedir()) {
    const { join } = pathsOf(platform);
    if (platform === "darwin") {
        return [{ directory: "/Applications" }, { directory: join(home, "Applications") }];
    }
    if (platform === "win32") {
        const programs = [env["ProgramFiles"] || "C:\\Program Files", env["ProgramFiles(x86)"]];
        return [
            ...programs.filter((it) => Boolean(it)).map((it) => ({ directory: join(it, "JetBrains") })),
            { directory: join(env["LOCALAPPDATA"] || join(home, "AppData", "Local"), "Programs") },
        ];
    }
    return [
        { directory: "/opt" },
        { directory: join(toolboxDirectory(platform, env, home), "apps") },
        { directory: "/snap", child: "current" },
    ];
}
function errorCode(error) {
    const code = error?.code;
    return typeof code === "string" ? code : undefined;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function defaultIsProcessAlive(pid, platform = process.platform) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return errorCode(error) === "EPERM" && platform === "win32";
    }
}
function defaultIsFile(path) {
    try {
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
function defaultIsExecutable(path) {
    try {
        accessSync(path, constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
function defaultRealPath(path, platform = process.platform) {
    const read = platform === "win32" ? realpathSync.native : realpathSync;
    try {
        return read(path);
    }
    catch {
        return path;
    }
}
export function createDefaultIo() {
    return {
        stdout: (message) => process.stdout.write(`${message}\n`),
        stderr: (message) => process.stderr.write(`${message}\n`),
    };
}
export function createDefaultFs() {
    return {
        readDirectory: (path) => readdirSync(path),
        readJson: (path) => JSON.parse(readFileSync(path, "utf8")),
        readText: (path) => readFileSync(path, "utf8"),
        isFile: defaultIsFile,
        isExecutable: defaultIsExecutable,
        isAlive: defaultIsProcessAlive,
        realPath: defaultRealPath,
    };
}
function listDirectory(directory, fs) {
    try {
        return fs.readDirectory(directory);
    }
    catch (error) {
        const code = errorCode(error);
        if (code === "ENOENT" || code === "ENOTDIR") {
            return [];
        }
        throw error;
    }
}
function readJsonOrNull(path, fs) {
    try {
        return fs.readJson(path);
    }
    catch {
        return null;
    }
}
function asObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function asString(value) {
    return typeof value === "string" ? value : null;
}
export function isSettingOn(value) {
    const text = String(value ?? "").trim().toLowerCase();
    return text !== "" && text !== "0" && text !== "false";
}
function comparablePath(path, platform) {
    const { normalize, resolve, sep } = pathsOf(platform);
    const value = normalize(resolve(path)).normalize("NFC");
    const trimmed = value.length > 1 && value.endsWith(sep) ? value.slice(0, -1) : value;
    if (platform === "linux") {
        return trimmed;
    }
    return trimmed.toLowerCase().replace(/^\\\\wsl\$\\/, "\\\\wsl.localhost\\");
}
function pathSpellings(path, platform, fs) {
    const real = fs?.realPath(path);
    const values = typeof real === "string" && real !== path ? [path, real] : [path];
    return [...new Set(values.map((it) => comparablePath(it, platform)))];
}
function isInside(child, parent, platform) {
    const { sep } = pathsOf(platform);
    return child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
}
export function findProductInfo(installDirectory, fs, platform = process.platform) {
    const { join } = pathsOf(platform);
    const candidates = [
        join(installDirectory, "Resources", productInfoFileName),
        join(installDirectory, productInfoFileName),
        join(installDirectory, "bin", productInfoFileName),
    ];
    return candidates.find((it) => fs.isFile(it)) ?? null;
}
function launchOsName(platform) {
    if (platform === "darwin")
        return "macos";
    if (platform === "win32")
        return "windows";
    return "linux";
}
export function resolveLauncher(installDirectory, fs, platform = process.platform) {
    const infoPath = typeof installDirectory === "string" && installDirectory !== ""
        ? findProductInfo(installDirectory, fs, platform)
        : null;
    if (infoPath === null) {
        return null;
    }
    const info = asObject(readJsonOrNull(infoPath, fs));
    const wanted = launchOsName(platform);
    const launches = Array.isArray(info?.["launch"]) ? info["launch"] : [];
    const entry = launches
        .map(asObject)
        .find((it) => String(it?.["os"] ?? "").toLowerCase() === wanted && typeof it?.["launcherPath"] === "string");
    const launcherPath = asString(entry?.["launcherPath"]);
    if (launcherPath === null) {
        return null;
    }
    const { normalize, join, dirname } = pathsOf(platform);
    let launcher = normalize(join(dirname(infoPath), launcherPath));
    if (platform === "win32") {
        const consoleLauncher = launcher.replace(/64\.exe$/i, ".exe");
        if (consoleLauncher !== launcher && fs.isFile(consoleLauncher)) {
            launcher = consoleLauncher;
        }
        return fs.isFile(launcher) ? launcher : null;
    }
    return fs.isFile(launcher) && fs.isExecutable(launcher) ? launcher : null;
}
export function isDevelopmentBuild(candidate, fs, platform = process.platform) {
    return findProductInfo(candidate.installDir, fs, platform) === pathsOf(platform).join(candidate.installDir, "bin", productInfoFileName);
}
export function installationRoot(directory, fs, platform = process.platform) {
    if (typeof directory !== "string" || directory === "") {
        return null;
    }
    const { normalize, join } = pathsOf(platform);
    const root = normalize(directory);
    if (findProductInfo(root, fs, platform)) {
        return root;
    }
    const contents = join(root, "Contents");
    return findProductInfo(contents, fs, platform) ? contents : null;
}
function createCandidate({ installDir, fs, platform, productCode, productName, fullVersion, buildNumber, pluginsDirectories, configDirectory = null, pid = null, openProjectPaths = [], dateTime = 0, }) {
    const code = asString(productCode);
    return {
        installDir,
        launcher: resolveLauncher(installDir, fs, platform),
        productCode: code ?? "?",
        productName: asString(productName) ?? code ?? "?",
        fullVersion: asString(fullVersion) ?? "?",
        buildNumber: asString(buildNumber) ?? "",
        pluginsDirectories,
        configDirectory,
        pid,
        openProjectPaths,
        dateTime,
    };
}
export function describeInstallation(directory, fs, platform = process.platform, env = process.env, home = homedir()) {
    const { join } = pathsOf(platform);
    const installDir = installationRoot(directory, fs, platform);
    const infoPath = installDir === null ? null : findProductInfo(installDir, fs, platform);
    const info = infoPath === null ? null : asObject(readJsonOrNull(infoPath, fs));
    if (installDir === null || info === null) {
        return null;
    }
    const pluginsDirectories = [join(installDir, "plugins")];
    const dataDirectoryName = info["dataDirectoryName"];
    if (typeof dataDirectoryName === "string" && dataDirectoryName !== "") {
        const dataDirectory = join(commonDataDirectory(platform, env, home), dataDirectoryName);
        pluginsDirectories.push(platform === "linux" ? dataDirectory : join(dataDirectory, "plugins"));
    }
    return createCandidate({
        installDir,
        fs,
        platform,
        pluginsDirectories,
        productCode: info["productCode"],
        productName: info["name"],
        fullVersion: info["version"],
        buildNumber: info["buildNumber"],
    });
}
function installationsOnPath(env, platform) {
    const { delimiter, dirname, basename } = pathsOf(platform);
    return (env["PATH"] ?? env["Path"] ?? "")
        .split(delimiter)
        .filter((it) => basename(it) === "bin" || basename(it) === "MacOS")
        .map((it) => dirname(it));
}
export function readInstallations(fs, platform = process.platform, env = process.env, home = homedir()) {
    const { join } = pathsOf(platform);
    const state = asObject(readJsonOrNull(join(toolboxDirectory(platform, env, home), "state.json"), fs));
    const tools = Array.isArray(state?.["tools"]) ? state["tools"] : [];
    const directories = tools.map((it) => asObject(it)?.["installLocation"]);
    for (const { directory, child } of installationScanRoots(platform, env, home)) {
        for (const name of listDirectory(directory, fs)) {
            directories.push(child ? join(directory, name, child) : join(directory, name));
        }
    }
    directories.push(...installationsOnPath(env, platform));
    directories.push(...readRecords(discoveryDirectory(platform, env, home), fs, platform).map((it) => it.paths.installDir));
    return directories
        .map((it) => describeInstallation(it, fs, platform, env, home))
        .filter((it) => it !== null);
}
function isInstanceRecord(value) {
    const record = asObject(value);
    const pid = record?.["pid"];
    const installDirectory = asObject(record?.["paths"])?.["installDir"];
    return Number.isInteger(pid) && pid > 0 && typeof installDirectory === "string" && installDirectory !== "";
}
function readRecords(directory, fs, platform) {
    const { join } = pathsOf(platform);
    return listDirectory(directory, fs)
        .filter((it) => it.endsWith(recordSuffix))
        .sort()
        .map((it) => readJsonOrNull(join(directory, it), fs))
        .filter(isInstanceRecord);
}
export function readInstances(directory, fs, platform = process.platform) {
    return readRecords(directory, fs, platform).filter((it) => fs.isAlive(it.pid));
}
export function candidateFromRecord(record, fs, platform = process.platform) {
    const { join } = pathsOf(platform);
    const info = record.ideInfo ?? {};
    const paths = record.paths;
    const open = record.properties?.openProjectPaths;
    return createCandidate({
        installDir: paths.installDir,
        fs,
        platform,
        productCode: info.productCode,
        productName: info.productName,
        fullVersion: info.fullVersion,
        buildNumber: info.buildNumber,
        pluginsDirectories: [join(paths.installDir, "plugins"), paths.plugins].filter((it) => typeof it === "string"),
        configDirectory: asString(paths.config),
        pid: record.pid,
        openProjectPaths: Array.isArray(open) ? open.filter((it) => typeof it === "string") : [],
        dateTime: Date.parse(String(record.dateTime ?? "")) || 0,
    });
}
export function carriesPlugin(candidate, fs, platform = process.platform) {
    const { join } = pathsOf(platform);
    if (candidate.configDirectory !== null) {
        let disabled = "";
        try {
            disabled = fs.readText(join(candidate.configDirectory, "disabled_plugins.txt"));
        }
        catch {
        }
        if (disabled.split(/\r?\n/).map((it) => it.trim()).includes(pluginId)) {
            return false;
        }
    }
    const marked = (name) => name.toLowerCase().includes(pluginNameMarker);
    const containsJarFiles = (directory, name) => listDirectory(join(directory, name, "lib"), fs)
        .some((it) => marked(it) && it.toLowerCase().endsWith(".jar"));
    return candidate.pluginsDirectories.some((directory) => listDirectory(directory, fs).some((name) => marked(name) || containsJarFiles(directory, name)));
}
const matchRank = { open: 0, parent: 1, none: 2 };
function projectMatch(candidate, projectSpellings, platform, fs) {
    const paths = candidate.openProjectPaths.flatMap((it) => pathSpellings(it, platform, fs));
    if (paths.some((it) => projectSpellings.includes(it))) {
        return { kind: "open" };
    }
    const parents = paths.filter((parent) => projectSpellings.some((spelling) => isInside(spelling, parent, platform)));
    if (parents.length === 0) {
        return { kind: "none" };
    }
    return { kind: "parent", closeness: Math.max(...parents.map((it) => it.length)) };
}
function buildNumberParts(candidate) {
    return candidate.buildNumber.replace(/^[A-Za-z]+-/, "").split(".").map((it) => Number.parseInt(it, 10) || 0);
}
function compareBuildNumbers(a, b) {
    const partsA = buildNumberParts(a);
    const partsB = buildNumberParts(b);
    for (let index = 0; index < Math.max(partsA.length, partsB.length); index++) {
        const difference = (partsA[index] ?? 0) - (partsB[index] ?? 0);
        if (difference !== 0) {
            return difference;
        }
    }
    return 0;
}
export function rankCandidates(side, candidates) {
    const closeness = (match) => match.kind === "parent" ? match.closeness : 0;
    const projectSpellings = pathSpellings(side.project, side.platform, side.fs);
    return candidates
        .map((candidate) => ({
        candidate,
        match: projectMatch(candidate, projectSpellings, side.platform, side.fs),
        running: candidate.pid === null ? 1 : 0,
        product: preferredProductCodes.includes(candidate.productCode) ? 0 : 1,
    }))
        .sort((a, b) => matchRank[a.match.kind] - matchRank[b.match.kind] || a.running - b.running || a.product - b.product ||
        closeness(b.match) - closeness(a.match) ||
        compareBuildNumbers(b.candidate, a.candidate) || b.candidate.dateTime - a.candidate.dateTime);
}
export function collectCandidates(instances, fs, platform = process.platform, env = process.env, home = homedir()) {
    const running = instances.map((it) => candidateFromRecord(it, fs, platform));
    const runningDirs = new Set(running.flatMap((it) => pathSpellings(it.installDir, platform, fs)));
    const installations = [];
    for (const installation of readInstallations(fs, platform, env, home)) {
        const spellings = pathSpellings(installation.installDir, platform, fs);
        if (spellings.some((it) => runningDirs.has(it))) {
            continue;
        }
        spellings.forEach((it) => runningDirs.add(it));
        installations.push(installation);
    }
    return [...running, ...installations];
}
export function selectCandidate(side, candidates, coldStart) {
    for (const { candidate, match } of rankCandidates(side, candidates)) {
        if (match.kind !== "none") {
            if (candidate.launcher === null) {
                return { kind: "no-launcher", candidate, side };
            }
            if (!carriesPlugin(candidate, side.fs, side.platform)) {
                return { kind: "no-plugin", candidate, side };
            }
            return { kind: "found", candidate, side, cold: false };
        }
        const cold = candidate.pid === null;
        if (cold && !coldStart) {
            continue;
        }
        if (candidate.launcher !== null && carriesPlugin(candidate, side.fs, side.platform)) {
            return { kind: "found", candidate, side, cold };
        }
    }
    const instances = candidates.filter((it) => it.pid !== null).length;
    const installations = candidates.length - instances;
    const lines = [];
    lines.push(instances === 0
        ? "No running JetBrains IDE wrote a discovery record."
        : `${instances} running JetBrains IDE(s) wrote a record, but none has this project open.`);
    if (!coldStart) {
        lines.push("IJ_CLI_COLD_START=0 keeps this script from starting an IDE.");
    }
    else {
        lines.push(installations === 0
            ? "No installed JetBrains IDE was found."
            : `${installations} installed JetBrains IDE(s) were found, but none carries the Storybook Connect plugin.`);
    }
    if (side.windows !== null) {
        lines.push("This is WSL, and the Windows side was searched.");
    }
    return { kind: "no-instance", message: lines.join("\n") };
}
export function isWsl(platform, env, fs) {
    if (platform !== "linux") {
        return false;
    }
    if (env["WSL_DISTRO_NAME"]) {
        return true;
    }
    try {
        return /microsoft/i.test(fs.readText("/proc/version"));
    }
    catch {
        return false;
    }
}
const wslSharePattern = /^\\\\(?:wsl\$|wsl\.localhost)\\([^\\]+)(?:\\(.*))?$/i;
const drivePattern = /^([A-Za-z]):(?:[\\/](.*))?$/;
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function windowsToWsl(path, mapping) {
    const drive = drivePattern.exec(path);
    if (drive) {
        const rest = (drive[2] ?? "").replace(/\\/g, "/");
        const local = nodePath.posix.normalize(`${mapping.mountRoot}/${drive[1].toLowerCase()}/${rest}`);
        return local.length > 1 ? local.replace(/\/$/, "") : local;
    }
    const share = wslSharePattern.exec(path);
    const distribution = wslSharePattern.exec(mapping.uncRoot)?.[1] ?? "";
    if (share && share[1].toLowerCase() === distribution.toLowerCase()) {
        return nodePath.posix.normalize("/" + (share[2] ?? "").replace(/\\/g, "/"));
    }
    return null;
}
export function wslToWindows(path, mapping) {
    const normalized = nodePath.posix.normalize(path);
    const mountPrefix = nodePath.posix.join(mapping.mountRoot, "/");
    const mount = new RegExp(`^${escapeRegExp(mountPrefix)}([a-zA-Z])(?:/(.*))?$`).exec(normalized);
    if (mount) {
        return `${mount[1].toUpperCase()}:\\${(mount[2] ?? "").replace(/\//g, "\\")}`;
    }
    return mapping.uncRoot + normalized.replace(/\//g, "\\");
}
export function wslPathToUncPath(path, mapping) {
    return mapping.uncRoot + nodePath.posix.normalize(path).replace(/\//g, "\\");
}
export function parseTaskList(output) {
    const pids = new Set();
    for (const line of output.split(/\r?\n/)) {
        const match = /^"[^"]*","(\d+)"/.exec(line);
        if (match) {
            pids.add(Number(match[1]));
        }
    }
    return pids;
}
export function createWslFs(base, mapping, livePids) {
    const local = (path) => windowsToWsl(path, mapping);
    const read = (path, reader) => {
        const target = local(path);
        if (target === null) {
            throw Object.assign(new Error(`No such file ${path}`), { code: "ENOENT" });
        }
        return reader(target);
    };
    const test = (path, check) => {
        const target = local(path);
        return target !== null && check(target);
    };
    return {
        readDirectory: (path) => read(path, base.readDirectory),
        readJson: (path) => read(path, base.readJson),
        readText: (path) => read(path, base.readText),
        isFile: (path) => test(path, base.isFile),
        isExecutable: (path) => test(path, base.isExecutable),
        isAlive: (pid) => livePids()?.has(pid) ?? true,
        realPath: (path) => {
            const target = local(path);
            return target === null ? path : wslToWindows(base.realPath(target), mapping);
        },
    };
}
function runToText(exec, command, args, cwd) {
    const result = exec(command, args, { cwd, encoding: "utf8" });
    if (result.error || (result.status ?? 1) !== 0 || typeof result.stdout !== "string") {
        return null;
    }
    return result.stdout;
}
const windowsVariables = ["APPDATA", "LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)", "USERPROFILE", "TEMP", "Path"];
export function parseWindowsEnvironment(output) {
    const env = {};
    for (const line of output.split(/\r?\n/)) {
        const separator = line.indexOf("=");
        if (separator <= 0) {
            continue;
        }
        const name = windowsVariables.find((it) => it.toLowerCase() === line.slice(0, separator).toLowerCase());
        if (name !== undefined) {
            env[name] = line.slice(separator + 1).trim();
        }
    }
    return env;
}
export function detectWindowsHost(fs, exec) {
    const uncRoot = runToText(exec, "wslpath", ["-w", "/"])?.trim().replace(/\\$/, "");
    const driveMount = runToText(exec, "wslpath", ["-u", "C:\\"])?.trim().replace(/\/$/, "");
    if (!uncRoot || !driveMount || !wslSharePattern.test(uncRoot)) {
        return null;
    }
    const mapping = { uncRoot, mountRoot: nodePath.posix.dirname(driveMount) };
    const system32 = `${driveMount}/Windows/System32`;
    const windows = (program, args, cwd) => runToText(exec, program, args, cwd) ?? runToText(exec, `${system32}/${program}`, args, cwd);
    const output = windows("cmd.exe", ["/d", "/c", "set"], driveMount);
    if (output === null) {
        return null;
    }
    const env = parseWindowsEnvironment(output);
    const home = env["USERPROFILE"];
    if (!home) {
        return null;
    }
    let pids;
    const livePids = () => {
        if (pids === undefined) {
            const list = windows("tasklist.exe", ["/FO", "CSV", "/NH"]);
            pids = list === null ? null : parseTaskList(list);
        }
        return pids;
    };
    return { env, home, temp: env["TEMP"] ?? null, mapping, fs: createWslFs(fs, mapping, livePids) };
}
export function projectFromArguments(args) {
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === "--") {
            return null;
        }
        if (argument === "--project" && index + 1 < args.length) {
            return args[index + 1];
        }
        if (argument.startsWith("--project=")) {
            return argument.slice("--project=".length);
        }
    }
    return null;
}
export function parseSettings(args, env, cwd) {
    const coldStart = (env["IJ_CLI_COLD_START"] ?? "").trim();
    return {
        project: projectFromArguments(args) || cwd,
        coldStart: coldStart === "" ? true : isSettingOn(coldStart),
        debug: isSettingOn(env["IJ_CLI_DEBUG"]),
    };
}
function describe(candidate) {
    return [
        candidate.pid === null ? "cold start" : `pid ${candidate.pid}`,
        `${candidate.productCode} ${candidate.fullVersion} (${candidate.buildNumber || "?"})`,
        `installDir ${candidate.installDir}`,
        `launcher ${candidate.launcher ?? "none"}`,
    ].join("\n  ");
}
function candidatesOf(side) {
    const instances = readInstances(discoveryDirectory(side.platform, side.env, side.home), side.fs, side.platform);
    return collectCandidates(instances, side.fs, side.platform, side.env, side.home);
}
function windowsSide(host, cwd, project) {
    const { resolve } = nodePath.posix;
    return {
        platform: "win32",
        env: host.env,
        home: host.home,
        fs: host.fs,
        project: wslToWindows(resolve(cwd, project), host.mapping),
        callerDirectory: wslPathToUncPath(resolve(cwd), host.mapping),
        localLauncher: (launcher) => windowsToWsl(launcher, host.mapping) ?? launcher,
        startDirectory: (launcher) => nodePath.posix.dirname(launcher),
        windows: host,
    };
}
export function runCli({ args = process.argv.slice(2), env = process.env, cwd = process.cwd(), platform = process.platform, home = homedir(), fs = createDefaultFs(), io = createDefaultIo(), spawn = spawnSync, exec = spawnSync, } = {}) {
    if (args.length === 0) {
        io.stderr("Usage: node webstorm-cli.mjs <command> [arguments]");
        return 64;
    }
    const settings = parseSettings(args, env, cwd);
    const localSide = {
        platform,
        env,
        home,
        fs,
        project: settings.project,
        callerDirectory: cwd,
        localLauncher: (it) => it,
        startDirectory: () => undefined,
        windows: null,
    };
    let interopNote = null;
    let target;
    try {
        let side = localSide;
        if (isWsl(platform, env, fs)) {
            const host = detectWindowsHost(fs, exec);
            if (host === null) {
                interopNote = "This is WSL, and the Windows side did not answer: wslpath, cmd.exe or tasklist.exe could not run. Turn the WSL interop on, or run the command from a Windows terminal.";
            }
            else {
                side = windowsSide(host, cwd, settings.project);
            }
        }
        target = selectCandidate(side, candidatesOf(side), settings.coldStart);
    }
    catch (error) {
        io.stderr(`Could not read the discovery records or the installations: ${errorMessage(error)}`);
        return scriptFailedExitCode;
    }
    if (target.kind === "no-instance") {
        io.stderr(target.message);
        if (interopNote !== null) {
            io.stderr(interopNote);
        }
        io.stderr(`Start the IDE and open ${settings.project}, then run this again.`);
        io.stderr("If an IDE has it open, name the directory with --project.");
        return noInstanceExitCode;
    }
    const side = target.side;
    if (target.kind === "no-plugin") {
        const { candidate } = target;
        io.stderr(`${candidate.productName} ${candidate.fullVersion} (pid ${candidate.pid}) has ${side.project} open, but it does not carry the Storybook Connect plugin.`);
        io.stderr("Install the plugin in that IDE, then run this again.");
        return noInstanceExitCode;
    }
    if (target.kind === "no-launcher") {
        io.stderr(`A match for ${side.project} has no launcher:`);
        io.stderr(`  ${describe(target.candidate)}`);
        if (isDevelopmentBuild(target.candidate, side.fs, side.platform)) {
            io.stderr("A development build has no launcher. Reach it through its own run command instead.");
            return noLauncherExitCode;
        }
        io.stderr("This installation declares a launcher that is not there. It may be in the middle of an update.");
        return scriptFailedExitCode;
    }
    const { candidate, cold } = target;
    const launcher = side.localLauncher(candidate.launcher);
    if (side.platform === "win32" && /64\.exe$/i.test(launcher)) {
        io.stderr(`warning: ${launcher} is the windowed launcher, which prints nothing to this terminal.`);
        const temp = side.windows?.temp;
        io.stderr(temp
            ? `warning: read the answer from storybook-connect-cli-output.txt in the Windows temporary directory, ${temp}.`
            : "warning: read the answer from storybook-connect-cli-output.txt in the temporary directory.");
    }
    if (settings.debug) {
        io.stderr(`project ${side.project}`);
        io.stderr(`directory ${side.callerDirectory}`);
        if (side.windows) {
            io.stderr(`side Windows, through WSL`);
        }
        io.stderr(`selected:\n  ${describe(candidate)}`);
    }
    if (cold) {
        io.stderr(`No running IDE has ${side.project} open. Starting ${candidate.productName} ${candidate.fullVersion} from ${candidate.installDir}.`);
        io.stderr("A cold start opens the project and builds its indexes first, so the answer can take a minute. IJ_CLI_COLD_START=0 turns this off.");
    }
    const result = spawn(launcher, withCallerDirectory(withCallerType(args, env), side.callerDirectory), { stdio: "inherit", cwd: side.startDirectory(launcher) });
    if (result.error) {
        io.stderr(`Could not run ${launcher}: ${result.error.message}`);
        return scriptFailedExitCode;
    }
    if (result.signal) {
        io.stderr(`${launcher} stopped on signal ${result.signal}.`);
        return scriptFailedExitCode;
    }
    return result.status ?? scriptFailedExitCode;
}
export function isMainModule(moduleUrl = import.meta.url) {
    const currentScript = process.argv[1];
    if (currentScript === undefined) {
        return false;
    }
    const here = fileURLToPath(moduleUrl);
    if (nodePath.resolve(currentScript) === here) {
        return true;
    }
    let realHere;
    try {
        realHere = realpathSync(here);
    }
    catch {
        return true;
    }
    try {
        return realpathSync(currentScript) === realHere;
    }
    catch {
        return false;
    }
}
if (isMainModule()) {
    process.exit(runCli());
}
