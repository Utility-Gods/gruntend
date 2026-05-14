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

export interface ToolHandlerContext<Input> {
  readonly input: Input;
  readonly signal?: AbortSignal;
}

export interface ToolResult<Output> {
  readonly data: Output;
}

export type ToolHandler<Input, Output> = (
  context: ToolHandlerContext<Input>,
) => MaybePromise<ToolResult<Output>>;

export interface Tool<
  Name extends string = string,
  InputSchema extends StandardSchemaV1 = StandardSchemaV1,
  OutputSchema extends StandardSchemaV1 = StandardSchemaV1,
> {
  readonly name: Name;
  readonly description: string;
  readonly input: InputSchema;
  readonly output: OutputSchema;
  readonly execution?: ToolExecutionMode;
}

export type ToolHandlerFor<TTool extends Tool> = ToolHandler<
  InferSchemaOutput<TTool["input"]>,
  InferSchemaOutput<TTool["output"]>
>;

export type ToolHandlerMap<TTools extends readonly Tool[]> = ToolHandlerMapFor<TTools[number]>;

type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends
  (value: infer Intersection) => void ? Intersection
  : never;

export type ToolHandlerMapFor<TTool extends Tool> = UnionToIntersection<
  TTool extends Tool ? { readonly [Name in TTool["name"]]: ToolHandlerFor<TTool> } : never
>;

export interface StandardSchemaValidationError extends Error {
  readonly issues: readonly StandardSchemaV1.Issue[];
}

export function defineTool<
  const Name extends string,
  const InputSchema extends StandardSchemaV1,
  const OutputSchema extends StandardSchemaV1,
>(tool: Tool<Name, InputSchema, OutputSchema>): Tool<Name, InputSchema, OutputSchema> {
  return tool;
}

export async function parseStandardSchema<TSchema extends StandardSchemaV1>(
  schema: TSchema,
  value: unknown,
): Promise<InferSchemaOutput<TSchema>> {
  const result = await schema["~standard"].validate(value);

  if (result.issues) {
    const error = new Error("Standard Schema validation failed.") as StandardSchemaValidationError;
    Object.defineProperty(error, "issues", {
      value: result.issues,
      enumerable: true,
    });
    throw error;
  }

  return result.value as InferSchemaOutput<TSchema>;
}
