import {
  newQuickJSWASMModuleFromVariant,
  type QuickJSContext,
  type QuickJSDeferredPromise,
  type QuickJSHandle,
  type QuickJSRuntime,
  type QuickJSWASMModule,
} from "quickjs-emscripten-core";
import RELEASE_SYNC from "@jitl/quickjs-singlefile-browser-release-sync";
import {
  CodePlanExecutorError,
  type CodePlanExecutionGlobals,
  type CodePlanExecutor,
} from "../executor.ts";
import type {
  UiInterpretedFunction,
  UiTemplate,
} from "../ui/compiler.ts";

export interface QuickJsBrowserExecutorOptions {
  readonly memoryLimitBytes?: number;
  readonly maxStackBytes?: number;
  readonly timeoutMs?: number;
}

const defaultMemoryLimitBytes = 16 * 1024 * 1024;
const defaultMaxStackBytes = 512 * 1024;
const defaultTimeoutMs = 2_000;

export async function createQuickJsBrowserCodePlanExecutor(
  options: QuickJsBrowserExecutorOptions = {},
): Promise<CodePlanExecutor> {
  let module: QuickJSWASMModule;

  try {
    module = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);
  } catch (error) {
    throw new CodePlanExecutorError(
      "executor_initialization_failed",
      `QuickJS browser initialization failed: ${errorMessage(error)}`,
    );
  }

  const limits = {
    memoryLimitBytes: options.memoryLimitBytes ?? defaultMemoryLimitBytes,
    maxStackBytes: options.maxStackBytes ?? defaultMaxStackBytes,
    timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
  };

  return {
    profile: {
      id: "quickjs-browser",
      trust: "isolated",
      supportsGeneratedUi: true,
    },
    execute(context) {
      return executeQuickJsPlan(module, context.globals, context.code, {
        ...limits,
        signal: context.signal,
      });
    },
  };
}

interface QuickJsRunOptions {
  readonly memoryLimitBytes: number;
  readonly maxStackBytes: number;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

interface EncodedTemplate {
  readonly __gruntendHtml: true;
  readonly strings: readonly string[];
  readonly values: readonly EncodedValue[];
}

interface EncodedFunction {
  readonly __gruntendFunction: string;
}

type EncodedValue =
  | null
  | undefined
  | string
  | number
  | boolean
  | EncodedFunction
  | EncodedTemplate
  | readonly EncodedValue[]
  | { readonly [key: string]: EncodedValue };

interface EncodedRender {
  readonly __gruntendRender: string;
}

async function executeQuickJsPlan(
  module: QuickJSWASMModule,
  globals: CodePlanExecutionGlobals,
  code: string,
  options: QuickJsRunOptions,
): Promise<unknown> {
  const runtime = module.newRuntime();
  runtime.setMemoryLimit(options.memoryLimitBytes);
  runtime.setMaxStackSize(options.maxStackBytes);

  let deadline = Date.now() + options.timeoutMs;
  runtime.setInterruptHandler(
    () => options.signal?.aborted === true || Date.now() > deadline,
  );

  const vm = runtime.newContext();
  const pending = new Set<QuickJSDeferredPromise>();
  let disposed = false;
  let backgroundError: Error | undefined;

  const resetDeadline = () => {
    deadline = Date.now() + options.timeoutMs;
  };

  const drainJobs = () => {
    if (disposed) return;
    const result = runtime.executePendingJobs();
    if (result.error) {
      const errorHandle = result.error;
      const dumped = vm.dump(errorHandle);
      errorHandle.dispose();
      backgroundError = toGuestError(dumped);
    }
  };

  const destroy = () => {
    if (disposed) return;
    disposed = true;
    for (const deferred of pending) deferred.dispose();
    pending.clear();
    vm.dispose();
    runtime.dispose();
  };

  try {
    installValueGlobal(vm, "input", globals.input);
    installHostObject(vm, "tools", globals.tools, pending, drainJobs);
    installConsole(vm, "console", globals.console);
    evaluateVoid(vm, guestBootstrap);

    resetDeadline();
    const resultPromise = evaluate(
      vm,
      `(async () => {\n${stripMarkdownFence(code)}\n})().then(globalThis.__gruntendEncodeResult)`,
      "gruntend-plan.js",
    );

    let encoded: QuickJSHandle;
    try {
      encoded = await resolveGuestPromise(
        vm,
        runtime,
        resultPromise,
        drainJobs,
      );
    } finally {
      resultPromise.dispose();
    }
    if (backgroundError) {
      encoded.dispose();
      throw backgroundError;
    }

    const dumped = vm.dump(encoded) as EncodedValue | EncodedRender;
    encoded.dispose();

    if (isEncodedRender(dumped)) {
      return createQuickJsRenderSource({
        vm,
        runtime,
        renderId: dumped.__gruntendRender,
        resetDeadline,
        drainJobs,
        destroy,
        isDisposed: () => disposed,
      });
    }

    if (isEncodedTemplate(dumped)) {
      return createQuickJsRenderSource({
        vm,
        runtime,
        template: dumped,
        resetDeadline,
        drainJobs,
        destroy,
        isDisposed: () => disposed,
      });
    }

    const decoded = decodeDataValue(dumped);
    destroy();
    return decoded;
  } catch (error) {
    destroy();
    if (options.signal?.aborted) {
      throw new CodePlanExecutorError(
        "executor_aborted",
        "Code plan execution aborted.",
      );
    }
    if (error instanceof CodePlanExecutorError) throw error;
    throw new CodePlanExecutorError(
      "executor_execution_failed",
      errorMessage(error),
    );
  }
}

function installValueGlobal(
  vm: QuickJSContext,
  name: string,
  value: unknown,
): void {
  const handle = hostValueToGuest(vm, value, new Set());
  try {
    vm.setProp(vm.global, name, handle);
  } finally {
    handle.dispose();
  }
}

function installHostObject(
  vm: QuickJSContext,
  name: string,
  value: Record<string, unknown>,
  pending: Set<QuickJSDeferredPromise>,
  drainJobs: () => void,
): void {
  const handle = createHostObject(vm, value, pending, drainJobs, new Set());
  try {
    vm.setProp(vm.global, name, handle);
  } finally {
    handle.dispose();
  }
}

function createHostObject(
  vm: QuickJSContext,
  value: Record<string, unknown>,
  pending: Set<QuickJSDeferredPromise>,
  drainJobs: () => void,
  path: Set<object>,
): QuickJSHandle {
  if (path.has(value)) {
    throw new TypeError("Executor globals cannot contain cyclic objects.");
  }
  path.add(value);

  const objectHandle = vm.newObject();
  try {
    for (const [key, child] of Object.entries(value)) {
      let childHandle: QuickJSHandle;
      if (typeof child === "function") {
        childHandle = vm.newFunction(key, (...args) => {
          const deferred = vm.newPromise();
          pending.add(deferred);
          void deferred.settled.finally(() => {
            pending.delete(deferred);
            deferred.dispose();
          });
          let hostResult: unknown;
          try {
            hostResult = child(...args.map((arg) => dumpGuestValue(vm, arg)));
          } catch (error) {
            rejectDeferred(vm, deferred, error, drainJobs);
            return deferred.handle;
          }

          void Promise.resolve(hostResult).then(
            (result) => {
              if (!deferred.alive) return;
              const resultHandle = hostValueToGuest(vm, result, new Set());
              try {
                deferred.resolve(resultHandle);
              } finally {
                resultHandle.dispose();
                drainJobs();
              }
            },
            (error) => rejectDeferred(vm, deferred, error, drainJobs),
          );
          return deferred.handle;
        });
      } else if (isRecord(child)) {
        childHandle = createHostObject(vm, child, pending, drainJobs, path);
      } else {
        childHandle = hostValueToGuest(vm, child, new Set());
      }

      try {
        vm.setProp(objectHandle, key, childHandle);
      } finally {
        childHandle.dispose();
      }
    }
    return objectHandle;
  } catch (error) {
    objectHandle.dispose();
    throw error;
  } finally {
    path.delete(value);
  }
}

function installConsole(
  vm: QuickJSContext,
  name: string,
  consoleValue: CodePlanExecutionGlobals["console"],
): void {
  const consoleHandle = vm.newObject();
  try {
    for (const level of ["debug", "log", "info", "warn", "error"] as const) {
      const method = vm.newFunction(level, (...args) => {
        consoleValue[level](...args.map((arg) => dumpGuestValue(vm, arg)));
      });
      try {
        vm.setProp(consoleHandle, level, method);
      } finally {
        method.dispose();
      }
    }
    vm.setProp(vm.global, name, consoleHandle);
  } finally {
    consoleHandle.dispose();
  }
}

function rejectDeferred(
  vm: QuickJSContext,
  deferred: QuickJSDeferredPromise,
  error: unknown,
  drainJobs: () => void,
): void {
  if (!deferred.alive) return;
  const errorHandle = vm.newError(errorMessage(error));
  try {
    deferred.reject(errorHandle);
  } finally {
    errorHandle.dispose();
    drainJobs();
  }
}

function hostValueToGuest(
  vm: QuickJSContext,
  value: unknown,
  path: Set<object>,
): QuickJSHandle {
  if (value === undefined) return vm.undefined.dup();
  if (value === null) return vm.null.dup();
  if (typeof value === "string") return vm.newString(value);
  if (typeof value === "number") return vm.newNumber(value);
  if (typeof value === "boolean") return (value ? vm.true : vm.false).dup();
  if (typeof value === "bigint") return vm.newBigInt(value);
  if (typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`Unsupported executor value: ${typeof value}.`);
  }
  if (!isRecord(value) && !Array.isArray(value)) {
    throw new TypeError("Executor values must be plain objects or arrays.");
  }
  if (path.has(value)) {
    throw new TypeError("Executor values cannot contain cycles.");
  }
  path.add(value);

  const handle = Array.isArray(value) ? vm.newArray() : vm.newObject();
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const child = hostValueToGuest(vm, value[index], path);
        try {
          vm.setProp(handle, index, child);
        } finally {
          child.dispose();
        }
      }
    } else {
      for (const [key, item] of Object.entries(value)) {
        if (typeof item === "function" || typeof item === "symbol") continue;
        const child = hostValueToGuest(vm, item, path);
        try {
          vm.setProp(handle, key, child);
        } finally {
          child.dispose();
        }
      }
    }
    return handle;
  } catch (error) {
    handle.dispose();
    throw error;
  } finally {
    path.delete(value);
  }
}

function createQuickJsRenderSource(options: {
  readonly vm: QuickJSContext;
  readonly runtime: QuickJSRuntime;
  readonly renderId?: string;
  readonly template?: EncodedTemplate;
  readonly resetDeadline: () => void;
  readonly drainJobs: () => void;
  readonly destroy: () => void;
  readonly isDisposed: () => boolean;
}): UiInterpretedFunction {
  return {
    call() {
      ensureSessionAlive(options.isDisposed());
      if (options.template) {
        return decodeTemplate(options.template, (id, args) =>
          invokeGuestAsync(options, id, args),
        );
      }
      options.resetDeadline();
      const encoded = invokeGuestSync(options, options.renderId ?? "", []);
      if (!isEncodedTemplate(encoded)) {
        throw new TypeError(
          "QuickJS render functions must return an html template.",
        );
      }
      return decodeTemplate(encoded, (id, args) =>
        invokeGuestAsync(options, id, args),
      );
    },
    destroy: options.destroy,
  };
}

function invokeGuestSync(
  options: Parameters<typeof createQuickJsRenderSource>[0],
  id: string,
  args: readonly unknown[],
): EncodedValue {
  ensureSessionAlive(options.isDisposed());
  const helper = options.vm.getProp(options.vm.global, "__gruntendInvokeSync");
  const idHandle = options.vm.newString(id);
  const argsHandle = hostValueToGuest(options.vm, args, new Set());
  try {
    const result = unwrapCall(
      options.vm,
      options.vm.callFunction(
        helper,
        options.vm.undefined,
        idHandle,
        argsHandle,
      ),
    );
    try {
      options.drainJobs();
      return options.vm.dump(result) as EncodedValue;
    } finally {
      result.dispose();
    }
  } finally {
    argsHandle.dispose();
    idHandle.dispose();
    helper.dispose();
  }
}

async function invokeGuestAsync(
  options: Parameters<typeof createQuickJsRenderSource>[0],
  id: string,
  args: readonly unknown[],
): Promise<unknown> {
  ensureSessionAlive(options.isDisposed());
  options.resetDeadline();
  const helper = options.vm.getProp(options.vm.global, "__gruntendInvokeAsync");
  const idHandle = options.vm.newString(id);
  const argsHandle = hostValueToGuest(options.vm, args, new Set());
  try {
    const promiseHandle = unwrapCall(
      options.vm,
      options.vm.callFunction(
        helper,
        options.vm.undefined,
        idHandle,
        argsHandle,
      ),
    );
    try {
      const resolved = await resolveGuestPromise(
        options.vm,
        options.runtime,
        promiseHandle,
        options.drainJobs,
      );
      try {
        return decodeDataValue(options.vm.dump(resolved) as EncodedValue);
      } finally {
        resolved.dispose();
      }
    } finally {
      promiseHandle.dispose();
    }
  } finally {
    argsHandle.dispose();
    idHandle.dispose();
    helper.dispose();
  }
}

function decodeTemplate(
  template: EncodedTemplate,
  invoke: (id: string, args: readonly unknown[]) => Promise<unknown>,
): UiTemplate {
  return {
    strings: [...template.strings],
    values: template.values.map((value) => decodeUiValue(value, invoke)),
  };
}

function decodeUiValue(
  value: EncodedValue,
  invoke: (id: string, args: readonly unknown[]) => Promise<unknown>,
): unknown {
  if (isEncodedFunction(value)) {
    return {
      call(_thisArg: unknown, ...args: readonly unknown[]) {
        return invoke(value.__gruntendFunction, args);
      },
    } satisfies UiInterpretedFunction;
  }
  if (isEncodedTemplate(value)) return decodeTemplate(value, invoke);
  if (Array.isArray(value)) {
    return value.map((item) => decodeUiValue(item, invoke));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        decodeUiValue(item as EncodedValue, invoke),
      ]),
    );
  }
  return value;
}

function decodeDataValue(value: EncodedValue | EncodedRender): unknown {
  if (Array.isArray(value)) return value.map((item) => decodeDataValue(item));
  if (isRecord(value)) {
    if (
      isEncodedFunction(value) ||
      isEncodedTemplate(value) ||
      isEncodedRender(value)
    ) {
      throw new TypeError(
        "Function and template records require generated UI mode.",
      );
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        decodeDataValue(item as EncodedValue),
      ]),
    );
  }
  return value;
}

async function resolveGuestPromise(
  vm: QuickJSContext,
  runtime: QuickJSRuntime,
  promiseHandle: QuickJSHandle,
  drainJobs: () => void,
): Promise<QuickJSHandle> {
  const promise = vm.resolvePromise(promiseHandle);
  drainJobs();
  const result = await promise;
  const value = unwrapCall(vm, result);
  const jobs = runtime.executePendingJobs();
  if (jobs.error) {
    const errorHandle = jobs.error;
    const dumped = vm.dump(errorHandle);
    errorHandle.dispose();
    value.dispose();
    throw toGuestError(dumped);
  }
  return value;
}

function evaluate(
  vm: QuickJSContext,
  code: string,
  filename: string,
): QuickJSHandle {
  return unwrapCall(vm, vm.evalCode(code, filename));
}

function evaluateVoid(vm: QuickJSContext, code: string): void {
  const result = evaluate(vm, code, "gruntend-bootstrap.js");
  result.dispose();
}

function unwrapCall(
  vm: QuickJSContext,
  result:
    | { value: QuickJSHandle; error?: undefined }
    | { error: QuickJSHandle },
): QuickJSHandle {
  if (result.error) {
    const errorHandle = result.error;
    const dumped = vm.dump(errorHandle);
    errorHandle.dispose();
    throw toGuestError(dumped);
  }
  return result.value;
}

function dumpGuestValue(vm: QuickJSContext, handle: QuickJSHandle): unknown {
  try {
    return vm.dump(handle);
  } catch {
    return `[${vm.typeof(handle)}]`;
  }
}

function ensureSessionAlive(disposed: boolean): void {
  if (disposed) throw new Error("QuickJS generated UI session was destroyed.");
}

function isEncodedTemplate(value: unknown): value is EncodedTemplate {
  return (
    isRecord(value) &&
    value.__gruntendHtml === true &&
    Array.isArray(value.strings) &&
    Array.isArray(value.values)
  );
}

function isEncodedFunction(value: unknown): value is EncodedFunction {
  return isRecord(value) && typeof value.__gruntendFunction === "string";
}

function isEncodedRender(value: unknown): value is EncodedRender {
  return isRecord(value) && typeof value.__gruntendRender === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function toGuestError(value: unknown): Error {
  if (isRecord(value) && typeof value.message === "string") {
    const error = new Error(value.message);
    if (typeof value.name === "string") error.name = value.name;
    return error;
  }
  return new Error(errorMessage(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stripMarkdownFence(code: string): string {
  const trimmed = code.trim();
  const match = trimmed.match(
    /^```(?:ts|tsx|js|jsx|javascript|typescript)?\s*([\s\S]*?)\s*```$/,
  );
  return match ? match[1] : code;
}

const guestBootstrap = String.raw`
(() => {
  const retained = new Map();
  let nextFunctionId = 0;

  function retain(fn) {
    const id = "f" + nextFunctionId++;
    retained.set(id, fn);
    return id;
  }

  function encode(value, seen) {
    if (
      value === null ||
      value === undefined ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }
    if (typeof value === "bigint") return String(value);
    if (typeof value === "function") {
      return { __gruntendFunction: retain(value) };
    }
    if (seen.has(value)) throw new TypeError("Cyclic executor values are unsupported.");
    seen.add(value);
    try {
      if (Array.isArray(value)) return value.map(item => encode(item, seen));
      if (value.__gruntendHtml === true) {
        return {
          __gruntendHtml: true,
          strings: value.strings.slice(),
          values: value.values.map(item => encode(item, seen)),
        };
      }
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError("Executor values must be plain objects or arrays.");
      }
      const result = {};
      for (const key of Object.keys(value)) result[key] = encode(value[key], seen);
      return result;
    } finally {
      seen.delete(value);
    }
  }

  globalThis.html = (strings, ...values) => ({
    __gruntendHtml: true,
    strings: Array.from(strings),
    values,
  });
  globalThis.__gruntendEncodeResult = value =>
    typeof value === "function"
      ? { __gruntendRender: retain(value) }
      : encode(value, new Set());
  globalThis.__gruntendInvokeSync = (id, args) =>
    encode(retained.get(id)(...args), new Set());
  globalThis.__gruntendInvokeAsync = (id, args) =>
    Promise.resolve(retained.get(id)(...args)).then(value => encode(value, new Set()));
})();
`;
