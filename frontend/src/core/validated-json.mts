import {
  SchemaValidationError,
  parseWithSchema
} from "../generated/shared-runtime-validation.mjs";

type ValidationSchema<T> = {
  safeParse(input: unknown):
    | { success: true; data: T }
    | { success: false; error: unknown };
};

export async function readValidatedJson<T>(
  response: Response,
  schema: ValidationSchema<T>,
  fallbackMessage: string,
  schemaName: string
): Promise<T> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error: unknown) {
    throw new Error(fallbackMessage, {
      cause: error
    });
  }

  try {
    return parseWithSchema(schema, payload, {
      schemaName,
      message: fallbackMessage
    });
  } catch (error: unknown) {
    if (error instanceof SchemaValidationError) {
      throw new Error(fallbackMessage, {
        cause: error
      });
    }

    throw error;
  }
}
