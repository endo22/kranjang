import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";
import { AppError } from "./app-error.js";

@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    try {
      return this.schema.parse(value);
    } catch (error) {
      const issues =
        error && typeof error === "object" && "issues" in error && Array.isArray(error.issues) ? error.issues : [];

      throw new AppError("VALIDATION_ERROR", "Data tidak valid", 400, { issues });
    }
  }
}
