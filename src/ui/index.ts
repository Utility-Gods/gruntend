import { Result, type Result as BetterResult } from "better-result";
import {
  compileUiTemplate,
  createUiComponent,
  createUiTemplateTag,
  type UiComponentCreateError,
  type UiEventHandler,
  type UiTemplate,
  type UiTemplateCompileError,
  type UiTemplateCompileOutcome,
  type UiTemplateCompileResult,
  type UiTemplateTag,
} from "../ui-runtime.ts";

export type HtmlTemplate = UiTemplate;
export type HtmlTag = UiTemplateTag;
export type GeneratedUiEventHandler = UiEventHandler;
export type GeneratedUiFrame = UiTemplateCompileResult;
export type GeneratedUiRenderError = UiTemplateCompileError;
export type GeneratedUiRenderOutcome = UiTemplateCompileOutcome;

export interface GeneratedUi {
  render(): GeneratedUiRenderOutcome;
  runHandler(handlerId: string, ...args: readonly unknown[]): unknown;
  destroy(): void;
}

export interface GeneratedUiCreateError {
  readonly code: UiComponentCreateError["code"];
  readonly message: string;
}

export type GeneratedUiCreateOutcome = BetterResult<
  GeneratedUi,
  GeneratedUiCreateError
> & {
  unwrapError(): GeneratedUiCreateError;
};

export function createHtmlTag(): HtmlTag {
  return createUiTemplateTag();
}

export function compileHtmlTemplate(
  template: HtmlTemplate,
): GeneratedUiRenderOutcome {
  return compileUiTemplate(template);
}

export function createGeneratedUi(value: unknown): GeneratedUiCreateOutcome {
  const component = createUiComponent(value);

  if (Result.isError(component)) {
    return generatedUiErr(component.unwrapError());
  }

  return generatedUiOk({
    render() {
      return component.value.render();
    },
    runHandler(handlerId, ...args) {
      return component.value.dispatch(handlerId, ...args);
    },
    destroy() {
      component.value.destroy();
    },
  });
}

function generatedUiOk(value: GeneratedUi): GeneratedUiCreateOutcome {
  return Object.assign(Result.ok(value), {
    unwrapError() {
      throw new Error("Cannot unwrap error from an ok result.");
    },
  });
}

function generatedUiErr(
  error: GeneratedUiCreateError,
): GeneratedUiCreateOutcome {
  return Object.assign(Result.err(error), {
    unwrapError() {
      return error;
    },
  });
}
