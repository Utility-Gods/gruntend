export type MaybePromise<T> = T | Promise<T>;

export namespace StandardSchemaV1 {
  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: readonly Issue[];
  }

  export interface Issue {
    readonly message: string;
    readonly path?: readonly (PropertyKey | PathSegment)[];
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }
}

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => MaybePromise<StandardSchemaV1.Result<Output>>;
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
  };
}

export type InferSchemaInput<TSchema> = TSchema extends StandardSchemaV1<
  infer Input,
  unknown
> ? Input
  : unknown;

export type InferSchemaOutput<TSchema> = TSchema extends StandardSchemaV1<
  unknown,
  infer Output
> ? Output
  : unknown;

export type ToolExecutionMode = "sequential" | "parallel";

export interface ToolExecutionContext<Input, Context = unknown> {
  readonly input: Input;
  readonly context?: Context;
  readonly signal?: AbortSignal;
}

export interface ToolResult<Output> {
  readonly data: Output;
}

export type ToolExecute<Input, Output, Context = unknown> = (
  context: ToolExecutionContext<Input, Context>,
) => MaybePromise<ToolResult<Output>>;

export interface Tool<
  InputSchema extends StandardSchemaV1 = StandardSchemaV1,
  OutputSchema extends StandardSchemaV1 = StandardSchemaV1,
  Context = unknown,
> {
  readonly name: string;
  readonly description: string;
  readonly input: InputSchema;
  readonly output: OutputSchema;
  readonly execution?: ToolExecutionMode;
  readonly execute: ToolExecute<
    InferSchemaOutput<InputSchema>,
    InferSchemaOutput<OutputSchema>,
    Context
  >;
}

export function defineTool<
  const InputSchema extends StandardSchemaV1,
  const OutputSchema extends StandardSchemaV1,
  Context = unknown,
>(tool: Tool<InputSchema, OutputSchema, Context>): Tool<InputSchema, OutputSchema, Context> {
  return tool;
}
