var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
var init_utils = __esm({
  "node_modules/unenv/dist/runtime/_internal/utils.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    __name(createNotImplementedError, "createNotImplementedError");
    __name(notImplemented, "notImplemented");
    __name(notImplementedClass, "notImplementedClass");
  }
});

// node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin, _performanceNow, nodeTiming, PerformanceEntry, PerformanceMark, PerformanceMeasure, PerformanceResourceTiming, PerformanceObserverEntryList, Performance, PerformanceObserver, performance;
var init_performance = __esm({
  "node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_utils();
    _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
    _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
    nodeTiming = {
      name: "node",
      entryType: "node",
      startTime: 0,
      duration: 0,
      nodeStart: 0,
      v8Start: 0,
      bootstrapComplete: 0,
      environment: 0,
      loopStart: 0,
      loopExit: 0,
      idleTime: 0,
      uvMetricsInfo: {
        loopCount: 0,
        events: 0,
        eventsWaiting: 0
      },
      detail: void 0,
      toJSON() {
        return this;
      }
    };
    PerformanceEntry = class {
      static {
        __name(this, "PerformanceEntry");
      }
      __unenv__ = true;
      detail;
      entryType = "event";
      name;
      startTime;
      constructor(name, options) {
        this.name = name;
        this.startTime = options?.startTime || _performanceNow();
        this.detail = options?.detail;
      }
      get duration() {
        return _performanceNow() - this.startTime;
      }
      toJSON() {
        return {
          name: this.name,
          entryType: this.entryType,
          startTime: this.startTime,
          duration: this.duration,
          detail: this.detail
        };
      }
    };
    PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
      static {
        __name(this, "PerformanceMark");
      }
      entryType = "mark";
      constructor() {
        super(...arguments);
      }
      get duration() {
        return 0;
      }
    };
    PerformanceMeasure = class extends PerformanceEntry {
      static {
        __name(this, "PerformanceMeasure");
      }
      entryType = "measure";
    };
    PerformanceResourceTiming = class extends PerformanceEntry {
      static {
        __name(this, "PerformanceResourceTiming");
      }
      entryType = "resource";
      serverTiming = [];
      connectEnd = 0;
      connectStart = 0;
      decodedBodySize = 0;
      domainLookupEnd = 0;
      domainLookupStart = 0;
      encodedBodySize = 0;
      fetchStart = 0;
      initiatorType = "";
      name = "";
      nextHopProtocol = "";
      redirectEnd = 0;
      redirectStart = 0;
      requestStart = 0;
      responseEnd = 0;
      responseStart = 0;
      secureConnectionStart = 0;
      startTime = 0;
      transferSize = 0;
      workerStart = 0;
      responseStatus = 0;
    };
    PerformanceObserverEntryList = class {
      static {
        __name(this, "PerformanceObserverEntryList");
      }
      __unenv__ = true;
      getEntries() {
        return [];
      }
      getEntriesByName(_name, _type) {
        return [];
      }
      getEntriesByType(type) {
        return [];
      }
    };
    Performance = class {
      static {
        __name(this, "Performance");
      }
      __unenv__ = true;
      timeOrigin = _timeOrigin;
      eventCounts = /* @__PURE__ */ new Map();
      _entries = [];
      _resourceTimingBufferSize = 0;
      navigation = void 0;
      timing = void 0;
      timerify(_fn, _options) {
        throw createNotImplementedError("Performance.timerify");
      }
      get nodeTiming() {
        return nodeTiming;
      }
      eventLoopUtilization() {
        return {};
      }
      markResourceTiming() {
        return new PerformanceResourceTiming("");
      }
      onresourcetimingbufferfull = null;
      now() {
        if (this.timeOrigin === _timeOrigin) {
          return _performanceNow();
        }
        return Date.now() - this.timeOrigin;
      }
      clearMarks(markName) {
        this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
      }
      clearMeasures(measureName) {
        this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
      }
      clearResourceTimings() {
        this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
      }
      getEntries() {
        return this._entries;
      }
      getEntriesByName(name, type) {
        return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
      }
      getEntriesByType(type) {
        return this._entries.filter((e) => e.entryType === type);
      }
      mark(name, options) {
        const entry = new PerformanceMark(name, options);
        this._entries.push(entry);
        return entry;
      }
      measure(measureName, startOrMeasureOptions, endMark) {
        let start;
        let end;
        if (typeof startOrMeasureOptions === "string") {
          start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
          end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
        } else {
          start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
          end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
        }
        const entry = new PerformanceMeasure(measureName, {
          startTime: start,
          detail: {
            start,
            end
          }
        });
        this._entries.push(entry);
        return entry;
      }
      setResourceTimingBufferSize(maxSize) {
        this._resourceTimingBufferSize = maxSize;
      }
      addEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.addEventListener");
      }
      removeEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.removeEventListener");
      }
      dispatchEvent(event) {
        throw createNotImplementedError("Performance.dispatchEvent");
      }
      toJSON() {
        return this;
      }
    };
    PerformanceObserver = class {
      static {
        __name(this, "PerformanceObserver");
      }
      __unenv__ = true;
      static supportedEntryTypes = [];
      _callback = null;
      constructor(callback) {
        this._callback = callback;
      }
      takeRecords() {
        return [];
      }
      disconnect() {
        throw createNotImplementedError("PerformanceObserver.disconnect");
      }
      observe(options) {
        throw createNotImplementedError("PerformanceObserver.observe");
      }
      bind(fn) {
        return fn;
      }
      runInAsyncScope(fn, thisArg, ...args) {
        return fn.call(thisArg, ...args);
      }
      asyncId() {
        return 0;
      }
      triggerAsyncId() {
        return 0;
      }
      emitDestroy() {
        return this;
      }
    };
    performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();
  }
});

// node_modules/unenv/dist/runtime/node/perf_hooks.mjs
var init_perf_hooks = __esm({
  "node_modules/unenv/dist/runtime/node/perf_hooks.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_performance();
  }
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
var init_performance2 = __esm({
  "node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs"() {
    init_perf_hooks();
    globalThis.performance = performance;
    globalThis.Performance = Performance;
    globalThis.PerformanceEntry = PerformanceEntry;
    globalThis.PerformanceMark = PerformanceMark;
    globalThis.PerformanceMeasure = PerformanceMeasure;
    globalThis.PerformanceObserver = PerformanceObserver;
    globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
    globalThis.PerformanceResourceTiming = PerformanceResourceTiming;
  }
});

// node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default;
var init_noop = __esm({
  "node_modules/unenv/dist/runtime/mock/noop.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    noop_default = Object.assign(() => {
    }, { __unenv__: true });
  }
});

// node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";
var _console, _ignoreErrors, _stderr, _stdout, log, info, trace, debug, table, error, warn, createTask, clear, count, countReset, dir, dirxml, group, groupEnd, groupCollapsed, profile, profileEnd, time, timeEnd, timeLog, timeStamp, Console, _times, _stdoutErrorHandler, _stderrErrorHandler;
var init_console = __esm({
  "node_modules/unenv/dist/runtime/node/console.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_noop();
    init_utils();
    _console = globalThis.console;
    _ignoreErrors = true;
    _stderr = new Writable();
    _stdout = new Writable();
    log = _console?.log ?? noop_default;
    info = _console?.info ?? log;
    trace = _console?.trace ?? info;
    debug = _console?.debug ?? log;
    table = _console?.table ?? log;
    error = _console?.error ?? log;
    warn = _console?.warn ?? error;
    createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
    clear = _console?.clear ?? noop_default;
    count = _console?.count ?? noop_default;
    countReset = _console?.countReset ?? noop_default;
    dir = _console?.dir ?? noop_default;
    dirxml = _console?.dirxml ?? noop_default;
    group = _console?.group ?? noop_default;
    groupEnd = _console?.groupEnd ?? noop_default;
    groupCollapsed = _console?.groupCollapsed ?? noop_default;
    profile = _console?.profile ?? noop_default;
    profileEnd = _console?.profileEnd ?? noop_default;
    time = _console?.time ?? noop_default;
    timeEnd = _console?.timeEnd ?? noop_default;
    timeLog = _console?.timeLog ?? noop_default;
    timeStamp = _console?.timeStamp ?? noop_default;
    Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
    _times = /* @__PURE__ */ new Map();
    _stdoutErrorHandler = noop_default;
    _stderrErrorHandler = noop_default;
  }
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole, assert, clear2, context, count2, countReset2, createTask2, debug2, dir2, dirxml2, error2, group2, groupCollapsed2, groupEnd2, info2, log2, profile2, profileEnd2, table2, time2, timeEnd2, timeLog2, timeStamp2, trace2, warn2, console_default;
var init_console2 = __esm({
  "node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_console();
    workerdConsole = globalThis["console"];
    ({
      assert,
      clear: clear2,
      context: (
        // @ts-expect-error undocumented public API
        context
      ),
      count: count2,
      countReset: countReset2,
      createTask: (
        // @ts-expect-error undocumented public API
        createTask2
      ),
      debug: debug2,
      dir: dir2,
      dirxml: dirxml2,
      error: error2,
      group: group2,
      groupCollapsed: groupCollapsed2,
      groupEnd: groupEnd2,
      info: info2,
      log: log2,
      profile: profile2,
      profileEnd: profileEnd2,
      table: table2,
      time: time2,
      timeEnd: timeEnd2,
      timeLog: timeLog2,
      timeStamp: timeStamp2,
      trace: trace2,
      warn: warn2
    } = workerdConsole);
    Object.assign(workerdConsole, {
      Console,
      _ignoreErrors,
      _stderr,
      _stderrErrorHandler,
      _stdout,
      _stdoutErrorHandler,
      _times
    });
    console_default = workerdConsole;
  }
});

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console = __esm({
  "node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console"() {
    init_console2();
    globalThis.console = console_default;
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime;
var init_hrtime = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
      const now = Date.now();
      const seconds = Math.trunc(now / 1e3);
      const nanos = now % 1e3 * 1e6;
      if (startTime) {
        let diffSeconds = seconds - startTime[0];
        let diffNanos = nanos - startTime[0];
        if (diffNanos < 0) {
          diffSeconds = diffSeconds - 1;
          diffNanos = 1e9 + diffNanos;
        }
        return [diffSeconds, diffNanos];
      }
      return [seconds, nanos];
    }, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
      return BigInt(Date.now() * 1e6);
    }, "bigint") });
  }
});

// node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream;
var init_write_stream = __esm({
  "node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    WriteStream = class {
      static {
        __name(this, "WriteStream");
      }
      fd;
      columns = 80;
      rows = 24;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      clearLine(dir3, callback) {
        callback && callback();
        return false;
      }
      clearScreenDown(callback) {
        callback && callback();
        return false;
      }
      cursorTo(x, y, callback) {
        callback && typeof callback === "function" && callback();
        return false;
      }
      moveCursor(dx, dy, callback) {
        callback && callback();
        return false;
      }
      getColorDepth(env2) {
        return 1;
      }
      hasColors(count3, env2) {
        return false;
      }
      getWindowSize() {
        return [this.columns, this.rows];
      }
      write(str, encoding, cb) {
        if (str instanceof Uint8Array) {
          str = new TextDecoder().decode(str);
        }
        try {
          console.log(str);
        } catch {
        }
        cb && typeof cb === "function" && cb();
        return false;
      }
    };
  }
});

// node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream;
var init_read_stream = __esm({
  "node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    ReadStream = class {
      static {
        __name(this, "ReadStream");
      }
      fd;
      isRaw = false;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      setRawMode(mode) {
        this.isRaw = mode;
        return this;
      }
    };
  }
});

// node_modules/unenv/dist/runtime/node/tty.mjs
var init_tty = __esm({
  "node_modules/unenv/dist/runtime/node/tty.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_read_stream();
    init_write_stream();
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION;
var init_node_version = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    NODE_VERSION = "22.14.0";
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";
var Process;
var init_process = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/process.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_tty();
    init_utils();
    init_node_version();
    Process = class _Process extends EventEmitter {
      static {
        __name(this, "Process");
      }
      env;
      hrtime;
      nextTick;
      constructor(impl) {
        super();
        this.env = impl.env;
        this.hrtime = impl.hrtime;
        this.nextTick = impl.nextTick;
        for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
          const value = this[prop];
          if (typeof value === "function") {
            this[prop] = value.bind(this);
          }
        }
      }
      emitWarning(warning, type, code) {
        console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
      }
      emit(...args) {
        return super.emit(...args);
      }
      listeners(eventName) {
        return super.listeners(eventName);
      }
      #stdin;
      #stdout;
      #stderr;
      get stdin() {
        return this.#stdin ??= new ReadStream(0);
      }
      get stdout() {
        return this.#stdout ??= new WriteStream(1);
      }
      get stderr() {
        return this.#stderr ??= new WriteStream(2);
      }
      #cwd = "/";
      chdir(cwd2) {
        this.#cwd = cwd2;
      }
      cwd() {
        return this.#cwd;
      }
      arch = "";
      platform = "";
      argv = [];
      argv0 = "";
      execArgv = [];
      execPath = "";
      title = "";
      pid = 200;
      ppid = 100;
      get version() {
        return `v${NODE_VERSION}`;
      }
      get versions() {
        return { node: NODE_VERSION };
      }
      get allowedNodeEnvironmentFlags() {
        return /* @__PURE__ */ new Set();
      }
      get sourceMapsEnabled() {
        return false;
      }
      get debugPort() {
        return 0;
      }
      get throwDeprecation() {
        return false;
      }
      get traceDeprecation() {
        return false;
      }
      get features() {
        return {};
      }
      get release() {
        return {};
      }
      get connected() {
        return false;
      }
      get config() {
        return {};
      }
      get moduleLoadList() {
        return [];
      }
      constrainedMemory() {
        return 0;
      }
      availableMemory() {
        return 0;
      }
      uptime() {
        return 0;
      }
      resourceUsage() {
        return {};
      }
      ref() {
      }
      unref() {
      }
      umask() {
        throw createNotImplementedError("process.umask");
      }
      getBuiltinModule() {
        return void 0;
      }
      getActiveResourcesInfo() {
        throw createNotImplementedError("process.getActiveResourcesInfo");
      }
      exit() {
        throw createNotImplementedError("process.exit");
      }
      reallyExit() {
        throw createNotImplementedError("process.reallyExit");
      }
      kill() {
        throw createNotImplementedError("process.kill");
      }
      abort() {
        throw createNotImplementedError("process.abort");
      }
      dlopen() {
        throw createNotImplementedError("process.dlopen");
      }
      setSourceMapsEnabled() {
        throw createNotImplementedError("process.setSourceMapsEnabled");
      }
      loadEnvFile() {
        throw createNotImplementedError("process.loadEnvFile");
      }
      disconnect() {
        throw createNotImplementedError("process.disconnect");
      }
      cpuUsage() {
        throw createNotImplementedError("process.cpuUsage");
      }
      setUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
      }
      hasUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
      }
      initgroups() {
        throw createNotImplementedError("process.initgroups");
      }
      openStdin() {
        throw createNotImplementedError("process.openStdin");
      }
      assert() {
        throw createNotImplementedError("process.assert");
      }
      binding() {
        throw createNotImplementedError("process.binding");
      }
      permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
      report = {
        directory: "",
        filename: "",
        signal: "SIGUSR2",
        compact: false,
        reportOnFatalError: false,
        reportOnSignal: false,
        reportOnUncaughtException: false,
        getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
        writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
      };
      finalization = {
        register: /* @__PURE__ */ notImplemented("process.finalization.register"),
        unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
        registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
      };
      memoryUsage = Object.assign(() => ({
        arrayBuffers: 0,
        rss: 0,
        external: 0,
        heapTotal: 0,
        heapUsed: 0
      }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
      mainModule = void 0;
      domain = void 0;
      send = void 0;
      exitCode = void 0;
      channel = void 0;
      getegid = void 0;
      geteuid = void 0;
      getgid = void 0;
      getgroups = void 0;
      getuid = void 0;
      setegid = void 0;
      seteuid = void 0;
      setgid = void 0;
      setgroups = void 0;
      setuid = void 0;
      _events = void 0;
      _eventsCount = void 0;
      _exiting = void 0;
      _maxListeners = void 0;
      _debugEnd = void 0;
      _debugProcess = void 0;
      _fatalException = void 0;
      _getActiveHandles = void 0;
      _getActiveRequests = void 0;
      _kill = void 0;
      _preload_modules = void 0;
      _rawDebug = void 0;
      _startProfilerIdleNotifier = void 0;
      _stopProfilerIdleNotifier = void 0;
      _tickCallback = void 0;
      _disconnect = void 0;
      _handleQueue = void 0;
      _pendingMessage = void 0;
      _channel = void 0;
      _send = void 0;
      _linkedBinding = void 0;
    };
  }
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess, getBuiltinModule, exit, platform, nextTick, unenvProcess, abort, addListener, allowedNodeEnvironmentFlags, hasUncaughtExceptionCaptureCallback, setUncaughtExceptionCaptureCallback, loadEnvFile, sourceMapsEnabled, arch, argv, argv0, chdir, config, connected, constrainedMemory, availableMemory, cpuUsage, cwd, debugPort, dlopen, disconnect, emit, emitWarning, env, eventNames, execArgv, execPath, finalization, features, getActiveResourcesInfo, getMaxListeners, hrtime3, kill, listeners, listenerCount, memoryUsage, on, off, once, pid, ppid, prependListener, prependOnceListener, rawListeners, release, removeAllListeners, removeListener, report, resourceUsage, setMaxListeners, setSourceMapsEnabled, stderr, stdin, stdout, title, throwDeprecation, traceDeprecation, umask, uptime, version, versions, domain, initgroups, moduleLoadList, reallyExit, openStdin, assert2, binding, send, exitCode, channel, getegid, geteuid, getgid, getgroups, getuid, setegid, seteuid, setgid, setgroups, setuid, permission, mainModule, _events, _eventsCount, _exiting, _maxListeners, _debugEnd, _debugProcess, _fatalException, _getActiveHandles, _getActiveRequests, _kill, _preload_modules, _rawDebug, _startProfilerIdleNotifier, _stopProfilerIdleNotifier, _tickCallback, _disconnect, _handleQueue, _pendingMessage, _channel, _send, _linkedBinding, _process, process_default;
var init_process2 = __esm({
  "node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_hrtime();
    init_process();
    globalProcess = globalThis["process"];
    getBuiltinModule = globalProcess.getBuiltinModule;
    ({ exit, platform, nextTick } = getBuiltinModule(
      "node:process"
    ));
    unenvProcess = new Process({
      env: globalProcess.env,
      hrtime,
      nextTick
    });
    ({
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      hasUncaughtExceptionCaptureCallback,
      setUncaughtExceptionCaptureCallback,
      loadEnvFile,
      sourceMapsEnabled,
      arch,
      argv,
      argv0,
      chdir,
      config,
      connected,
      constrainedMemory,
      availableMemory,
      cpuUsage,
      cwd,
      debugPort,
      dlopen,
      disconnect,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      finalization,
      features,
      getActiveResourcesInfo,
      getMaxListeners,
      hrtime: hrtime3,
      kill,
      listeners,
      listenerCount,
      memoryUsage,
      on,
      off,
      once,
      pid,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      setMaxListeners,
      setSourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      title,
      throwDeprecation,
      traceDeprecation,
      umask,
      uptime,
      version,
      versions,
      domain,
      initgroups,
      moduleLoadList,
      reallyExit,
      openStdin,
      assert: assert2,
      binding,
      send,
      exitCode,
      channel,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getuid,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setuid,
      permission,
      mainModule,
      _events,
      _eventsCount,
      _exiting,
      _maxListeners,
      _debugEnd,
      _debugProcess,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _kill,
      _preload_modules,
      _rawDebug,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      _disconnect,
      _handleQueue,
      _pendingMessage,
      _channel,
      _send,
      _linkedBinding
    } = unenvProcess);
    _process = {
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      hasUncaughtExceptionCaptureCallback,
      setUncaughtExceptionCaptureCallback,
      loadEnvFile,
      sourceMapsEnabled,
      arch,
      argv,
      argv0,
      chdir,
      config,
      connected,
      constrainedMemory,
      availableMemory,
      cpuUsage,
      cwd,
      debugPort,
      dlopen,
      disconnect,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      exit,
      finalization,
      features,
      getBuiltinModule,
      getActiveResourcesInfo,
      getMaxListeners,
      hrtime: hrtime3,
      kill,
      listeners,
      listenerCount,
      memoryUsage,
      nextTick,
      on,
      off,
      once,
      pid,
      platform,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      setMaxListeners,
      setSourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      title,
      throwDeprecation,
      traceDeprecation,
      umask,
      uptime,
      version,
      versions,
      // @ts-expect-error old API
      domain,
      initgroups,
      moduleLoadList,
      reallyExit,
      openStdin,
      assert: assert2,
      binding,
      send,
      exitCode,
      channel,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getuid,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setuid,
      permission,
      mainModule,
      _events,
      _eventsCount,
      _exiting,
      _maxListeners,
      _debugEnd,
      _debugProcess,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _kill,
      _preload_modules,
      _rawDebug,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      _disconnect,
      _handleQueue,
      _pendingMessage,
      _channel,
      _send,
      _linkedBinding
    };
    process_default = _process;
  }
});

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process = __esm({
  "node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process"() {
    init_process2();
    globalThis.process = process_default;
  }
});

// src/modules/todo/client.ts
function parsePriority(text) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("urgente") || lowerText.includes("urgent")) {
    return 4;
  } else if (lowerText.includes("muito importante") || lowerText.includes("alta prioridade")) {
    return 3;
  } else if (lowerText.includes("importante") || lowerText.includes("prioridade")) {
    return 2;
  }
  return 1;
}
function parseDueString(text) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("hoje") || lowerText.includes("today")) {
    return "hoje";
  } else if (lowerText.includes("amanh\xE3") || lowerText.includes("tomorrow")) {
    return "amanh\xE3";
  } else if (lowerText.includes("semana que vem") || lowerText.includes("pr\xF3xima semana")) {
    return "pr\xF3xima semana";
  } else if (lowerText.includes("pr\xF3ximo m\xEAs") || lowerText.includes("m\xEAs que vem")) {
    return "pr\xF3ximo m\xEAs";
  }
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (dateMatch) {
    const [_, day, month] = dateMatch;
    return `${day}/${month}`;
  }
  return void 0;
}
var TodoistClient;
var init_client = __esm({
  "src/modules/todo/client.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    TodoistClient = class {
      static {
        __name(this, "TodoistClient");
      }
      apiKey;
      baseUrl = "https://api.todoist.com/rest/v2";
      constructor(apiKey) {
        this.apiKey = apiKey;
      }
      async request(endpoint, method = "GET", body) {
        const url = `${this.baseUrl}/${endpoint}`;
        const headers = {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        };
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : void 0
        });
        if (!response.ok) {
          let error3;
          try {
            error3 = await response.json();
          } catch (e) {
            throw new Error(`Todoist API error: ${response.status} ${response.statusText}`);
          }
          throw new Error(error3.error || `Todoist API error: ${response.status}`);
        }
        if (method === "DELETE") {
          return {};
        }
        return await response.json();
      }
      async createTask(task) {
        return await this.request("tasks", "POST", task);
      }
      async getTasks(filter) {
        const params = new URLSearchParams();
        if (filter) {
          params.append("filter", filter);
        }
        const endpoint = params.toString() ? `tasks?${params.toString()}` : "tasks";
        return await this.request(endpoint);
      }
      async getTask(taskId) {
        return await this.request(`tasks/${taskId}`);
      }
      async updateTask(taskId, updates) {
        return await this.request(`tasks/${taskId}`, "POST", updates);
      }
      async closeTask(taskId) {
        await this.request(`tasks/${taskId}/close`, "POST");
      }
      async reopenTask(taskId) {
        await this.request(`tasks/${taskId}/reopen`, "POST");
      }
      async deleteTask(taskId) {
        await this.request(`tasks/${taskId}`, "DELETE");
      }
      async getProjects() {
        return await this.request("projects");
      }
      async getLabels() {
        return await this.request("labels");
      }
      async testConnection() {
        try {
          await this.getProjects();
          return true;
        } catch (error3) {
          console.error("Todoist connection test failed:", error3);
          return false;
        }
      }
    };
    __name(parsePriority, "parsePriority");
    __name(parseDueString, "parseDueString");
  }
});

// src/modules/todo/taskParser.ts
async function parseTaskFromTranscription(transcription, openaiApiKey) {
  const simpleTask = simpleParseTask(transcription);
  if (openaiApiKey) {
    try {
      return await aiParseTask(transcription, openaiApiKey);
    } catch (error3) {
      console.error("AI parsing failed, falling back to simple parsing:", error3);
      return simpleTask;
    }
  }
  return simpleTask;
}
function simpleParseTask(transcription) {
  const prefixes = ["tarefa", "lembrete", "lembrar de", "preciso", "fazer"];
  let content = transcription;
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}:?\\s*`, "i");
    content = content.replace(regex, "");
  }
  return {
    content: content.trim(),
    due_string: parseDueString(transcription),
    priority: parsePriority(transcription),
    labels: extractLabels(transcription)
  };
}
async function aiParseTask(transcription, openaiApiKey) {
  const prompt = `Extract task information from this transcription. Return a JSON object with:
- content: the main task description (clean and concise)
- due_string: due date in Portuguese if mentioned (hoje, amanh\xE3, pr\xF3xima semana, etc)
- priority: 1-4 (1=normal, 4=urgent)
- labels: array of relevant labels

Transcription: "${transcription}"

Return only valid JSON, no markdown.`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a task parser. Extract task information from transcriptions and return structured JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    })
  });
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  const data = await response.json();
  const content = data.choices[0].message.content;
  try {
    const parsed = JSON.parse(content);
    return {
      content: parsed.content || transcription,
      due_string: parsed.due_string,
      priority: parsed.priority || 1,
      labels: parsed.labels || []
    };
  } catch (error3) {
    console.error("Failed to parse AI response:", content);
    return simpleParseTask(transcription);
  }
}
function extractLabels(text) {
  const labels = [];
  const labelMap = {
    "trabalho": ["trabalho", "job", "office", "escrit\xF3rio"],
    "pessoal": ["pessoal", "personal", "casa", "home"],
    "compras": ["comprar", "compras", "shopping", "mercado"],
    "sa\xFAde": ["m\xE9dico", "dentista", "consulta", "exame", "sa\xFAde"],
    "financeiro": ["pagar", "conta", "boleto", "banco", "dinheiro"]
  };
  const lowerText = text.toLowerCase();
  for (const [label, keywords] of Object.entries(labelMap)) {
    if (keywords.some((keyword) => lowerText.includes(keyword))) {
      labels.push(label);
    }
  }
  return labels;
}
var init_taskParser = __esm({
  "src/modules/todo/taskParser.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_client();
    __name(parseTaskFromTranscription, "parseTaskFromTranscription");
    __name(simpleParseTask, "simpleParseTask");
    __name(aiParseTask, "aiParseTask");
    __name(extractLabels, "extractLabels");
  }
});

// src/modules/classification/types.ts
var init_types = __esm({
  "src/modules/classification/types.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
  }
});

// src/modules/classification/classifier.ts
var TranscriptionClassifier;
var init_classifier = __esm({
  "src/modules/classification/classifier.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    TranscriptionClassifier = class {
      static {
        __name(this, "TranscriptionClassifier");
      }
      openAiApiKey;
      confidenceThreshold;
      constructor(openAiApiKey, confidenceThreshold = 0.8) {
        this.openAiApiKey = openAiApiKey;
        this.confidenceThreshold = confidenceThreshold;
      }
      async classify(context2) {
        try {
          const aiResult = await this.aiClassify(context2.transcription);
          if (aiResult.confidence >= this.confidenceThreshold) {
            return aiResult;
          }
          const keywordResult = this.keywordClassify(context2.transcription);
          return {
            type: aiResult.type,
            confidence: (aiResult.confidence + keywordResult.confidence) / 2,
            reasoning: `AI: ${aiResult.reasoning}, Keywords: ${keywordResult.reasoning}`
          };
        } catch (error3) {
          console.error("AI classification failed, using keyword fallback:", error3);
          return this.keywordClassify(context2.transcription);
        }
      }
      async aiClassify(transcription) {
        const systemPrompt = `You are a classifier that determines the type of a transcription. Options:

1. TASK - General action item to be done
2. NOTE - Information, thought, or observation to remember
3. FUND_ADD - Adding funds/cotas to investment portfolio
4. FUND_REMOVE - Removing/selling funds/cotas from portfolio  
5. FUND_QUOTE - Getting current price/quote of a fund
6. FUND_PORTFOLIO - Portfolio summary or overview request
7. FUND_UPDATE - Updating existing fund positions
8. GITHUB_DISCOVERY - Request for GitHub projects discovery or information

TASK examples:
- "Comprar leite amanh\xE3"
- "Ligar para o dentista"
- "Pagar conta de luz"

NOTE examples:
- "Ideia para o projeto novo"
- "Lembrete que o Jo\xE3o gosta de caf\xE9"

FUND_ADD examples:
- "Adicionar 100 cotas do fundo Bradesco FIA"
- "Comprei 50 cotas do XP A\xE7\xF5es"
- "Investi 1000 reais no fundo Verde"

FUND_REMOVE examples:
- "Vendi 50 cotas do XP A\xE7\xF5es"
- "Remover o fundo Bradesco da carteira"
- "Resgatar 200 cotas do fundo Ita\xFA"

FUND_QUOTE examples:
- "Qual a cota do PETR11?"
- "Pre\xE7o atual do fundo XP A\xE7\xF5es"
- "Cota\xE7\xE3o do Bradesco FIA hoje"

FUND_PORTFOLIO examples:
- "Meu portfolio de fundos"
- "Resumo da carteira"
- "Como est\xE1 minha carteira de investimentos"

FUND_UPDATE examples:
- "Atualizar quantidade do fundo Verde para 150 cotas"
- "Modificar posi\xE7\xE3o no Bradesco FIA"

GITHUB_DISCOVERY examples:
- "Descobrir novos projetos GitHub"
- "Quais projetos interessantes sa\xEDram hoje"
- "Descobertas do GitHub"
- "Projetos novos no GitHub"

Respond with JSON only: {"type": "task"|"note"|"fund_add"|"fund_remove"|"fund_quote"|"fund_portfolio"|"fund_update"|"github_discovery", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.openAiApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Classify this transcription: "${transcription}"` }
            ],
            temperature: 0.3,
            max_tokens: 150,
            response_format: { type: "json_object" }
          })
        });
        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }
        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);
        return {
          type: result.type,
          confidence: result.confidence || 0.5,
          reasoning: result.reasoning || "AI classification"
        };
      }
      keywordClassify(transcription) {
        const lowerText = transcription.toLowerCase();
        const taskKeywords = [
          "fazer",
          "preciso",
          "tenho que",
          "lembrar de",
          "comprar",
          "pagar",
          "ligar",
          "enviar",
          "marcar",
          "agendar",
          "terminar",
          "completar",
          "resolver",
          "consertar",
          "preparar",
          "organizar"
        ];
        const noteKeywords = [
          "ideia",
          "pensei",
          "observei",
          "notei",
          "lembrete sobre",
          "informa\xE7\xE3o",
          "descobri",
          "aprendi",
          "interessante",
          "curioso",
          "reflex\xE3o",
          "insight",
          "dica",
          "sugest\xE3o"
        ];
        let fundAddScore = 0;
        let fundRemoveScore = 0;
        let fundQuoteScore = 0;
        let fundPortfolioScore = 0;
        let fundUpdateScore = 0;
        let githubDiscoveryScore = 0;
        const strongActionVerbs = {
          add: ["adicionar", "comprei", "investi", "aplicar", "aportar"],
          remove: ["vendi", "vender", "remover", "resgatar", "liquidar"],
          update: ["atualizar", "modificar", "alterar", "mudar"],
          quote: ["qual", "pre\xE7o", "cota\xE7\xE3o", "quanto"],
          portfolio: ["portfolio", "carteira", "resumo", "posi\xE7\xF5es"],
          github: ["descobrir", "github", "projetos", "descobertas", "novos projetos", "reposit\xF3rios"]
        };
        Object.entries(strongActionVerbs).forEach(([action, verbs]) => {
          verbs.forEach((verb) => {
            if (lowerText.includes(verb)) {
              switch (action) {
                case "add":
                  fundAddScore += 3;
                  break;
                case "remove":
                  fundRemoveScore += 3;
                  break;
                case "update":
                  fundUpdateScore += 3;
                  break;
                case "quote":
                  fundQuoteScore += 3;
                  break;
                case "portfolio":
                  fundPortfolioScore += 3;
                  break;
                case "github":
                  githubDiscoveryScore += 3;
                  break;
              }
            }
          });
        });
        const supportingKeywords = {
          add: ["cotas do"],
          quote: ["cota", "valor", "hoje"],
          portfolio: ["fundos", "investimentos"]
        };
        Object.entries(supportingKeywords).forEach(([action, keywords]) => {
          keywords.forEach((keyword) => {
            if (lowerText.includes(keyword)) {
              switch (action) {
                case "add":
                  fundAddScore += 1;
                  break;
                case "quote":
                  fundQuoteScore += 1;
                  break;
                case "portfolio":
                  fundPortfolioScore += 1;
                  break;
              }
            }
          });
        });
        const fundNamePattern = /\b(fundo|fia|fii|fidc|etf|bradesco|itau|santander|bb|xp|btg|nubank|inter|petr\d+|vale\d+|itub\d+|bbdc\d+|cotas?)\b/i;
        const isFundRelated = fundNamePattern.test(lowerText);
        if (isFundRelated) {
          if (fundAddScore > 0) fundAddScore += 2;
          if (fundRemoveScore > 0) fundRemoveScore += 2;
          if (fundQuoteScore > 0) fundQuoteScore += 2;
          if (fundPortfolioScore > 0) fundPortfolioScore += 2;
          if (fundUpdateScore > 0) fundUpdateScore += 2;
        }
        if (/\b(atualizar|modificar|alterar|mudar)\b.*\b(fundo|quantidade|posição)\b/i.test(lowerText)) {
          fundUpdateScore += 3;
        }
        if (/\b(qual|preço|cotação|cota|valor)\b.*\b(fundo|\w+\d+)\b/i.test(lowerText)) {
          fundQuoteScore += 2;
        }
        if (/\b(github|projetos?\s+github|descobrir\s+projetos?|novos?\s+projetos?)\b/i.test(lowerText)) {
          githubDiscoveryScore += 2;
        }
        const allScores = {
          fund_add: fundAddScore,
          fund_remove: fundRemoveScore,
          fund_quote: fundQuoteScore,
          fund_portfolio: fundPortfolioScore,
          fund_update: fundUpdateScore,
          github_discovery: githubDiscoveryScore
        };
        const maxScore = Math.max(...Object.values(allScores));
        if (maxScore > 0) {
          const matchedType = Object.keys(allScores).find(
            (key) => allScores[key] === maxScore
          );
          return {
            type: matchedType,
            confidence: Math.min(0.9, maxScore / 3),
            reasoning: `Keywords detected: ${matchedType.replace(/^(fund_|github_)/, "")}`
          };
        }
        let taskScore = 0;
        let noteScore = 0;
        taskKeywords.forEach((keyword) => {
          if (lowerText.includes(keyword)) taskScore++;
        });
        noteKeywords.forEach((keyword) => {
          if (lowerText.includes(keyword)) noteScore++;
        });
        const futureTimeRegex = /\b(amanhã|depois|próxim[oa]|semana que vem|mês que vem|hoje|mais tarde)\b/;
        if (futureTimeRegex.test(lowerText)) {
          taskScore += 2;
        }
        const actionVerbRegex = /^(preciso|tenho que|vou|devo|posso)/;
        if (actionVerbRegex.test(lowerText)) {
          taskScore += 2;
        }
        const totalScore = taskScore + noteScore || 1;
        const taskProbability = taskScore / totalScore;
        return {
          type: taskProbability > 0.5 ? "task" : "note",
          confidence: Math.abs(taskProbability - 0.5) * 2,
          reasoning: `Task keywords: ${taskScore}, Note keywords: ${noteScore}`
        };
      }
      isHighConfidence(result) {
        return result.confidence >= this.confidenceThreshold;
      }
    };
  }
});

// src/modules/classification/index.ts
var init_classification = __esm({
  "src/modules/classification/index.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_types();
    init_classifier();
  }
});

// src/utils/config.ts
var Config;
var init_config = __esm({
  "src/utils/config.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    Config = class {
      static {
        __name(this, "Config");
      }
      static isClassificationEnabled(env2) {
        return env2.CLASSIFICATION_ENABLED !== "false";
      }
      static getClassificationThreshold(env2) {
        const threshold = parseFloat(env2.CLASSIFICATION_CONFIDENCE_THRESHOLD || "0.8");
        return isNaN(threshold) ? 0.8 : Math.max(0, Math.min(1, threshold));
      }
      static hasObsidianConfig(env2) {
        return !!(env2.OBSIDIAN_STORAGE_TYPE && this.getStorageConfig(env2));
      }
      static getObsidianConfig(env2) {
        if (!env2.OBSIDIAN_STORAGE_TYPE) {
          return null;
        }
        return {
          storageType: env2.OBSIDIAN_STORAGE_TYPE,
          dailyNote: env2.OBSIDIAN_NOTE_FORMAT !== "individual",
          noteFormat: env2.OBSIDIAN_NOTE_FORMAT || "daily",
          notePath: env2.OBSIDIAN_NOTE_PATH
        };
      }
      static getGitHubConfig(env2) {
        if (env2.OBSIDIAN_STORAGE_TYPE !== "github") {
          return null;
        }
        console.log("GitHub config check in getGitHubConfig:", {
          hasToken: !!env2.GITHUB_TOKEN,
          tokenLength: env2.GITHUB_TOKEN?.length,
          owner: env2.GITHUB_OWNER,
          repo: env2.GITHUB_REPO,
          vaultPath: env2.OBSIDIAN_VAULT_PATH
        });
        if (!env2.GITHUB_TOKEN || !env2.GITHUB_OWNER || !env2.GITHUB_REPO || !env2.OBSIDIAN_VAULT_PATH) {
          console.error("Missing required GitHub configuration:", {
            hasToken: !!env2.GITHUB_TOKEN,
            hasOwner: !!env2.GITHUB_OWNER,
            hasRepo: !!env2.GITHUB_REPO,
            hasVaultPath: !!env2.OBSIDIAN_VAULT_PATH
          });
          return null;
        }
        return {
          token: env2.GITHUB_TOKEN,
          owner: env2.GITHUB_OWNER,
          repo: env2.GITHUB_REPO,
          branch: env2.GITHUB_BRANCH || "main",
          vaultPath: env2.OBSIDIAN_VAULT_PATH
        };
      }
      static getStorageConfig(env2) {
        switch (env2.OBSIDIAN_STORAGE_TYPE) {
          case "github":
            return this.getGitHubConfig(env2);
          default:
            return null;
        }
      }
    };
  }
});

// src/modules/voice-sync/api.ts
var VoiceNoteSyncAPI;
var init_api = __esm({
  "src/modules/voice-sync/api.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    VoiceNoteSyncAPI = class {
      static {
        __name(this, "VoiceNoteSyncAPI");
      }
      env;
      constructor(env2) {
        this.env = env2;
      }
      /**
       * GET /api/voice-notes/unprocessed
       * Returns all unprocessed voice notes for Obsidian sync
       */
      async getUnprocessedNotes(request) {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!this.isValidApiKey(authHeader)) {
            return new Response("Unauthorized", {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }
          const notes = await this.fetchUnprocessedNotesFromKV();
          return new Response(JSON.stringify(notes), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Headers": "authorization, content-type, Authorization, Content-Type"
            }
          });
        } catch (error3) {
          console.error("Error fetching unprocessed notes:", error3);
          return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      /**
       * POST /api/voice-notes/{id}/processed
       * Mark a voice note as processed
       */
      async markNoteAsProcessed(request, noteId) {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!this.isValidApiKey(authHeader)) {
            return new Response("Unauthorized", {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }
          await this.markNoteProcessedInKV(noteId);
          return new Response(JSON.stringify({ success: true }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Headers": "authorization, content-type, Authorization, Content-Type"
            }
          });
        } catch (error3) {
          console.error("Error marking note as processed:", error3);
          return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      /**
       * OPTIONS handler for CORS
       */
      async handleOptions() {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "authorization, content-type, Authorization, Content-Type",
            "Access-Control-Max-Age": "86400"
          }
        });
      }
      isValidApiKey(authHeader) {
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return false;
        }
        const apiKey = authHeader.substring(7);
        const validApiKey = this.env.OBSIDIAN_API_KEY || this.env.API_KEY;
        return apiKey === validApiKey;
      }
      async fetchUnprocessedNotesFromKV() {
        if (!this.env.USER_CONFIGS) {
          throw new Error("KV storage not configured");
        }
        const notes = [];
        const list = await this.env.USER_CONFIGS.list({ prefix: "voice_note:" });
        for (const key of list.keys) {
          try {
            const noteData = await this.env.USER_CONFIGS.get(key.name, "json");
            if (noteData && !noteData.processed) {
              notes.push({
                id: key.name.replace("voice_note:", ""),
                transcription: noteData.transcription,
                timestamp: noteData.timestamp,
                phone: noteData.phone,
                processed: false,
                metadata: noteData.metadata
              });
            }
          } catch (error3) {
            console.error(`Error reading note ${key.name}:`, error3);
          }
        }
        notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return notes;
      }
      async markNoteProcessedInKV(noteId) {
        if (!this.env.USER_CONFIGS) {
          throw new Error("KV storage not configured");
        }
        const key = `voice_note:${noteId}`;
        const noteData = await this.env.USER_CONFIGS.get(key, "json");
        if (noteData) {
          noteData.processed = true;
          noteData.processedAt = (/* @__PURE__ */ new Date()).toISOString();
          await this.env.USER_CONFIGS.put(key, JSON.stringify(noteData));
        }
      }
    };
  }
});

// src/modules/voice-sync/storage.ts
var EnhancedKVNoteStorage;
var init_storage = __esm({
  "src/modules/voice-sync/storage.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    EnhancedKVNoteStorage = class {
      static {
        __name(this, "EnhancedKVNoteStorage");
      }
      kv;
      constructor(kv) {
        this.kv = kv;
      }
      async saveNote(transcription, userPhone, metadata) {
        const noteId = this.generateNoteId();
        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
        const noteData = {
          id: noteId,
          transcription,
          phone: userPhone,
          timestamp,
          processed: false,
          metadata: metadata || {}
        };
        const key = `voice_note:${noteId}`;
        await this.kv.put(key, JSON.stringify(noteData));
        console.log("Voice note saved for sync:", {
          noteId,
          userPhone,
          contentLength: transcription.length
        });
        return noteId;
      }
      async getNoteById(noteId) {
        const key = `voice_note:${noteId}`;
        return await this.kv.get(key, "json");
      }
      async markNoteAsProcessed(noteId) {
        const key = `voice_note:${noteId}`;
        const noteData = await this.kv.get(key, "json");
        if (noteData) {
          noteData.processed = true;
          noteData.processedAt = (/* @__PURE__ */ new Date()).toISOString();
          await this.kv.put(key, JSON.stringify(noteData));
        }
      }
      generateNoteId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      }
    };
  }
});

// src/modules/voice-sync/index.ts
var voice_sync_exports = {};
__export(voice_sync_exports, {
  EnhancedKVNoteStorage: () => EnhancedKVNoteStorage,
  VoiceNoteSyncAPI: () => VoiceNoteSyncAPI
});
var init_voice_sync = __esm({
  "src/modules/voice-sync/index.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_api();
    init_storage();
  }
});

// src/modules/audio/processor.ts
async function processAudioMessage(payload, context2) {
  const userPhone = payload.from || payload.phone || payload.senderNumber;
  try {
    if (!payload.audio) {
      throw new Error("No audio data in payload");
    }
    let audioBuffer;
    if (payload.audio.audioUrl) {
      const audioResponse = await fetch(payload.audio.audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`);
      }
      audioBuffer = await audioResponse.arrayBuffer();
    } else if (payload.audio.data) {
      const base64Data = payload.audio.data;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      audioBuffer = bytes.buffer;
    } else {
      throw new Error("No audio URL or data found in payload");
    }
    console.log("Audio info:", {
      originalMimeType: payload.audio.mimeType || payload.audio.mimetype,
      bufferSize: audioBuffer.byteLength,
      bufferSizeMB: (audioBuffer.byteLength / 1024 / 1024).toFixed(2),
      duration: payload.audio.seconds || payload.audio.duration
    });
    const audioMimeType = payload.audio.mimeType || payload.audio.mimetype || "audio/ogg";
    const audioBlob = new Blob([audioBuffer], { type: audioMimeType });
    console.log("Sending to Whisper:", {
      blobSize: audioBlob.size,
      blobType: audioBlob.type
    });
    const transcription = await transcribeAudio(audioBlob, context2.env);
    if (!transcription || transcription.trim().length === 0) {
      await sendMessage(
        context2,
        userPhone,
        "\u274C N\xE3o consegui transcrever o \xE1udio. Por favor, tente falar mais claramente."
      );
      return;
    }
    await classifyAndProcess(transcription, payload, context2, userPhone);
  } catch (error3) {
    console.error("Audio processing error:", error3);
    let errorMessage = "\u274C Erro ao processar o \xE1udio.";
    if (error3.message?.includes("API key not configured")) {
      errorMessage = "\u274C Bot n\xE3o est\xE1 configurado corretamente. Por favor, configure a chave da API OpenAI.";
    } else if (error3.message?.includes("Invalid OpenAI API key")) {
      errorMessage = "\u274C Chave da API OpenAI inv\xE1lida. Por favor, verifique a configura\xE7\xE3o.";
    } else if (error3.message?.includes("timeout")) {
      errorMessage = "\u274C O processamento do \xE1udio demorou muito. Por favor, tente com um \xE1udio mais curto.";
    } else if (error3.message?.includes("Failed to download audio")) {
      errorMessage = "\u274C Erro ao baixar o \xE1udio. Por favor, tente novamente.";
    }
    await sendMessage(context2, userPhone, errorMessage);
    throw error3;
  }
}
async function transcribeAudio(audioBlob, env2) {
  if (!env2.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    throw new Error("OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.");
  }
  const formData = new FormData();
  const mimeToExt = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/webm": "webm"
  };
  const fileExt = mimeToExt[audioBlob.type] || "mp3";
  const fileName = `audio.${fileExt}`;
  console.log("Whisper request:", {
    fileName,
    fileSize: audioBlob.size,
    mimeType: audioBlob.type,
    hasApiKey: !!env2.OPENAI_API_KEY
  });
  formData.append("file", audioBlob, fileName);
  formData.append("model", "whisper-1");
  formData.append("language", "pt");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3e4);
    let response;
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env2.OPENAI_API_KEY}`
        },
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (error3) {
      clearTimeout(timeoutId);
      if (error3.name === "AbortError") {
        throw new Error("Transcription timeout after 30 seconds");
      }
      throw error3;
    }
    if (!response.ok) {
      const error3 = await response.text();
      console.error("Whisper API error:", {
        status: response.status,
        error: error3,
        hasApiKey: !!env2.OPENAI_API_KEY,
        apiKeyLength: env2.OPENAI_API_KEY?.length
      });
      if (response.status === 401) {
        throw new Error("Invalid OpenAI API key. Please check your OPENAI_API_KEY configuration.");
      }
      throw new Error(`OpenAI API error (${response.status}): ${error3}`);
    }
    const result = await response.json();
    console.log("Transcription result:", {
      text: result.text,
      length: result.text.length
    });
    return result.text;
  } catch (error3) {
    console.error("Transcription error:", error3);
    throw error3;
  }
}
async function classifyAndProcess(transcription, payload, context2, userPhone) {
  let classification = null;
  if (Config.isClassificationEnabled(context2.env)) {
    const classifier = new TranscriptionClassifier(
      context2.env.OPENAI_API_KEY,
      Config.getClassificationThreshold(context2.env)
    );
    try {
      classification = await classifier.classify({
        transcription,
        userId: userPhone,
        timestamp: /* @__PURE__ */ new Date()
      });
      const getClassificationDisplay = /* @__PURE__ */ __name((type) => {
        switch (type) {
          case "task":
            return { emoji: "\u{1F4CB}", text: "Tarefa" };
          case "note":
            return { emoji: "\u{1F4DD}", text: "Nota" };
          case "fund_add":
            return { emoji: "\u{1F4C8}", text: "Adicionar Fundo" };
          case "fund_remove":
            return { emoji: "\u{1F4C9}", text: "Remover Fundo" };
          case "fund_quote":
            return { emoji: "\u{1F4B0}", text: "Cota\xE7\xE3o de Fundo" };
          case "fund_portfolio":
            return { emoji: "\u{1F4CA}", text: "Portfolio de Fundos" };
          case "fund_update":
            return { emoji: "\u{1F504}", text: "Atualizar Fundo" };
          default:
            return { emoji: "\u{1F4CB}", text: "Tarefa" };
        }
      }, "getClassificationDisplay");
      const { emoji: classificationEmoji, text: classificationText } = getClassificationDisplay(classification.type);
      const confidenceText = classification.confidence >= 0.8 ? "\u2705" : "\u26A0\uFE0F";
      console.log("Classification result:", {
        type: classification.type,
        confidence: classification.confidence,
        reasoning: classification.reasoning
      });
      await sendMessage(
        context2,
        userPhone,
        `${classificationEmoji} Transcri\xE7\xE3o: "${transcription}"

${confidenceText} Classificado como: ${classificationText} (${Math.round(classification.confidence * 100)}% de confian\xE7a)`
      );
      if (classification.confidence < Config.getClassificationThreshold(context2.env)) {
        await sendMessage(
          context2,
          userPhone,
          "\u26A0\uFE0F Confian\xE7a baixa na classifica\xE7\xE3o. Processando como " + classificationText
        );
      }
    } catch (error3) {
      console.error("Classification failed:", error3);
      classification = { type: "task", confidence: 0.5, reasoning: "Classification failed, defaulting to task" };
    }
  } else {
    classification = { type: "task", confidence: 1, reasoning: "Classification disabled" };
  }
  if (classification.type === "note") {
    await processAsNote(transcription, payload, context2, userPhone);
  } else if (classification.type.startsWith("fund_")) {
    await processAsFund(classification.type, transcription, payload, context2, userPhone);
  } else {
    await processAsTask(transcription, payload, context2, userPhone);
  }
}
async function processAsNote(transcription, payload, context2, userPhone) {
  try {
    await sendMessage(
      context2,
      userPhone,
      "\u{1F4DD} Salvando nota para sincroniza\xE7\xE3o com Obsidian..."
    );
    const { EnhancedKVNoteStorage: EnhancedKVNoteStorage2 } = await Promise.resolve().then(() => (init_voice_sync(), voice_sync_exports));
    const kvStorage = new EnhancedKVNoteStorage2(context2.env.USER_CONFIGS);
    const noteId = await kvStorage.saveNote(transcription, userPhone, {
      audioUrl: payload.audio?.audioUrl,
      duration: payload.audio?.seconds || payload.audio?.duration,
      classification: "note"
    });
    console.log("Note saved to KV:", {
      noteId,
      userId: userPhone,
      contentLength: transcription.length
    });
    await sendMessage(
      context2,
      userPhone,
      `\u2705 Nota salva para sincroniza\xE7\xE3o!

\u{1F4DD} "${transcription.substring(0, 100)}${transcription.length > 100 ? "..." : ""}"

\u{1F4A1} A nota ser\xE1 sincronizada automaticamente com seu Obsidian.`
    );
  } catch (error3) {
    console.error("Error saving note to KV:", error3);
    await sendMessage(
      context2,
      userPhone,
      "\u274C Erro ao salvar nota. Criando tarefa no Todoist como fallback..."
    );
    await processAsTask(`[NOTA] ${transcription}`, payload, context2, userPhone);
  }
}
async function processAsTask(transcription, payload, context2, userPhone) {
  await sendMessage(
    context2,
    userPhone,
    "\u2728 Criando tarefa no Todoist..."
  );
  if (!context2.todoistToken) {
    await sendMessage(
      context2,
      userPhone,
      "\u274C Token do Todoist n\xE3o configurado. Adicione TODOIST_API_TOKEN nas vari\xE1veis de ambiente."
    );
    return;
  }
  try {
    const parsedTask = await parseTaskFromTranscription(
      transcription,
      context2.env.OPENAI_API_KEY
    );
    const todoistClient = new TodoistClient(context2.todoistToken);
    const createdTask = await todoistClient.createTask({
      content: parsedTask.content,
      due_string: parsedTask.due_string,
      priority: parsedTask.priority,
      labels: parsedTask.labels
    });
    let taskMessage = `\u2705 Tarefa criada no Todoist!

\u{1F4CC} "${createdTask.content}"`;
    if (createdTask.due) {
      taskMessage += `
\u{1F4C5} Prazo: ${createdTask.due.string}`;
    }
    if (parsedTask.priority && parsedTask.priority > 1) {
      const priorityEmojis = ["", "", "\u26A1", "\u{1F525}", "\u{1F6A8}"];
      taskMessage += `
${priorityEmojis[parsedTask.priority]} Prioridade: ${parsedTask.priority === 4 ? "Urgente" : parsedTask.priority === 3 ? "Alta" : "M\xE9dia"}`;
    }
    if (parsedTask.labels && parsedTask.labels.length > 0) {
      taskMessage += `
\u{1F3F7}\uFE0F Etiquetas: ${parsedTask.labels.join(", ")}`;
    }
    await sendMessage(context2, userPhone, taskMessage);
  } catch (error3) {
    console.error("Error creating Todoist task:", error3);
    await sendMessage(
      context2,
      userPhone,
      "\u274C Erro ao criar tarefa no Todoist. Verifique se o token est\xE1 correto."
    );
  }
}
async function processAsFund(fundType, transcription, payload, context2, userPhone) {
  try {
    const { AudioProcessor: AudioProcessor2 } = await Promise.resolve().then(() => (init_AudioProcessor(), AudioProcessor_exports));
    const audioProcessor = new AudioProcessor2(context2.env);
    await audioProcessor.processFundCommand(transcription, fundType, payload);
  } catch (error3) {
    console.error("Error processing fund command:", error3);
    await sendMessage(
      context2,
      userPhone,
      "\u274C Erro ao processar comando de fundo. Criando tarefa como fallback..."
    );
    let taskContent = "";
    switch (fundType) {
      case "fund_add":
        taskContent = `[FUNDO-ADICIONAR] ${transcription}`;
        break;
      case "fund_remove":
        taskContent = `[FUNDO-REMOVER] ${transcription}`;
        break;
      case "fund_quote":
        taskContent = `[FUNDO-COTACAO] ${transcription}`;
        break;
      case "fund_portfolio":
        taskContent = `[FUNDO-PORTFOLIO] ${transcription}`;
        break;
      case "fund_update":
        taskContent = `[FUNDO-ATUALIZAR] ${transcription}`;
        break;
      default:
        taskContent = `[FUNDO] ${transcription}`;
    }
    await processAsTask(taskContent, payload, context2, userPhone);
  }
}
async function sendMessage(context2, to, message) {
  try {
    if (!context2.env.Z_API_INSTANCE_ID || !context2.env.Z_API_INSTANCE_TOKEN || !context2.env.Z_API_SECURITY_TOKEN) {
      console.error("Z-API credentials not configured");
      return;
    }
    const url = `https://api.z-api.io/instances/${context2.env.Z_API_INSTANCE_ID}/token/${context2.env.Z_API_INSTANCE_TOKEN}/send-text`;
    const body = {
      phone: to,
      message
    };
    console.log("Sending Z-API message:", {
      url,
      to,
      messageLength: message.length,
      hasClientToken: !!context2.env.Z_API_SECURITY_TOKEN
    });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": context2.env.Z_API_SECURITY_TOKEN
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Z-API error response:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Z-API error: ${response.status} - ${errorText}`);
    }
    console.log("Z-API message sent successfully");
  } catch (error3) {
    console.error("Error sending message via Z-API:", error3);
  }
}
var init_processor = __esm({
  "src/modules/audio/processor.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_client();
    init_taskParser();
    init_classification();
    init_config();
    __name(processAudioMessage, "processAudioMessage");
    __name(transcribeAudio, "transcribeAudio");
    __name(classifyAndProcess, "classifyAndProcess");
    __name(processAsNote, "processAsNote");
    __name(processAsTask, "processAsTask");
    __name(processAsFund, "processAsFund");
    __name(sendMessage, "sendMessage");
  }
});

// src/modules/fund-tracker/storage.ts
var KVFundStorage;
var init_storage2 = __esm({
  "src/modules/fund-tracker/storage.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    KVFundStorage = class {
      static {
        __name(this, "KVFundStorage");
      }
      kv;
      constructor(kv) {
        this.kv = kv;
      }
      async saveFundPortfolio(userId, portfolio) {
        if (!userId) {
          throw new Error("User ID is required");
        }
        const portfolioKey = this.getPortfolioKey(userId);
        const portfolioWithTimestamp = {
          ...portfolio,
          userId,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
        await this.kv.put(portfolioKey, JSON.stringify(portfolioWithTimestamp));
        await this.updateUserIndex(userId);
      }
      async getFundPortfolio(userId) {
        if (!userId) {
          throw new Error("User ID is required");
        }
        const portfolioKey = this.getPortfolioKey(userId);
        const portfolioData = await this.kv.get(portfolioKey);
        if (!portfolioData) {
          return this.createEmptyPortfolio(userId);
        }
        try {
          const portfolio = JSON.parse(portfolioData);
          return this.validateAndFixPortfolio(portfolio, userId);
        } catch (error3) {
          console.error("Error parsing portfolio data:", error3);
          return this.createEmptyPortfolio(userId);
        }
      }
      async addFundPosition(userId, position) {
        if (!userId || !position) {
          throw new Error("User ID and position are required");
        }
        const normalizedPosition = this.normalizePosition(position);
        if (!normalizedPosition.cnpj || !normalizedPosition.name || (normalizedPosition.quotas || 0) <= 0) {
          throw new Error("Invalid position data");
        }
        const portfolio = await this.getFundPortfolio(userId);
        const existingIndex = portfolio.positions.findIndex((p) => p.cnpj === normalizedPosition.cnpj);
        if (existingIndex >= 0) {
          const existing = this.normalizePosition(portfolio.positions[existingIndex]);
          const totalQuotas = (existing.quotas || 0) + (normalizedPosition.quotas || 0);
          const totalInvested = (existing.investedAmount || 0) + (normalizedPosition.investedAmount || 0);
          const newAvgPrice = totalInvested / totalQuotas;
          portfolio.positions[existingIndex] = {
            ...existing,
            quotas: totalQuotas,
            investedAmount: totalInvested,
            avgPrice: newAvgPrice
          };
        } else {
          const newPosition = {
            ...normalizedPosition,
            id: normalizedPosition.id || this.generatePositionId(normalizedPosition.cnpj),
            avgPrice: (normalizedPosition.investedAmount || 0) / (normalizedPosition.quotas || 1)
          };
          portfolio.positions.push(newPosition);
        }
        this.recalculatePortfolio(portfolio);
        await this.saveFundPortfolio(userId, portfolio);
      }
      async updateFundPosition(userId, cnpj, newShares, newAvgPrice) {
        if (!userId || !cnpj) {
          throw new Error("User ID and CNPJ are required");
        }
        if (newShares < 0) {
          throw new Error("Shares cannot be negative");
        }
        const portfolio = await this.getFundPortfolio(userId);
        const positionIndex = portfolio.positions.findIndex((p) => p.cnpj === cnpj);
        if (positionIndex === -1) {
          throw new Error("Position not found");
        }
        if (newShares === 0) {
          portfolio.positions.splice(positionIndex, 1);
        } else {
          const position = portfolio.positions[positionIndex];
          position.quotas = newShares;
          if (newAvgPrice !== void 0) {
            position.avgPrice = newAvgPrice;
            position.investedAmount = newShares * newAvgPrice;
          }
        }
        this.recalculatePortfolio(portfolio);
        await this.saveFundPortfolio(userId, portfolio);
      }
      async removeFundPosition(userId, cnpj) {
        if (!userId || !cnpj) {
          throw new Error("User ID and CNPJ are required");
        }
        const portfolio = await this.getFundPortfolio(userId);
        const initialLength = portfolio.positions.length;
        portfolio.positions = portfolio.positions.filter((p) => p.cnpj !== cnpj);
        if (portfolio.positions.length === initialLength) {
          throw new Error("Position not found");
        }
        this.recalculatePortfolio(portfolio);
        await this.saveFundPortfolio(userId, portfolio);
      }
      async getAllUserPortfolios() {
        const indexKey = "fund-portfolios:index";
        const indexData = await this.kv.get(indexKey);
        if (!indexData) {
          return [];
        }
        try {
          return JSON.parse(indexData);
        } catch (error3) {
          console.error("Error parsing portfolios index:", error3);
          return [];
        }
      }
      async deletePortfolio(userId) {
        if (!userId) {
          throw new Error("User ID is required");
        }
        const portfolioKey = this.getPortfolioKey(userId);
        await this.kv.delete(portfolioKey);
        await this.removeFromUserIndex(userId);
      }
      // Helper methods
      getPortfolioKey(userId) {
        return `fund-portfolio:${userId}`;
      }
      generatePositionId(cnpj) {
        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
        return `fund-pos:${cnpj}:${timestamp}:${Math.random().toString(36).substr(2, 6)}`;
      }
      createEmptyPortfolio(userId) {
        return {
          userId,
          positions: [],
          totalInvested: 0,
          currentValue: 0,
          totalPerformance: 0,
          totalPerformancePercent: 0,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      validateAndFixPortfolio(portfolio, userId) {
        const validPortfolio = {
          userId,
          positions: Array.isArray(portfolio.positions) ? portfolio.positions : [],
          totalInvested: portfolio.totalInvested || 0,
          currentValue: portfolio.currentValue || 0,
          totalPerformance: portfolio.totalPerformance || 0,
          totalPerformancePercent: portfolio.totalPerformancePercent || 0,
          lastUpdated: portfolio.lastUpdated || (/* @__PURE__ */ new Date()).toISOString()
        };
        validPortfolio.positions = validPortfolio.positions.map((position) => this.normalizePosition(position)).filter((position) => {
          const name = position.name || position.fundName;
          const quotas = position.quotas || position.shares || 0;
          const investedAmount = position.investedAmount || 0;
          return position.cnpj && name && typeof quotas === "number" && quotas > 0 && typeof investedAmount === "number" && investedAmount > 0;
        });
        validPortfolio.positions.forEach((position) => {
          if (!position.id) {
            position.id = this.generatePositionId(position.cnpj);
          }
          const quotas = position.quotas || position.shares || 0;
          const investedAmount = position.investedAmount || 0;
          if (!position.avgPrice && quotas > 0) {
            position.avgPrice = investedAmount / quotas;
          }
        });
        return validPortfolio;
      }
      recalculatePortfolio(portfolio) {
        portfolio.totalInvested = portfolio.positions.reduce((sum, pos) => {
          const investedAmount = pos.investedAmount || 0;
          return sum + investedAmount;
        }, 0);
        let hasCurrentValues = true;
        portfolio.currentValue = 0;
        for (const position of portfolio.positions) {
          const quotas = position.quotas || position.shares || 0;
          const investedAmount = position.investedAmount || 0;
          if (position.currentQuotaValue !== void 0) {
            position.currentValue = quotas * position.currentQuotaValue;
            position.performance = position.currentValue - investedAmount;
            position.performancePercent = investedAmount > 0 ? position.performance / investedAmount * 100 : 0;
            portfolio.currentValue += position.currentValue;
          } else {
            hasCurrentValues = false;
            position.currentValue = investedAmount;
            position.performance = 0;
            position.performancePercent = 0;
            portfolio.currentValue += investedAmount;
          }
        }
        if (hasCurrentValues) {
          portfolio.totalPerformance = portfolio.currentValue - portfolio.totalInvested;
          portfolio.totalPerformancePercent = portfolio.totalInvested > 0 ? portfolio.totalPerformance / portfolio.totalInvested * 100 : 0;
        } else {
          portfolio.totalPerformance = 0;
          portfolio.totalPerformancePercent = 0;
        }
        portfolio.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      }
      async updateUserIndex(userId) {
        const indexKey = "fund-portfolios:index";
        const indexData = await this.kv.get(indexKey);
        let userIds = [];
        if (indexData) {
          try {
            userIds = JSON.parse(indexData);
          } catch (error3) {
            console.error("Error parsing user index:", error3);
            userIds = [];
          }
        }
        if (!userIds.includes(userId)) {
          userIds.push(userId);
          await this.kv.put(indexKey, JSON.stringify(userIds));
        }
      }
      async removeFromUserIndex(userId) {
        const indexKey = "fund-portfolios:index";
        const indexData = await this.kv.get(indexKey);
        if (!indexData) {
          return;
        }
        try {
          let userIds = JSON.parse(indexData);
          userIds = userIds.filter((id) => id !== userId);
          await this.kv.put(indexKey, JSON.stringify(userIds));
        } catch (error3) {
          console.error("Error updating user index:", error3);
        }
      }
      normalizePosition(position) {
        const name = position.name || position.fundName || "";
        const quotas = position.quotas || position.shares || 0;
        const purchaseDate = position.purchaseDate || position.addedDate || (/* @__PURE__ */ new Date()).toISOString();
        const investedAmount = position.investedAmount || quotas * position.avgPrice || 0;
        return {
          ...position,
          name,
          fundName: name,
          // Keep both for compatibility
          quotas,
          shares: quotas,
          // Keep both for compatibility
          purchaseDate,
          addedDate: purchaseDate,
          // Keep both for compatibility
          investedAmount
        };
      }
    };
  }
});

// src/modules/fund-tracker/fund-api.ts
var ZaisenFundAPI;
var init_fund_api = __esm({
  "src/modules/fund-tracker/fund-api.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    ZaisenFundAPI = class {
      static {
        __name(this, "ZaisenFundAPI");
      }
      baseUrl;
      apiKey;
      constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
        this.apiKey = apiKey;
      }
      async makeRequest(endpoint, params) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value) {
              url.searchParams.append(key, value);
            }
          });
        }
        const response = await fetch(url.toString(), {
          headers: {
            "X-API-Key": this.apiKey,
            "Content-Type": "application/json"
          }
        });
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
      }
      async searchFunds(query, limit = 20) {
        try {
          const response = await this.makeRequest(
            "/api/v1/fundos",
            {
              nome: query,
              limit: limit.toString()
            }
          );
          return response.funds || [];
        } catch (error3) {
          console.error("Error searching funds:", error3);
          throw new Error(`Failed to search funds: ${error3 instanceof Error ? error3.message : "Unknown error"}`);
        }
      }
      async getFundQuote(cnpj) {
        try {
          const cleanCnpj = cnpj.replace(/[^\d]/g, "");
          const response = await this.makeRequest(
            `/api/v1/fundos/${cleanCnpj}/ultima-cota`
          );
          return response;
        } catch (error3) {
          console.error(`Error fetching quote for CNPJ ${cnpj}:`, error3);
          return null;
        }
      }
      async getFundDetails(cnpj) {
        try {
          const cleanCnpj = cnpj.replace(/[^\d]/g, "");
          const response = await this.makeRequest(
            `/api/v1/fundos/${cleanCnpj}`,
            {
              include_latest_quota: "true"
            }
          );
          return response;
        } catch (error3) {
          console.error(`Error fetching details for CNPJ ${cnpj}:`, error3);
          return null;
        }
      }
      async searchFundsByCNPJ(cnpj) {
        try {
          const cleanCnpj = cnpj.replace(/[^\d]/g, "");
          const formattedCnpj = cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
          const response = await this.makeRequest(
            "/api/v1/fundos",
            {
              cnpj: formattedCnpj,
              limit: "1"
            }
          );
          return response.funds || [];
        } catch (error3) {
          console.error(`Error searching fund by CNPJ ${cnpj}:`, error3);
          throw new Error(`Failed to search fund by CNPJ: ${error3 instanceof Error ? error3.message : "Unknown error"}`);
        }
      }
      async searchFundsByClass(className, limit = 50) {
        try {
          const response = await this.makeRequest(
            "/api/v1/fundos",
            {
              classe: className,
              limit: limit.toString()
            }
          );
          return response.funds || [];
        } catch (error3) {
          console.error(`Error searching funds by class ${className}:`, error3);
          throw new Error(`Failed to search funds by class: ${error3 instanceof Error ? error3.message : "Unknown error"}`);
        }
      }
      async searchFundsByManager(managerName, limit = 50) {
        try {
          const response = await this.makeRequest(
            "/api/v1/fundos",
            {
              gestor: managerName,
              limit: limit.toString()
            }
          );
          return response.funds || [];
        } catch (error3) {
          console.error(`Error searching funds by manager ${managerName}:`, error3);
          throw new Error(`Failed to search funds by manager: ${error3 instanceof Error ? error3.message : "Unknown error"}`);
        }
      }
    };
  }
});

// src/router/AudioProcessor.ts
var AudioProcessor_exports = {};
__export(AudioProcessor_exports, {
  AudioProcessor: () => AudioProcessor
});
var AudioProcessor;
var init_AudioProcessor = __esm({
  "src/router/AudioProcessor.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_processor();
    init_storage2();
    init_fund_api();
    AudioProcessor = class {
      static {
        __name(this, "AudioProcessor");
      }
      env;
      constructor(env2) {
        this.env = env2;
      }
      async handleAudioMessage(payload) {
        const userPhone = payload.from || payload.phone || payload.senderNumber;
        try {
          if (!payload.audio) {
            console.log("Invalid audio message received");
            return;
          }
          await this.sendResponse(userPhone, "\u{1F3A4} \xC1udio recebido! Processando transcri\xE7\xE3o...");
          const context2 = {
            env: this.env,
            userId: userPhone,
            todoistToken: this.env.TODOIST_API_TOKEN,
            zapiPayload: payload
          };
          await processAudioMessage(payload, context2);
        } catch (error3) {
          console.error("Error processing audio:", error3);
          await this.sendResponse(
            userPhone,
            "\u274C Erro ao processar o \xE1udio. Por favor, tente novamente."
          );
        }
      }
      async processFundCommand(transcription, classification, payload) {
        try {
          const userId = payload.phone;
          const fundStorage = new KVFundStorage(this.env.USER_CONFIGS);
          let fundAPI = null;
          if (["fund_quote", "fund_add"].includes(classification) && this.env.ZAISEN_API_URL && this.env.ZAISEN_API_KEY) {
            fundAPI = new ZaisenFundAPI(this.env.ZAISEN_API_URL, this.env.ZAISEN_API_KEY);
          }
          switch (classification) {
            case "fund_add":
              await this.handleFundAdd(transcription, userId, fundStorage, fundAPI);
              break;
            case "fund_remove":
              await this.handleFundRemove(transcription, userId, fundStorage);
              break;
            case "fund_quote":
              await this.handleFundQuote(transcription, userId, fundAPI);
              break;
            case "fund_portfolio":
              await this.handleFundPortfolio(userId, fundStorage);
              break;
            case "fund_update":
              await this.handleFundUpdate(transcription, userId, fundStorage);
              break;
            default:
              await this.sendResponse(
                payload.phone,
                "\u274C Comando de fundo n\xE3o reconhecido."
              );
          }
        } catch (error3) {
          console.error("Error processing fund command:", error3);
          await this.sendResponse(
            payload.phone,
            "\u274C Erro ao processar comando de fundo. Tente novamente ou seja mais espec\xEDfico."
          );
        }
      }
      async handleFundAdd(transcription, userId, fundStorage, fundAPI) {
        await this.sendResponse(userId, "\u{1F4C8} Processando adi\xE7\xE3o de fundo...");
        try {
          const fundData = this.parseFundAddCommand(transcription);
          if (!fundData.name && !fundData.cnpj) {
            await this.sendResponse(
              userId,
              '\u274C N\xE3o consegui identificar o nome ou CNPJ do fundo. Fale algo como: "Adicionar 100 cotas do fundo XYZ que comprei por 50 reais cada"'
            );
            return;
          }
          if (!fundData.quantity || fundData.quantity <= 0) {
            await this.sendResponse(
              userId,
              "\u274C Quantidade de cotas n\xE3o identificada. Especifique quantas cotas foram compradas."
            );
            return;
          }
          if (!fundData.cnpj && fundData.name && fundAPI) {
            const searchResults = await fundAPI.searchFunds(fundData.name, 5);
            if (searchResults.length === 0) {
              await this.sendResponse(
                userId,
                `\u274C N\xE3o encontrei o fundo "${fundData.name}". Tente usar o CNPJ ou verificar o nome.`
              );
              return;
            }
            if (searchResults.length === 1) {
              fundData.cnpj = searchResults[0].cnpj;
              fundData.name = searchResults[0].nome;
            } else {
              const options = searchResults.slice(0, 3).map((fund, index) => `${index + 1}. ${fund.nome} (${fund.cnpj})`).join("\n");
              await this.sendResponse(
                userId,
                `\u{1F50D} Encontrei ${searchResults.length} fundos com nome similar:

${options}

Por favor, especifique o CNPJ ou nome completo.`
              );
              return;
            }
          }
          if (!fundData.avgPrice && fundData.totalAmount) {
            fundData.avgPrice = fundData.totalAmount / fundData.quantity;
          } else if (!fundData.avgPrice) {
            await this.sendResponse(
              userId,
              '\u274C Pre\xE7o por cota n\xE3o identificado. Fale algo como: "comprei por 50 reais cada" ou "investimento total foi 5000 reais"'
            );
            return;
          }
          const position = {
            cnpj: fundData.cnpj,
            name: fundData.name,
            quotas: fundData.quantity,
            avgPrice: fundData.avgPrice,
            investedAmount: fundData.quantity * fundData.avgPrice,
            purchaseDate: (/* @__PURE__ */ new Date()).toISOString()
          };
          await fundStorage.addFundPosition(userId, position);
          await this.sendResponse(
            userId,
            `\u2705 Fundo adicionado ao seu portf\xF3lio!

\u{1F4CA} ${position.name}
\u{1F4B0} ${position.quotas} cotas a R$ ${position.avgPrice.toFixed(2)}
\u{1F4B5} Total investido: R$ ${(position.investedAmount || 0).toFixed(2)}`
          );
        } catch (error3) {
          console.error("Error adding fund:", error3);
          await this.sendResponse(
            userId,
            "\u274C Erro ao adicionar fundo. Verifique os dados e tente novamente."
          );
        }
      }
      async handleFundRemove(transcription, userId, fundStorage) {
        await this.sendResponse(userId, "\u{1F4C9} Processando remo\xE7\xE3o de fundo...");
        try {
          const removeData = this.parseFundRemoveCommand(transcription);
          if (!removeData.identifier) {
            await this.sendResponse(
              userId,
              "\u274C N\xE3o consegui identificar qual fundo remover. Fale o nome ou CNPJ do fundo."
            );
            return;
          }
          const portfolio = await fundStorage.getFundPortfolio(userId);
          const position = portfolio.positions.find(
            (p) => p.cnpj === removeData.identifier || p.name && removeData.identifier && p.name.toLowerCase().includes(removeData.identifier.toLowerCase())
          );
          if (!position) {
            await this.sendResponse(
              userId,
              `\u274C Fundo "${removeData.identifier}" n\xE3o encontrado no seu portf\xF3lio.`
            );
            return;
          }
          if (removeData.quantity && removeData.quantity > 0) {
            const currentQuotas = position.quotas || 0;
            if (removeData.quantity >= currentQuotas) {
              await fundStorage.removeFundPosition(userId, position.cnpj);
              await this.sendResponse(
                userId,
                `\u2705 Fundo ${position.name} removido completamente do portf\xF3lio!`
              );
            } else {
              const newQuotas = currentQuotas - removeData.quantity;
              await fundStorage.updateFundPosition(userId, position.cnpj, newQuotas);
              await this.sendResponse(
                userId,
                `\u2705 Removidas ${removeData.quantity} cotas de ${position.name}.
Restam ${newQuotas} cotas no portf\xF3lio.`
              );
            }
          } else {
            await fundStorage.removeFundPosition(userId, position.cnpj);
            await this.sendResponse(
              userId,
              `\u2705 Fundo ${position.name} removido completamente do portf\xF3lio!`
            );
          }
        } catch (error3) {
          console.error("Error removing fund:", error3);
          await this.sendResponse(
            userId,
            "\u274C Erro ao remover fundo. Verifique os dados e tente novamente."
          );
        }
      }
      async handleFundQuote(transcription, userId, fundAPI) {
        await this.sendResponse(userId, "\u{1F4B0} Buscando cota\xE7\xE3o do fundo...");
        if (!fundAPI) {
          await this.sendResponse(
            userId,
            "\u274C Servi\xE7o de cota\xE7\xF5es n\xE3o configurado. Configure ZAISEN_API_URL e ZAISEN_API_KEY."
          );
          return;
        }
        try {
          const fundIdentifier = this.parseFundQuoteCommand(transcription);
          if (!fundIdentifier) {
            await this.sendResponse(
              userId,
              "\u274C N\xE3o consegui identificar qual fundo consultar. Fale o nome ou CNPJ do fundo."
            );
            return;
          }
          let cnpj = fundIdentifier;
          if (!/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(fundIdentifier.replace(/\s/g, ""))) {
            const searchResults = await fundAPI.searchFunds(fundIdentifier, 1);
            if (searchResults.length === 0) {
              await this.sendResponse(
                userId,
                `\u274C Fundo "${fundIdentifier}" n\xE3o encontrado.`
              );
              return;
            }
            cnpj = searchResults[0].cnpj;
          }
          const quote = await fundAPI.getFundQuote(cnpj);
          if (!quote) {
            await this.sendResponse(
              userId,
              "\u274C N\xE3o consegui buscar a cota\xE7\xE3o deste fundo. Verifique o CNPJ ou nome."
            );
            return;
          }
          const changeIcon = quote.variacao_dia >= 0 ? "\u{1F4C8}" : "\u{1F4C9}";
          const changeText = quote.variacao_dia >= 0 ? "+" : "";
          await this.sendResponse(
            userId,
            `\u{1F4B0} Cota\xE7\xE3o atual:

\u{1F4CA} ${quote.nome}
\u{1F4B5} R$ ${quote.ultima_cota.toFixed(6)}
\u{1F4C5} ${new Date(quote.data_ultima_cota).toLocaleDateString("pt-BR")}
${changeIcon} ${changeText}${quote.variacao_percentual.toFixed(2)}% (R$ ${changeText}${quote.variacao_dia.toFixed(6)})`
          );
        } catch (error3) {
          console.error("Error fetching fund quote:", error3);
          await this.sendResponse(
            userId,
            "\u274C Erro ao buscar cota\xE7\xE3o. Tente novamente ou verifique o nome/CNPJ do fundo."
          );
        }
      }
      async handleFundPortfolio(userId, fundStorage) {
        await this.sendResponse(userId, "\u{1F4CA} Carregando seu portf\xF3lio de fundos...");
        try {
          const portfolio = await fundStorage.getFundPortfolio(userId);
          if (portfolio.positions.length === 0) {
            await this.sendResponse(
              userId,
              '\u{1F4CA} Seu portf\xF3lio est\xE1 vazio.\n\nPara adicionar um fundo, fale algo como: "Adicionar 100 cotas do fundo XYZ que comprei por 50 reais cada"'
            );
            return;
          }
          let message = `\u{1F4CA} SEU PORTF\xD3LIO DE FUNDOS

`;
          portfolio.positions.forEach((position, index) => {
            const name = position.name || position.fundName || "Fundo sem nome";
            const quotas = position.quotas || position.shares || 0;
            const avgPrice = position.avgPrice || 0;
            const invested = position.investedAmount || quotas * avgPrice;
            message += `${index + 1}. ${name}
`;
            message += `   \u{1F4B0} ${quotas} cotas a R$ ${avgPrice.toFixed(2)}
`;
            message += `   \u{1F4B5} Investido: R$ ${invested.toFixed(2)}
`;
            if (position.currentValue && position.performance !== void 0) {
              const perfIcon = position.performance >= 0 ? "\u{1F4C8}" : "\u{1F4C9}";
              const perfText = position.performance >= 0 ? "+" : "";
              message += `   ${perfIcon} Atual: R$ ${position.currentValue.toFixed(2)} (${perfText}${position.performancePercent?.toFixed(2)}%)
`;
            }
            message += `
`;
          });
          message += `\u{1F4BC} RESUMO TOTAL:
`;
          message += `\u{1F4B5} Total Investido: R$ ${portfolio.totalInvested.toFixed(2)}
`;
          if (portfolio.currentValue > 0 && portfolio.totalPerformance !== 0) {
            const totalPerfIcon = portfolio.totalPerformance >= 0 ? "\u{1F4C8}" : "\u{1F4C9}";
            const totalPerfText = portfolio.totalPerformance >= 0 ? "+" : "";
            message += `\u{1F4B0} Valor Atual: R$ ${portfolio.currentValue.toFixed(2)}
`;
            message += `${totalPerfIcon} Performance: ${totalPerfText}R$ ${portfolio.totalPerformance.toFixed(2)} (${totalPerfText}${portfolio.totalPerformancePercent.toFixed(2)}%)
`;
          }
          message += `
\u{1F550} Atualizado: ${new Date(portfolio.lastUpdated).toLocaleString("pt-BR")}`;
          await this.sendResponse(userId, message);
        } catch (error3) {
          console.error("Error fetching portfolio:", error3);
          await this.sendResponse(
            userId,
            "\u274C Erro ao carregar portf\xF3lio. Tente novamente."
          );
        }
      }
      async handleFundUpdate(transcription, userId, fundStorage) {
        await this.sendResponse(userId, "\u{1F504} Processando atualiza\xE7\xE3o de posi\xE7\xE3o...");
        try {
          const updateData = this.parseFundUpdateCommand(transcription);
          if (!updateData.identifier) {
            await this.sendResponse(
              userId,
              "\u274C N\xE3o consegui identificar qual fundo atualizar. Fale o nome ou CNPJ do fundo."
            );
            return;
          }
          const portfolio = await fundStorage.getFundPortfolio(userId);
          const position = portfolio.positions.find(
            (p) => p.cnpj === updateData.identifier || p.name && updateData.identifier && p.name.toLowerCase().includes(updateData.identifier.toLowerCase())
          );
          if (!position) {
            await this.sendResponse(
              userId,
              `\u274C Fundo "${updateData.identifier}" n\xE3o encontrado no seu portf\xF3lio.`
            );
            return;
          }
          if (updateData.newQuantity !== void 0) {
            await fundStorage.updateFundPosition(
              userId,
              position.cnpj,
              updateData.newQuantity,
              updateData.newAvgPrice
            );
            let message = `\u2705 Posi\xE7\xE3o atualizada!

\u{1F4CA} ${position.name}
\u{1F4B0} Nova quantidade: ${updateData.newQuantity} cotas`;
            if (updateData.newAvgPrice !== void 0) {
              message += `
\u{1F4B5} Novo pre\xE7o m\xE9dio: R$ ${updateData.newAvgPrice.toFixed(2)}`;
            }
            await this.sendResponse(userId, message);
          } else {
            await this.sendResponse(
              userId,
              '\u274C N\xE3o consegui identificar os novos valores. Fale algo como: "Atualizar fundo XYZ para 150 cotas" ou "Mudar pre\xE7o m\xE9dio do fundo XYZ para 55 reais"'
            );
          }
        } catch (error3) {
          console.error("Error updating fund:", error3);
          await this.sendResponse(
            userId,
            "\u274C Erro ao atualizar posi\xE7\xE3o. Verifique os dados e tente novamente."
          );
        }
      }
      // Text parsing methods for Portuguese voice commands
      parseFundAddCommand(transcription) {
        const text = transcription.toLowerCase();
        let name;
        const fundNameMatch = text.match(/(?:fundo|fund)\s+([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s+(?:que|cnpj|com|por|cotas|quotas)|\s*$)/i);
        if (fundNameMatch) {
          name = fundNameMatch[1].trim();
        }
        const quotedMatch = text.match(/["']([^"']+)["']/);
        if (quotedMatch) {
          name = quotedMatch[1];
        }
        let cnpj;
        const cnpjMatch = text.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
        if (cnpjMatch) {
          cnpj = cnpjMatch[1].replace(/[^\d]/g, "");
        }
        let quantity;
        const quantityMatches = [
          text.match(/(\d+(?:\.\d+)?)\s*(?:cotas?|quotas?)/),
          text.match(/(?:comprei|comprar|adicionar)\s+(\d+(?:\.\d+)?)/),
          text.match(/(\d+(?:\.\d+)?)\s*(?:do|de)/)
        ];
        for (const match of quantityMatches) {
          if (match) {
            quantity = parseFloat(match[1]);
            break;
          }
        }
        let avgPrice;
        const priceMatches = [
          text.match(/(?:por|preço|custou|valor)\s+(?:de\s+)?(?:r\$\s*)?(\d+(?:[\.,]\d+)?)/),
          text.match(/(\d+(?:[\.,]\d+)?)\s*reais?\s+(?:cada|por\s+cota)/),
          text.match(/a\s+(?:r\$\s*)?(\d+(?:[\.,]\d+)?)/)
        ];
        for (const match of priceMatches) {
          if (match) {
            avgPrice = parseFloat(match[1].replace(",", "."));
            break;
          }
        }
        let totalAmount;
        const totalMatches = [
          text.match(/(?:total|investimento|investir|gastei|paguei)\s+(?:de\s+)?(?:r\$\s*)?(\d+(?:[\.,]\d+)?)/),
          text.match(/(\d+(?:[\.,]\d+)?)\s*reais?\s+(?:total|no\s+total)/)
        ];
        for (const match of totalMatches) {
          if (match) {
            totalAmount = parseFloat(match[1].replace(",", "."));
            break;
          }
        }
        return { name, cnpj, quantity, avgPrice, totalAmount };
      }
      parseFundRemoveCommand(transcription) {
        const text = transcription.toLowerCase();
        let identifier;
        const identifierMatches = [
          text.match(/(?:fundo|fund)\s+([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s+(?:que|cnpj|com|por|cotas|quotas|remover|vender)|\s*$)/i),
          text.match(/(?:remover|vender|tirar).*?(?:do|da|de)\s+([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s|$)/i),
          text.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/)
        ];
        for (const match of identifierMatches) {
          if (match) {
            identifier = match[1].trim();
            break;
          }
        }
        let quantity;
        const quantityMatches = [
          text.match(/(?:remover|vender|tirar)\s+(\d+(?:\.\d+)?)\s*(?:cotas?|quotas?)/),
          text.match(/(\d+(?:\.\d+)?)\s*(?:cotas?|quotas?).*?(?:do|da|de)/)
        ];
        for (const match of quantityMatches) {
          if (match) {
            quantity = parseFloat(match[1]);
            break;
          }
        }
        return { identifier, quantity };
      }
      parseFundQuoteCommand(transcription) {
        const text = transcription.toLowerCase();
        const cnpjMatch = text.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
        if (cnpjMatch) {
          return cnpjMatch[1];
        }
        const nameMatches = [
          text.match(/(?:cotação|cota|preço|valor).*?(?:do|da|de)\s+(?:fundo\s+)?([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s|$)/i),
          text.match(/(?:fundo|fund)\s+([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s+(?:cotação|cota|preço|valor)|\s*$)/i),
          text.match(/["']([^"']+)["']/)
        ];
        for (const match of nameMatches) {
          if (match) {
            return match[1].trim();
          }
        }
        return void 0;
      }
      parseFundUpdateCommand(transcription) {
        const text = transcription.toLowerCase();
        let identifier;
        const identifierMatches = [
          text.match(/(?:atualizar|mudar|alterar).*?(?:do|da|de)\s+(?:fundo\s+)?([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s+(?:para|com|por)|\s|$)/i),
          text.match(/(?:fundo|fund)\s+([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s+(?:para|com|por|atualizar)|\s*$)/i),
          text.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/)
        ];
        for (const match of identifierMatches) {
          if (match) {
            identifier = match[1].trim();
            break;
          }
        }
        let newQuantity;
        const quantityMatches = [
          text.match(/(?:para|com|por)\s+(\d+(?:\.\d+)?)\s*(?:cotas?|quotas?)/),
          text.match(/(\d+(?:\.\d+)?)\s*(?:cotas?|quotas?)/)
        ];
        for (const match of quantityMatches) {
          if (match) {
            newQuantity = parseFloat(match[1]);
            break;
          }
        }
        let newAvgPrice;
        const priceMatches = [
          text.match(/(?:preço|valor|por)\s+(?:de\s+)?(?:r\$\s*)?(\d+(?:[\.,]\d+)?)/),
          text.match(/(\d+(?:[\.,]\d+)?)\s*reais?\s+(?:cada|por\s+cota)/)
        ];
        for (const match of priceMatches) {
          if (match) {
            newAvgPrice = parseFloat(match[1].replace(",", "."));
            break;
          }
        }
        return { identifier, newQuantity, newAvgPrice };
      }
      async sendResponse(to, message) {
        if (!to || to.trim() === "") {
          console.error("Cannot send message: phone number is empty");
          return;
        }
        if (!this.env.Z_API_INSTANCE_ID || !this.env.Z_API_INSTANCE_TOKEN || !this.env.Z_API_SECURITY_TOKEN) {
          console.error("Z-API credentials not configured");
          return;
        }
        try {
          const url = `https://api.z-api.io/instances/${this.env.Z_API_INSTANCE_ID}/token/${this.env.Z_API_INSTANCE_TOKEN}/send-text`;
          const body = {
            phone: to,
            message
          };
          console.log("Sending Z-API message from AudioProcessor:", {
            url,
            to,
            messageLength: message.length,
            hasClientToken: !!this.env.Z_API_SECURITY_TOKEN
          });
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Client-Token": this.env.Z_API_SECURITY_TOKEN
            },
            body: JSON.stringify(body)
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Z-API error response:", {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            });
            throw new Error(`Z-API error: ${response.status} - ${errorText}`);
          }
          console.log("Z-API message sent successfully from AudioProcessor");
        } catch (error3) {
          console.error("Error sending response via Z-API:", error3);
        }
      }
    };
  }
});

// src/index-simple.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
init_AudioProcessor();

// src/modules/portfolio-tracker/index.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/modules/portfolio-tracker/calculator.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/modules/portfolio-tracker/portfolio-data.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var DEFAULT_PORTFOLIO = [
  { ticker: "AAPL34", shares: 100, avgPrice: 50 },
  { ticker: "VALE3", shares: 500, avgPrice: 60 }
];
function loadPortfolioData(portfolioData) {
  if (portfolioData) {
    try {
      return JSON.parse(portfolioData);
    } catch (error3) {
      console.error("Error parsing PORTFOLIO_DATA:", error3);
    }
  }
  return DEFAULT_PORTFOLIO;
}
__name(loadPortfolioData, "loadPortfolioData");

// src/modules/portfolio-tracker/stock-api.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function fetchAllPrices(brapiToken, portfolio) {
  const stockData = /* @__PURE__ */ new Map();
  const uniqueTickers = [...new Set(portfolio.map((item) => item.ticker))];
  console.log(`Fetching prices for: ${uniqueTickers.join(", ")}`);
  if (uniqueTickers.length <= 10) {
    try {
      const tickerList = uniqueTickers.join(",");
      const url = `https://brapi.dev/api/quote/${tickerList}?token=${brapiToken}`;
      console.log(`Batch fetching: ${tickerList}`);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.results && Array.isArray(data.results)) {
          for (const stock of data.results) {
            if (stock.symbol && stock.regularMarketPrice !== null && stock.regularMarketPreviousClose !== null) {
              stockData.set(stock.symbol, {
                price: stock.regularMarketPrice,
                previousClose: stock.regularMarketPreviousClose,
                change: stock.regularMarketChange || 0,
                changePercent: stock.regularMarketChangePercent || 0
              });
              console.log(`${stock.symbol}: R$ ${stock.regularMarketPrice.toFixed(2)} (${stock.regularMarketChangePercent?.toFixed(2)}%)`);
            }
          }
          console.log(`Batch request successful: ${stockData.size}/${uniqueTickers.length} stocks`);
          return stockData;
        }
      }
    } catch (error3) {
      console.error("Batch request failed, falling back to individual requests:", error3);
    }
  }
  for (const ticker of uniqueTickers) {
    try {
      const url = `https://brapi.dev/api/quote/${ticker}?token=${brapiToken}`;
      console.log(`Fetching ${ticker}...`);
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Error fetching ${ticker}: ${response.status} ${response.statusText}`);
        continue;
      }
      const data = await response.json();
      if (data.results && data.results[0]) {
        const stock = data.results[0];
        if (stock.regularMarketPrice !== null && stock.regularMarketPreviousClose !== null) {
          stockData.set(ticker, {
            price: stock.regularMarketPrice,
            previousClose: stock.regularMarketPreviousClose,
            change: stock.regularMarketChange || 0,
            changePercent: stock.regularMarketChangePercent || 0
          });
          console.log(`${ticker}: R$ ${stock.regularMarketPrice.toFixed(2)} (${stock.regularMarketChangePercent?.toFixed(2)}%)`);
        }
      } else {
        console.log(`No price data for ${ticker}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error3) {
      console.error(`Error fetching ${ticker}:`, error3);
    }
  }
  console.log(`Returning ${stockData.size} stocks with data`);
  return stockData;
}
__name(fetchAllPrices, "fetchAllPrices");

// src/modules/portfolio-tracker/calculator.ts
async function calculatePortfolioValue(brapiToken, portfolioData) {
  const portfolio = loadPortfolioData(portfolioData);
  const stockData = await fetchAllPrices(brapiToken, portfolio);
  let currentValue = 0;
  let previousCloseValue = 0;
  const details = portfolio.map((item) => {
    const data = stockData.get(item.ticker);
    if (data) {
      const position = data.price * item.shares;
      const previousPosition = data.previousClose * item.shares;
      currentValue += position;
      previousCloseValue += previousPosition;
      return {
        ticker: item.ticker,
        currentPrice: data.price,
        position,
        dailyChange: data.change * item.shares,
        dailyChangePercent: data.changePercent
      };
    }
    return {
      ticker: item.ticker,
      currentPrice: null,
      position: 0,
      dailyChange: 0,
      dailyChangePercent: 0
    };
  });
  const totalCost = portfolio.reduce((sum, item) => sum + item.avgPrice * item.shares, 0);
  const dailyPnL = currentValue - previousCloseValue;
  const dailyPercentageChange = previousCloseValue > 0 ? dailyPnL / previousCloseValue * 100 : 0;
  const totalPnL = currentValue - totalCost;
  const totalPercentageChange = totalPnL / totalCost * 100;
  return {
    currentValue,
    previousCloseValue,
    totalCost,
    dailyPnL,
    dailyPercentageChange,
    totalPnL,
    totalPercentageChange,
    details
  };
}
__name(calculatePortfolioValue, "calculatePortfolioValue");

// src/modules/portfolio-tracker/message-formatter.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function formatPortfolioMessage(stocksData, fundsData = null, hasFunds = false) {
  let combinedCurrentValue, combinedTotalCost, combinedDailyPnL, combinedTotalPnL;
  let combinedDailyPercentageChange, combinedTotalPercentageChange;
  if (hasFunds && fundsData) {
    combinedCurrentValue = stocksData.currentValue + fundsData.currentValue;
    combinedTotalCost = stocksData.totalCost + fundsData.totalCost;
    combinedDailyPnL = stocksData.dailyPnL + fundsData.dailyPnL;
    combinedTotalPnL = stocksData.totalPnL + fundsData.totalPnL;
    const combinedPreviousValue = combinedCurrentValue - combinedDailyPnL;
    combinedDailyPercentageChange = combinedPreviousValue > 0 ? combinedDailyPnL / combinedPreviousValue * 100 : 0;
    combinedTotalPercentageChange = combinedTotalCost > 0 ? combinedTotalPnL / combinedTotalCost * 100 : 0;
  } else {
    combinedCurrentValue = stocksData.currentValue;
    combinedTotalCost = stocksData.totalCost;
    combinedDailyPnL = stocksData.dailyPnL;
    combinedTotalPnL = stocksData.totalPnL;
    combinedDailyPercentageChange = stocksData.dailyPercentageChange;
    combinedTotalPercentageChange = stocksData.totalPercentageChange;
  }
  const dailyEmoji = combinedDailyPnL >= 0 ? "\u{1F4C8}" : "\u{1F4C9}";
  const dailySign = combinedDailyPnL >= 0 ? "+" : "";
  const totalSign = combinedTotalPnL >= 0 ? "+" : "";
  const stocksWithPrices = stocksData.details.filter((d) => d.currentPrice !== null).length;
  const totalStocks = stocksData.details.length;
  const fundsWithQuotes = fundsData ? fundsData.details.filter((d) => d.currentQuote !== null).length : 0;
  const totalFunds = fundsData ? fundsData.details.length : 0;
  let message = `${dailyEmoji} *Relat\xF3rio Di\xE1rio da Carteira* ${dailyEmoji}

`;
  message += `\u{1F4B0} *Valor Total:* R$ ${combinedCurrentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

`;
  message += `\u{1F4C5} *Resultado do Dia:*
`;
  message += `${combinedDailyPnL >= 0 ? "\u{1F49A}" : "\u{1F534}"} ${dailySign}R$ ${combinedDailyPnL.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${dailySign}${combinedDailyPercentageChange.toFixed(2)}%)

`;
  message += `\u{1F4CA} *Resultado Total:*
`;
  message += `\u{1F4B5} Custo: R$ ${combinedTotalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
`;
  message += `${combinedTotalPnL >= 0 ? "\u{1F49A}" : "\u{1F534}"} P&L: ${totalSign}R$ ${combinedTotalPnL.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalSign}${combinedTotalPercentageChange.toFixed(2)}%)

`;
  message += `\u{1F4CA} *Detalhes por Categoria:*
`;
  message += `\u{1F4C8} A\xE7\xF5es: R$ ${stocksData.currentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${stocksWithPrices}/${totalStocks} com cota\xE7\xE3o)
`;
  if (hasFunds && fundsData) {
    message += `\u{1F3E6} Fundos: R$ ${fundsData.currentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fundsWithQuotes}/${totalFunds} com cota\xE7\xE3o)
`;
  }
  message += `
_Enviado \xE0s ${(/* @__PURE__ */ new Date()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}_`;
  return message;
}
__name(formatPortfolioMessage, "formatPortfolioMessage");

// src/modules/portfolio-tracker/whatsapp-sender.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function sendWhatsAppMessage(instanceId, token, securityToken, phone, message) {
  const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": securityToken
    },
    body: JSON.stringify({
      phone,
      message
    })
  });
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to send WhatsApp message: ${response.statusText} - ${errorData}`);
  }
}
__name(sendWhatsAppMessage, "sendWhatsAppMessage");

// src/modules/fund-tracker/index.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/modules/fund-tracker/types.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/modules/fund-tracker/index.ts
init_fund_api();

// src/modules/fund-tracker/calculator.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function calculateFundPortfolioValue(portfolio, fundAPI) {
  const quoteData = /* @__PURE__ */ new Map();
  console.log(`Fetching quotes for: ${portfolio.map((p) => p.cnpj).join(", ")}`);
  for (const position of portfolio) {
    try {
      console.log(`Fetching quote for ${position.cnpj} (${position.name})...`);
      const quote = await fundAPI.getFundQuote(position.cnpj);
      if (quote) {
        quoteData.set(position.cnpj, quote);
        console.log(`${position.name}: R$ ${quote.ultima_cota.toFixed(6)} (${quote.variacao_percentual?.toFixed(2)}%)`);
      } else {
        console.log(`No quote data for ${position.name} (${position.cnpj})`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error3) {
      console.error(`Error fetching quote for ${position.cnpj}:`, error3);
    }
  }
  let currentValue = 0;
  const details = portfolio.map((position) => {
    const quote = quoteData.get(position.cnpj);
    if (quote) {
      const quotas = position.quotas || (position.investedAmount && position.avgPrice ? position.investedAmount / position.avgPrice : 0);
      const positionValue = parseFloat(quote.ultima_cota) * quotas;
      currentValue += positionValue;
      return {
        cnpj: position.cnpj,
        name: position.name || position.fundName || "",
        currentQuote: parseFloat(quote.ultima_cota),
        position: positionValue,
        dailyChange: parseFloat(quote.variacao_dia || "0") * quotas,
        dailyChangePercent: parseFloat(quote.variacao_percentual || "0")
      };
    }
    return {
      cnpj: position.cnpj,
      name: position.name || position.fundName || "",
      currentQuote: null,
      position: 0,
      dailyChange: 0,
      dailyChangePercent: 0
    };
  });
  const totalCost = portfolio.reduce((sum, position) => sum + (position.investedAmount || 0), 0);
  const dailyPnL = details.reduce((sum, detail) => sum + detail.dailyChange, 0);
  const totalPnL = currentValue - totalCost;
  const previousDayValue = currentValue - dailyPnL;
  const dailyPercentageChange = previousDayValue > 0 ? dailyPnL / previousDayValue * 100 : 0;
  const totalPercentageChange = totalCost > 0 ? totalPnL / totalCost * 100 : 0;
  console.log(`Returning portfolio with ${quoteData.size} funds with data`);
  return {
    currentValue,
    totalCost,
    dailyPnL,
    dailyPercentageChange,
    totalPnL,
    totalPercentageChange,
    details
  };
}
__name(calculateFundPortfolioValue, "calculateFundPortfolioValue");

// src/modules/fund-tracker/fund-data.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var DEFAULT_FUND_PORTFOLIO = [
  {
    cnpj: "00.000.000/0001-00",
    name: "Example Fund A",
    quotas: 100,
    investedAmount: 1e4,
    avgPrice: 100,
    purchaseDate: "2024-01-15"
  },
  {
    cnpj: "11.111.111/0001-11",
    name: "Example Fund B",
    quotas: 50,
    investedAmount: 5e3,
    avgPrice: 100,
    purchaseDate: "2024-02-10"
  }
];
function loadFundPortfolioData(fundPortfolioData) {
  if (fundPortfolioData) {
    try {
      return JSON.parse(fundPortfolioData);
    } catch (error3) {
      console.error("Error parsing FUND_PORTFOLIO_DATA:", error3);
    }
  }
  return DEFAULT_FUND_PORTFOLIO;
}
__name(loadFundPortfolioData, "loadFundPortfolioData");

// src/modules/fund-tracker/index.ts
init_storage2();
init_fund_api();

// src/modules/portfolio-tracker/types.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/modules/portfolio-tracker/index.ts
var PortfolioTracker = class {
  constructor(config2) {
    this.config = config2;
  }
  static {
    __name(this, "PortfolioTracker");
  }
  async sendDailyReport(portfolioDataEnv, fundPortfolioDataEnv) {
    try {
      console.log("Starting portfolio calculation...");
      const portfolioData = await this.getCombinedPortfolioData(portfolioDataEnv, fundPortfolioDataEnv);
      const message = formatPortfolioMessage(portfolioData.stocks, portfolioData.funds, portfolioData.hasFunds);
      await sendWhatsAppMessage(
        this.config.zApiInstanceId,
        this.config.zApiInstanceToken,
        this.config.zApiSecurityToken,
        this.config.whatsappNumber,
        message
      );
      console.log("Portfolio WhatsApp message sent successfully");
    } catch (error3) {
      console.error("Error sending portfolio report:", error3);
      throw error3;
    }
  }
  async getPortfolioData(portfolioData) {
    return calculatePortfolioValue(this.config.brapiToken, portfolioData);
  }
  async getFundPortfolioData(fundPortfolioData) {
    if (!this.config.zaisenApiUrl || !this.config.zaisenApiKey) {
      console.log("Fund tracking disabled - missing Zaisen API configuration");
      return null;
    }
    try {
      const fundPortfolio = loadFundPortfolioData(fundPortfolioData);
      const fundAPI = new ZaisenFundAPI(this.config.zaisenApiUrl, this.config.zaisenApiKey);
      return await calculateFundPortfolioValue(fundPortfolio, fundAPI);
    } catch (error3) {
      console.error("Error calculating fund portfolio:", error3);
      return null;
    }
  }
  async getCombinedPortfolioData(portfolioData, fundPortfolioData) {
    const [stocksData, fundsData] = await Promise.all([
      calculatePortfolioValue(this.config.brapiToken, portfolioData),
      this.getFundPortfolioData(fundPortfolioData)
    ]);
    return {
      stocks: stocksData,
      funds: fundsData,
      hasFunds: fundsData !== null
    };
  }
  isFundTrackingEnabled() {
    return !!(this.config.zaisenApiUrl && this.config.zaisenApiKey);
  }
};

// src/index-simple.ts
var index_simple_default = {
  async scheduled(_controller, env2, _ctx) {
    if (env2.BRAPI_TOKEN && env2.Z_API_INSTANCE_ID && env2.Z_API_INSTANCE_TOKEN && env2.Z_API_CLIENT_TOKEN && env2.PORTFOLIO_WHATSAPP_NUMBER) {
      try {
        const portfolioTracker = new PortfolioTracker({
          brapiToken: env2.BRAPI_TOKEN,
          zApiInstanceId: env2.Z_API_INSTANCE_ID,
          zApiInstanceToken: env2.Z_API_INSTANCE_TOKEN,
          zApiSecurityToken: env2.Z_API_CLIENT_TOKEN,
          whatsappNumber: env2.PORTFOLIO_WHATSAPP_NUMBER,
          zaisenApiUrl: env2.ZAISEN_API_URL,
          zaisenApiKey: env2.ZAISEN_API_KEY
        });
        await portfolioTracker.sendDailyReport(env2.PORTFOLIO_DATA, env2.FUND_PORTFOLIO_DATA);
        console.log("Daily portfolio report sent successfully");
      } catch (error3) {
        console.error("Error sending daily portfolio report:", error3);
      }
    }
  },
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "healthy",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        service: "jarvis-bot"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/webhook" && request.method === "POST") {
      const clientToken = request.headers.get("Client-Token");
      if (clientToken !== env2.Z_API_CLIENT_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const payload = await request.json();
        if (payload.event === "message.received" && payload.data?.message?.type === "audio" && !payload.data?.message?.fromMe) {
          try {
            const processor = new AudioProcessor(env2);
            const audioPayload = {
              ...payload,
              audio: payload.data.message.body,
              from: payload.data.message.from,
              phone: payload.data.message.from,
              senderNumber: payload.data.message.from
            };
            await processor.handleAudioMessage(audioPayload);
            return new Response(JSON.stringify({
              success: true,
              message: "Audio message processed"
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          } catch (error3) {
            console.error("Audio processing error:", error3);
            return new Response(JSON.stringify({
              success: false,
              message: "Audio processing failed",
              error: error3 instanceof Error ? error3.message : "Unknown error"
            }), {
              status: 200,
              // Still return 200 to acknowledge webhook
              headers: { "Content-Type": "application/json" }
            });
          }
        }
        return new Response(JSON.stringify({
          success: true,
          message: "Webhook received"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (error3) {
        console.error("Webhook processing error:", error3);
        return new Response("Bad Request", { status: 400 });
      }
    }
    return new Response("Not Found", { status: 404 });
  }
};
export {
  index_simple_default as default
};
//# sourceMappingURL=index-simple.js.map
