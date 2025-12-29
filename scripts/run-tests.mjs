#!/usr/bin/env node

/**
 * Automated Test Runner for frida-mono-bridge
 *
 * Compiles and runs test suites for frida-mono-bridge against a target process.
 * Supports running all tests or specific test categories.
 *
 * Usage:
 *   node scripts/run-tests.mjs [OPTIONS]
 *
 * Options:
 *   -t, --target <process>   Target process name or PID (required for running)
 *   -T, --timeout <seconds> Timeout for each test (default: 60)
 *   -c, --category <name>   Specific test category to run (default: all)
 *   -C, --compile-only      Only compile tests without running them
 *   -v, --verbose           Enable verbose output
 *   -h, --help              Show this help message
 *
 * Examples:
 *   node scripts/run-tests.mjs --target "YourGame.exe"
 *   node scripts/run-tests.mjs --target 1234 --category "mono-class"
 *   node scripts/run-tests.mjs --compile-only
 */

import { spawn } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { basename, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

// Test categories configuration
const testCategories = {
  "core-infrastructure": {
    name: "Core Infrastructure",
    file: "test-core-infrastructure",
    tests: 6,
    priority: 1,
  },
  "mono-api": {
    name: "Mono API",
    file: "test-mono-api",
    tests: 13,
    priority: 2,
  },
  "mono-class": {
    name: "Mono Class",
    file: "test-mono-class",
    tests: 36,
    priority: 3,
  },
  "mono-method": {
    name: "Mono Method",
    file: "test-mono-method",
    tests: 50,
    priority: 4,
  },
  "mono-field": {
    name: "Mono Field",
    file: "test-mono-field",
    tests: 75,
    priority: 5,
  },
  "mono-property": {
    name: "Mono Property",
    file: "test-mono-property",
    tests: 59,
    priority: 6,
  },
  "mono-assembly": {
    name: "Mono Assembly",
    file: "test-mono-assembly",
    tests: 39,
    priority: 100, // Run last
  },
  "mono-image": {
    name: "Mono Image",
    file: "test-mono-image",
    tests: 47,
    priority: 7,
  },
  "mono-domain": {
    name: "Mono Domain",
    file: "test-mono-domain",
    tests: 3,
    priority: 8,
  },
  "mono-threading": {
    name: "Mono Threading",
    file: "test-mono-threading",
    tests: 21,
    priority: 9,
  },
  "mono-module": {
    name: "Mono Module",
    file: "test-mono-module",
    tests: 16,
    priority: 10,
  },
  "mono-data": {
    name: "Mono Data",
    file: "test-mono-data",
    tests: 31,
    priority: 11,
  },
  "mono-utils": {
    name: "Mono Utils",
    file: "test-mono-utils",
    tests: 38,
    priority: 12,
  },
  "mono-error-handling": {
    name: "Mono Error Handling",
    file: "test-mono-error-handling",
    tests: 24,
    priority: 13,
  },
  "runtime-api": {
    name: "Runtime API",
    file: "test-runtime-api",
    tests: 42,
    priority: 14,
  },
  "mono-string": {
    name: "Mono String",
    file: "test-mono-string",
    tests: 71,
    priority: 15,
  },
  "mono-array": {
    name: "Mono Array",
    file: "test-mono-array",
    tests: 67,
    priority: 16,
  },
  "mono-delegate": {
    name: "Mono Delegate",
    file: "test-mono-delegate",
    tests: 53,
    priority: 17,
  },
  "mono-object": {
    name: "Mono Object",
    file: "test-mono-object",
    tests: 12,
    priority: 18,
  },
  "mono-types": {
    name: "Mono Types",
    file: "test-mono-types",
    tests: 60,
    priority: 19,
  },
  "generic-types": {
    name: "Generic Types",
    file: "test-generic-types",
    tests: 30,
    priority: 20,
  },
  "custom-attributes": {
    name: "Custom Attributes",
    file: "test-custom-attributes",
    tests: 9,
    priority: 21,
  },
  "internal-call": {
    name: "Internal Call",
    file: "test-internal-call",
    tests: 63,
    priority: 22,
  },
  "trace-tools": {
    name: "Trace Tools",
    file: "test-trace-tools",
    tests: 46,
    priority: 23,
  },
  "gc-tools": {
    name: "GC Tools",
    file: "test-gc-tools",
    tests: 42,
    priority: 24,
  },
  "data-operations": {
    name: "Data Operations",
    file: "test-data-operations",
    tests: 29,
    priority: 25,
  },
  integration: {
    name: "Integration",
    file: "test-integration",
    tests: 35,
    priority: 26,
  },
  supporting: {
    name: "Supporting",
    file: "test-supporting",
    tests: 31,
    priority: 27,
  },
  "unity-gameobject": {
    name: "Unity GameObject",
    file: "test-unity-gameobject",
    tests: 8,
    priority: 28,
  },
  "unity-components": {
    name: "Unity Components",
    file: "test-unity-components",
    tests: 8,
    priority: 29,
  },
  "unity-engine-modules": {
    name: "Unity Engine Modules",
    file: "test-unity-engine-modules",
    tests: 11,
    priority: 30,
  },
};

// Statistics
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;
const results = [];

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    target: "",
    exe: "",
    timeout: 60,
    category: "",
    retries: 2,
    compileOnly: false,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "-t":
      case "--target":
        options.target = args[++i];
        break;
      case "-e":
      case "--exe":
        options.exe = args[++i];
        break;
      case "-T":
      case "--timeout":
        options.timeout = parseInt(args[++i], 10);
        break;
      case "-c":
      case "--category":
        options.category = args[++i];
        break;
      case "-r":
      case "--retries":
        options.retries = parseInt(args[++i], 10);
        break;
      case "-C":
      case "--compile-only":
        options.compileOnly = true;
        break;
      case "-v":
      case "--verbose":
        options.verbose = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        console.error(`${colors.red}Unknown option: ${arg}${colors.reset}`);
        showHelp();
        process.exit(1);
    }
  }

  return options;
}

function showHelp() {
  console.log(`${colors.cyan}FRIDA-MONO-BRIDGE TEST RUNNER${colors.reset}\n`);
  console.log(`${colors.green}Usage:${colors.reset}`);
  console.log("  node scripts/run-tests.mjs [OPTIONS]\n");
  console.log(`${colors.green}Options:${colors.reset}`);
  console.log("  -t, --target <process>       Target process name or PID (required for running)");
  console.log("                           OR a full path to an executable (Windows recommended)");
  console.log("  -e, --exe <path>             Executable path to launch/restart when --target is a process name");
  console.log("  -T, --timeout <seconds>      Timeout for each test (default: 60)");
  console.log("  -c, --category <name>        Specific test category to run (default: all)");
  console.log("  -r, --retries <count>        Retries on crash/timeout (default: 2)");
  console.log("  -C, --compile-only           Only compile tests without running them");
  console.log("  -v, --verbose                Enable verbose output");
  console.log("  -h, --help                   Show this help message\n");
  console.log(`${colors.green}Available Categories:${colors.reset}`);
  console.log(Object.keys(testCategories).join(", "));
  console.log(`\n${colors.green}Examples:${colors.reset}`);
  console.log('  node scripts/run-tests.mjs --target "YourGame.exe"');
  console.log('  node scripts/run-tests.mjs --target "C:\\Path\\To\\Game.exe"');
  console.log('  node scripts/run-tests.mjs --target 1234 --category "mono-class"');
  console.log("  node scripts/run-tests.mjs --compile-only");
}

function sleep(ms) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms));
}

function normalizeTarget(target) {
  const trimmed = (target ?? "").trim();
  if (trimmed.length === 0) {
    return { kind: "empty" };
  }

  if (/^\d+$/.test(trimmed)) {
    return { kind: "pid", pid: trimmed };
  }

  // If it exists as a path, treat it as an executable path.
  if (existsSync(trimmed)) {
    const absPath = resolve(trimmed);
    return {
      kind: "path",
      path: absPath,
      processName: basename(absPath),
    };
  }

  return { kind: "name", processName: trimmed };
}

async function isProcessRunningWindows(processName) {
  const { stdout } = await execCommand("tasklist", ["/FI", `IMAGENAME eq ${processName}`], { verbose: false });
  return stdout.toLowerCase().includes(processName.toLowerCase());
}

async function getProcessPidsWindows(processName) {
  // CSV output is easiest to parse reliably across locales.
  // Example line:
  // "Duckov.exe","54696","Console","1","123,456 K"
  const { stdout } = await execCommand("tasklist", ["/FI", `IMAGENAME eq ${processName}`, "/FO", "CSV", "/NH"], {
    verbose: false,
  });

  const processes = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.toLowerCase().includes("no tasks")) continue;

    // Split CSV line (simple, tasklist doesn't emit quoted commas other than separating columns)
    const cols = trimmed
      .split(",")
      .map(s => s.trim())
      .map(s => s.replace(/^"|"$/g, ""));

    const image = cols[0];
    const pid = cols[1];
    const mem = cols[4];
    if (!image || !pid) continue;
    if (image.toLowerCase() !== processName.toLowerCase()) continue;
    if (!/^\d+$/.test(pid)) continue;

    // mem is like "123,456 K" (or locale-specific separators). Parse best-effort.
    let memKb = 0;
    if (typeof mem === "string") {
      const normalized = mem.replace(/[^0-9]/g, "");
      if (normalized.length > 0) memKb = Number(normalized);
    }

    processes.push({ pid, memKb });
  }

  return processes;
}

async function resolveAttachTargetInfo(targetInfo, verbose) {
  if (targetInfo.kind === "pid") return targetInfo;
  if (process.platform !== "win32") return targetInfo;

  const processName = targetInfo.kind === "path" || targetInfo.kind === "name" ? targetInfo.processName : null;
  if (!processName) return targetInfo;

  const processes = await getProcessPidsWindows(processName);
  if (processes.length === 0) {
    return targetInfo;
  }

  // Prefer the process with the largest working set (usually the main game),
  // falling back to highest PID.
  processes.sort((a, b) => {
    if (b.memKb !== a.memKb) return b.memKb - a.memKb;
    return Number(b.pid) - Number(a.pid);
  });
  const chosen = processes[0];

  if (verbose && processes.length > 1) {
    writeColorOutput(
      `  [INFO] Multiple '${processName}' processes found; attaching to PID ${chosen.pid} (mem=${chosen.memKb}K)`,
      colors.gray,
    );
  }

  return { kind: "pid", pid: chosen.pid };
}

async function killProcessWindows(processName) {
  // taskkill returns non-zero if process doesn't exist; ignore.
  try {
    await execCommand("taskkill", ["/IM", processName, "/F", "/T"], { verbose: false });
  } catch {
    // ignore
  }
}

function startProcessWindows(exePath) {
  const child = spawn(exePath, [], {
    cwd: dirname(exePath),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: false,
  });
  child.unref();
}

async function ensureTargetRunning(targetInfo, verbose) {
  if (targetInfo.kind !== "path") return false;
  if (process.platform !== "win32") return;

  const isRunning = await isProcessRunningWindows(targetInfo.processName);
  if (isRunning) return false;

  if (verbose) {
    writeColorOutput(`  Target not running; starting: ${targetInfo.path}`, colors.yellow);
  }

  startProcessWindows(targetInfo.path);

  // Wait for process to appear.
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await isProcessRunningWindows(targetInfo.processName)) return true;
    await sleep(500);
  }

  throw new Error(`Target did not start within 30s: ${targetInfo.processName}`);
}

async function stopTargetIfRunning(targetInfo, verbose) {
  if (targetInfo.kind !== "path") return false;
  if (process.platform !== "win32") return;

  const isRunning = await isProcessRunningWindows(targetInfo.processName);
  if (!isRunning) return false;

  if (verbose) {
    writeColorOutput(`  Stopping target: ${targetInfo.processName}`, colors.yellow);
  }

  await killProcessWindows(targetInfo.processName);
  return true;
}

async function restartTarget(targetInfo, verbose) {
  if (targetInfo.kind !== "path") return false;
  if (process.platform !== "win32") return;

  if (verbose) {
    writeColorOutput(`  Restarting target: ${targetInfo.processName}`, colors.yellow);
  }

  await killProcessWindows(targetInfo.processName);
  await sleep(1000);
  startProcessWindows(targetInfo.path);

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await isProcessRunningWindows(targetInfo.processName)) return true;
    await sleep(500);
  }

  throw new Error(`Target did not restart within 30s: ${targetInfo.processName}`);
}

function writeSectionHeader(title) {
  console.log("");
  console.log(`${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}======================================================================${colors.reset}`);
}

function writeColorOutput(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function writeTestResult(status, category, message, duration) {
  const color =
    status === "PASS"
      ? colors.green
      : status === "FAIL"
        ? colors.red
        : status === "SKIP"
          ? colors.yellow
          : colors.reset;
  writeColorOutput(`  [${status}] ${category} - ${message} (${duration}ms)`, color);
}

// Execute command using exec for shell commands, spawn for direct commands
function execCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let child;
    let timedOut = false;

    // For npm commands, use shell mode; otherwise run directly.
    // Always pipe stdout/stderr so we can both capture and optionally echo output.
    const useShell = command.includes("npm") || command.includes("npm.cmd");
    child = spawn(command, args, {
      stdio: "pipe",
      shell: useShell,
    });

    let stdout = "";
    let stderr = "";

    let timeoutId = null;
    if (typeof options.timeoutMs === "number" && options.timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        try {
          child.kill();
        } catch {
          // ignore
        }
      }, options.timeoutMs);
    }

    child.stdout?.on("data", data => {
      const text = data.toString();
      stdout += text;
      if (options.verbose) process.stdout.write(text);
      if (typeof options.onStdoutChunk === "function") {
        options.onStdoutChunk(text, child);
      }
    });

    child.stderr?.on("data", data => {
      const text = data.toString();
      stderr += text;
      if (options.verbose) process.stderr.write(text);
      if (typeof options.onStderrChunk === "function") {
        options.onStderrChunk(text, child);
      }
    });

    child.on("close", code => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      resolve({ code, stdout, stderr, timedOut });
    });

    child.on("error", error => {
      reject(error);
    });
  });
}

async function compileTest(category, config, verbose) {
  const runnerPath = `tests/runners/${config.file}.ts`;
  const outputPath = `dist/${config.file}.js`;

  if (!existsSync(`${process.cwd()}/${runnerPath}`)) {
    writeColorOutput(`  [SKIP] Runner file not found: ${runnerPath}`, colors.yellow);
    return false;
  }

  writeColorOutput(`  Compiling: ${config.name}...`, colors.gray);

  const startTime = Date.now();

  try {
    // Use npm.cmd on Windows, npm on Unix
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const npmScript = `run test:${category}`;

    const { code, stdout, stderr } = await execCommand(npmCmd, [npmScript], {
      verbose: false,
    });
    const duration = Date.now() - startTime;

    if (code === 0) {
      writeColorOutput(`  [OK] Compiled in ${duration}ms`, colors.green);
      return true;
    } else {
      const exitLabel = code === null ? "null" : code;
      writeColorOutput(`  [FAIL] Compilation failed (exit code: ${exitLabel})`, colors.red);
      if (verbose) {
        if (stdout.trim().length > 0) console.log(stdout);
        if (stderr.trim().length > 0) console.error(stderr);
      }
      return false;
    }
  } catch (error) {
    writeColorOutput(`  [ERROR] Exception: ${error.message}`, colors.red);
    return false;
  }
}

function shouldRestartFromOutput(output) {
  const text = (output ?? "").toLowerCase();
  return (
    text.includes("the connection is closed") ||
    text.includes("failed to load script") ||
    text.includes("unable to find process") ||
    text.includes("process not found") ||
    // Frida Windows attach can fail transiently if the wrong process is targeted
    // (e.g., multiple processes with same name) or if the process is restarting.
    text.includes("virtualallocex returned 0x00000005") ||
    text.includes("unexpected error allocating memory in target process")
  );
}

async function runTest(category, config, targetInfo, timeout, verbose) {
  const scriptPath = `dist/${config.file}.js`;

  if (!existsSync(`${process.cwd()}/${scriptPath}`)) {
    writeColorOutput(`  [SKIP] Compiled script not found: ${scriptPath}`, colors.yellow);
    return {
      status: "SKIP",
      message: "Script not found",
      duration: 0,
    };
  }

  writeColorOutput(`  Running: ${config.name}...`, colors.gray);

  const startTime = Date.now();

  try {
    // Build frida arguments
    const fridaArgs = [];

    if (targetInfo.kind === "pid") {
      fridaArgs.push("-p", targetInfo.pid);
    } else {
      fridaArgs.push("-n", targetInfo.processName);
    }

    // Quiet mode exits automatically after -l/-e once the script is done.
    // We rely on our own timeoutMs to avoid hangs.
    fridaArgs.push("-q");
    fridaArgs.push("-l", scriptPath);

    if (verbose) {
      writeColorOutput(`  Command: frida ${fridaArgs.join(" ")}`, colors.gray);
    }

    // Run frida directly (no shell)
    const { stdout, stderr, code, timedOut } = await execCommand("frida", fridaArgs, {
      verbose,
      timeoutMs: timeout * 1000,
    });

    const duration = Date.now() - startTime;

    const combined = `${stdout}${stderr ? `\n${stderr}` : ""}`;

    if (timedOut) {
      writeColorOutput(`  [FAIL] timed out after ${timeout}s`, colors.red);
      if (verbose && combined.trim().length > 0) console.log(combined);
      return {
        status: "FAIL",
        message: `timeout after ${timeout}s`,
        duration,
        output: combined,
        exitCode: code,
        timedOut: true,
        shouldRestart: true,
      };
    }

    if (code !== 0) {
      const exitMessage = code === null ? "frida exited without an exit code" : `frida exited with code ${code}`;
      writeColorOutput(`  [FAIL] ${exitMessage}`, colors.red);
      if (verbose) {
        if (stdout.trim().length > 0) console.log(stdout);
        if (stderr.trim().length > 0) console.error(stderr);
      }
      return {
        status: "FAIL",
        message: exitMessage,
        duration,
        output: combined,
        exitCode: code,
        timedOut: false,
        shouldRestart: shouldRestartFromOutput(combined),
      };
    }

    // Parse output for test results.
    // Supported patterns:
    // - "Result: X/Y" (common)
    // - "=== Suite Name: X/Y passed ===" (some suites)
    const resultMatch =
      combined.match(/Result:\s*(\d+)\/(\d+)/) ?? combined.match(/===\s*[^\n:]+:\s*(\d+)\/(\d+)\s+passed\s*===/);
    let passed = 0;
    let total = config.tests;

    if (resultMatch) {
      passed = parseInt(resultMatch[1], 10);
      total = parseInt(resultMatch[2], 10);
    }

    const failed = Math.max(0, total - passed);

    if (failed === 0 && passed > 0) {
      writeColorOutput(`  [PASS] All tests passed (${passed}/${total}) in ${duration}ms`, colors.green);
      return {
        status: "PASS",
        message: `${passed}/${total} passed`,
        duration,
        output: stdout,
        exitCode: code,
        timedOut: false,
        shouldRestart: false,
        passed,
        failed,
        total,
      };
    } else {
      writeColorOutput(`  [FAIL] ${passed}/${total} passed in ${duration}ms`, colors.red);
      if (verbose) {
        if (stdout.trim().length > 0) console.log(stdout);
        if (stderr.trim().length > 0) console.error(stderr);
      }
      return {
        status: "FAIL",
        message: `${passed}/${total} passed`,
        duration,
        output: combined,
        exitCode: code,
        timedOut: false,
        shouldRestart: shouldRestartFromOutput(combined),
        passed,
        failed,
        total,
      };
    }
  } catch (error) {
    writeColorOutput(`  [ERROR] Exception: ${error.message}`, colors.red);
    return {
      status: "ERROR",
      message: `Exception: ${error.message}`,
      duration: 0,
      shouldRestart: true,
      passed: 0,
      failed: config.tests,
      total: config.tests,
    };
  }
}

async function runTestWithRetries(category, config, targetInfo, launchTargetInfo, timeout, verbose, retries) {
  const maxRetries = Number.isFinite(retries) ? Math.max(0, retries) : 0;
  const maxAttempts = maxRetries + 1;

  const startupGraceSeconds = 120;
  let extraTimeoutSeconds = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const startedNow = await ensureTargetRunning(launchTargetInfo ?? targetInfo, verbose);
      if (startedNow) {
        targetStartedByRunner = true;
        targetJustStartedAt = Date.now();
        extraTimeoutSeconds = Math.max(extraTimeoutSeconds, startupGraceSeconds);
      }
    } catch (e) {
      // Can't ensure the target is running; abort.
      return {
        status: "ERROR",
        message: `Target startup failed: ${e?.message ?? e}`,
        duration: 0,
        shouldRestart: false,
        passed: 0,
        failed: config.tests,
        total: config.tests,
      };
    }

    const effectiveTimeout = timeout + extraTimeoutSeconds;
    if (extraTimeoutSeconds > 0 && verbose) {
      writeColorOutput(
        `  Using startup grace: timeout ${timeout}s + ${extraTimeoutSeconds}s = ${effectiveTimeout}s`,
        colors.gray,
      );
    }

    await waitForTargetWarmupIfNeeded(verbose);

    const attachTargetInfo = await resolveAttachTargetInfo(targetInfo, verbose);
    const result = await runTest(category, config, attachTargetInfo, effectiveTimeout, verbose);
    extraTimeoutSeconds = 0;
    if (result.status === "PASS") return result;

    const canRestart = (launchTargetInfo ?? targetInfo).kind === "path" && process.platform === "win32";
    const shouldRestart = result.shouldRestart === true || result.timedOut === true;

    if (attempt < maxAttempts && canRestart && shouldRestart) {
      writeColorOutput(
        `  [WARN] ${config.name} failed (${result.message}); restarting target and retrying (${attempt}/${maxRetries})`,
        colors.yellow,
      );
      try {
        await restartTarget(launchTargetInfo ?? targetInfo, verbose);
        targetJustStartedAt = Date.now();
        extraTimeoutSeconds = Math.max(extraTimeoutSeconds, startupGraceSeconds);
      } catch (e) {
        return {
          status: "ERROR",
          message: `Restart failed: ${e?.message ?? e}`,
          duration: 0,
          shouldRestart: false,
          passed: 0,
          failed: config.tests,
          total: config.tests,
        };
      }
      continue;
    }

    return result;
  }

  return {
    status: "ERROR",
    message: "Unexpected retry loop exit",
    duration: 0,
    shouldRestart: false,
    passed: 0,
    failed: config.tests,
    total: config.tests,
  };
}

async function invokeTestSuite(category, config, targetInfo, launchTargetInfo, timeout, runTests, verbose, retries) {
  writeSectionHeader(`${config.name} Tests`);

  const startTime = Date.now();

  // Compile test
  const compileSuccess = await compileTest(category, config, verbose);

  if (!compileSuccess) {
    skippedTests += config.tests;
    results.push({
      category,
      name: config.name,
      status: "SKIP",
      message: "Compilation failed",
      duration: 0,
      tests: config.tests,
    });
    return;
  }

  // Skip running if compile-only mode
  if (!runTests) {
    writeColorOutput("  [SKIP] Compile-only mode", colors.yellow);
    skippedTests += config.tests;
    results.push({
      category,
      name: config.name,
      status: "SKIP",
      message: "Compile-only mode",
      duration: 0,
      tests: config.tests,
    });
    return;
  }

  // Run test
  const result = await runTestWithRetries(category, config, targetInfo, launchTargetInfo, timeout, verbose, retries);

  const suiteTotal = Number.isFinite(result.total) ? result.total : config.tests;
  const suitePassed = Number.isFinite(result.passed) ? result.passed : 0;
  const suiteFailed = Number.isFinite(result.failed) ? result.failed : Math.max(0, suiteTotal - suitePassed);

  // Update statistics
  totalTests += suiteTotal;
  passedTests += suitePassed;
  failedTests += suiteFailed;
  if (result.status === "SKIP") skippedTests += suiteTotal;

  // Store result
  results.push({
    category,
    name: config.name,
    status: result.status,
    message: result.message,
    duration: result.duration,
    tests: suiteTotal,
    passed: suitePassed,
    failed: suiteFailed,
    output: result.output,
  });

  console.log("");

  return result;
}

function writeSummary(totalDuration) {
  writeSectionHeader("TEST SUMMARY");

  writeColorOutput(`  Total Tests:     ${totalTests}`, colors.reset);
  writeColorOutput(`  Passed:          ${passedTests}`, colors.green);
  writeColorOutput(`  Failed:          ${failedTests}`, colors.red);
  writeColorOutput(`  Skipped:         ${skippedTests}`, colors.yellow);
  writeColorOutput(`  Total Duration:  ${totalDuration}s`, colors.reset);

  if (failedTests === 0 && passedTests > 0) {
    writeColorOutput("", colors.reset);
    writeColorOutput("  ALL TESTS PASSED!", colors.green);
  } else if (passedTests > 0) {
    writeColorOutput("", colors.reset);
    writeColorOutput("  SOME TESTS FAILED", colors.red);
  } else {
    writeColorOutput("", colors.reset);
    writeColorOutput("  NO TESTS RUN", colors.yellow);
  }
}

function exportResults(outputFile = "test-results.json") {
  const timestamp = new Date().toISOString();

  const data = {
    timestamp,
    totalTests,
    passedTests,
    failedTests,
    skippedTests,
    results: results.map(r => {
      // Persist a small snippet of output on failures to aid debugging without exploding file size.
      const output = typeof r.output === "string" ? r.output : "";
      const maxLen = 20_000;
      const tail = output.length > maxLen ? output.slice(output.length - maxLen) : output;
      return {
        ...r,
        output: r.status === "PASS" ? undefined : tail,
      };
    }),
  };

  writeFileSync(outputFile, JSON.stringify(data, null, 2), "utf-8");

  writeColorOutput("", colors.reset);
  writeColorOutput(`  Results exported to: ${outputFile}`, colors.cyan);
}

// Main execution
const options = parseArgs();

if (options.help) {
  showHelp();
  process.exit(0);
}

const scriptStartTime = Date.now();

writeSectionHeader("FRIDA-MONO-BRIDGE TEST RUNNER");
writeColorOutput(`  Target:         ${options.target}`, colors.reset);
if (options.exe) {
  writeColorOutput(`  Exe:            ${options.exe}`, colors.reset);
}
writeColorOutput(`  Timeout:        ${options.timeout}s`, colors.reset);
writeColorOutput(`  Category:       ${options.category || "All"}`, colors.reset);
writeColorOutput(`  Retries:        ${options.retries}`, colors.reset);
writeColorOutput(`  Compile Only:   ${options.compileOnly}`, colors.reset);
writeColorOutput(`  Verbose:        ${options.verbose}`, colors.reset);

// Validate target if running tests
if (!options.compileOnly && !options.target) {
  writeColorOutput("", colors.reset);
  writeColorOutput("  ERROR: Target process required when running tests", colors.red);
  writeColorOutput("  Use --target <process_name> or --target <PID>", colors.yellow);
  writeColorOutput("  Or use --target <path_to_exe> to enable auto-restart", colors.yellow);
  writeColorOutput("  Or use --compile-only to only compile tests", colors.yellow);
  process.exit(1);
}

const targetInfo = normalizeTarget(options.target);
if (!options.compileOnly && targetInfo.kind === "empty") {
  writeColorOutput("", colors.reset);
  writeColorOutput("  ERROR: Empty target", colors.red);
  process.exit(1);
}

let launchTargetInfo = null;
if (options.exe) {
  const exeInfo = normalizeTarget(options.exe);
  if (exeInfo.kind !== "path") {
    writeColorOutput("", colors.reset);
    writeColorOutput(`  ERROR: --exe must be an existing executable path: ${options.exe}`, colors.red);
    process.exit(1);
  }
  launchTargetInfo = exeInfo;
}

// Track whether the runner actually started the target process during this run.
// If so, we will shut it down after the test run completes.
let targetStartedByRunner = false;

// When we start/restart the target, give it a brief warm-up before attempting to attach.
// This reduces flakiness where the process exists but isn't ready for injection yet.
let targetJustStartedAt = 0;
const targetAttachWarmupMs = 10_000;

async function waitForTargetWarmupIfNeeded(verbose) {
  if (process.platform !== "win32") return;
  if (!Number.isFinite(targetJustStartedAt) || targetJustStartedAt <= 0) return;

  const elapsed = Date.now() - targetJustStartedAt;
  const remaining = targetAttachWarmupMs - elapsed;
  if (remaining <= 0) return;

  if (verbose) {
    writeColorOutput(`  Waiting ${Math.ceil(remaining / 1000)}s for target warm-up...`, colors.gray);
  }

  await sleep(remaining);
}

// Categories that are known to leave the process in a bad state for subsequent categories.
// We restart after these to prevent cascading failures.
const restartAfterCategories = new Set(["mono-module", "mono-data", "mono-error-handling", "mono-assembly"]);

// Determine which tests to run
let categoriesToRun = [];

if (options.category) {
  if (testCategories[options.category]) {
    categoriesToRun = [options.category];
  } else {
    writeColorOutput("", colors.reset);
    writeColorOutput(`  ERROR: Unknown category '${options.category}'`, colors.red);
    writeColorOutput("  Available categories:", colors.yellow);
    Object.keys(testCategories).forEach(cat => {
      writeColorOutput(`    - ${cat}`, colors.reset);
    });
    process.exit(1);
  }
} else {
  // Run all tests sorted by priority
  categoriesToRun = Object.entries(testCategories)
    .sort(([, a], [, b]) => a.priority - b.priority)
    .map(([cat]) => cat);
}

// Preflight: if we can manage the target process (exe path provided or --target is a path),
// ensure it is running before we begin any suites.
try {
  const managedTargetInfo = launchTargetInfo ?? targetInfo;
  const canManageTarget = managedTargetInfo.kind === "path" && process.platform === "win32";
  if (!options.compileOnly && canManageTarget) {
    const startedNow = await ensureTargetRunning(managedTargetInfo, options.verbose);
    if (startedNow) {
      targetStartedByRunner = true;
      targetJustStartedAt = Date.now();
    }
  }
} catch (e) {
  writeColorOutput(`  ERROR: Target startup failed: ${e?.message ?? e}`, colors.red);
  process.exit(1);
}

// Run tests
for (let i = 0; i < categoriesToRun.length; i++) {
  const category = categoriesToRun[i];
  const config = testCategories[category];
  await invokeTestSuite(
    category,
    config,
    targetInfo,
    launchTargetInfo,
    options.timeout,
    !options.compileOnly,
    options.verbose,
    options.retries,
  );

  // If we can manage the target process (exe path provided), restart after risky categories
  // so the next category starts from a clean state.
  const isLast = i === categoriesToRun.length - 1;
  const canManageTarget = (launchTargetInfo ?? targetInfo).kind === "path" && process.platform === "win32";
  if (!isLast && restartAfterCategories.has(category) && canManageTarget) {
    try {
      await restartTarget(launchTargetInfo ?? targetInfo, options.verbose);
      targetJustStartedAt = Date.now();
    } catch (e) {
      writeColorOutput(`  [WARN] Post-category restart failed: ${e?.message ?? e}`, colors.yellow);
    }
  }
}

// Calculate total duration
const totalDuration = Math.floor((Date.now() - scriptStartTime) / 1000);

// Write summary
writeSummary(totalDuration);

// Export results
exportResults();

// If we launched the target during this run, stop it now.
// This keeps the workflow clean when the game was started by the script.
try {
  const managedTargetInfo = launchTargetInfo ?? targetInfo;
  const canManageTarget = managedTargetInfo.kind === "path" && process.platform === "win32";
  const shouldStop = targetStartedByRunner === true;
  if (!options.compileOnly && canManageTarget && shouldStop) {
    await stopTargetIfRunning(managedTargetInfo, options.verbose);
  }
} catch (e) {
  writeColorOutput(`  [WARN] Post-run stop failed: ${e?.message ?? e}`, colors.yellow);
}

// Exit with appropriate code
if (failedTests > 0) {
  process.exit(1);
} else if (passedTests === 0) {
  process.exit(2);
} else {
  process.exit(0);
}
