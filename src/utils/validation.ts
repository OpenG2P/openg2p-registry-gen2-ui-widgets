import { z } from 'zod';
import { WidgetValidation, WidgetDataPath } from '../types';

/**
 * Validate value against validation rules
 */
export const validateWidget = (
  value: any,
  validation: WidgetValidation | undefined,
  required: boolean = false
): string[] => {
  const errors: string[] = [];

  if (!validation && !required) {
    return errors;
  }

  // Check required
  const isRequired = validation?.required ?? required;
  if (isRequired && (value === null || value === undefined || value === '')) {
    errors.push('This field is required');
    return errors; // Return early if required field is empty
  }

  // Skip other validations if value is empty and not required
  if (!value && !isRequired) {
    return errors;
  }

  if (!validation) {
    return errors;
  }

  // Pattern validation
  if (validation.pattern && typeof value === 'string') {
    const regex = new RegExp(validation.pattern);
    if (!regex.test(value)) {
      errors.push(validation.patternMessage || 'Invalid format');
    }
  }

  // String length validations
  if (typeof value === 'string') {
    if (validation.minLength && value.length < validation.minLength) {
      errors.push(`Minimum length is ${validation.minLength}`);
    }
    if (validation.maxLength && value.length > validation.maxLength) {
      errors.push(`Maximum length is ${validation.maxLength}`);
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (validation.min !== undefined && value < validation.min) {
      errors.push(`Minimum value is ${validation.min}`);
    }
    if (validation.max !== undefined && value > validation.max) {
      errors.push(`Maximum value is ${validation.max}`);
    }
  }

  // Zod schema validation
  if (validation.zodSchema) {
    try {
      validation.zodSchema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map((e) => e.message));
      } else {
        errors.push('Validation failed');
      }
    }
  }

  return errors;
};

/**
 * Create Zod schema from validation config
 */
export const createZodSchema = (
  validation: WidgetValidation | undefined,
  required: boolean = false
): z.ZodSchema | null => {
  if (!validation && !required) {
    return null;
  }

  const isRequired = validation?.required ?? required;
  let schema: z.ZodSchema = z.any();

  // String validations
  if (validation?.pattern || validation?.minLength || validation?.maxLength) {
    let stringSchema: z.ZodString = z.string();
    if (validation.pattern) {
      stringSchema = stringSchema.regex(new RegExp(validation.pattern));
    }
    if (validation.minLength) {
      stringSchema = stringSchema.min(validation.minLength);
    }
    if (validation.maxLength) {
      stringSchema = stringSchema.max(validation.maxLength);
    }
    schema = stringSchema;
  }

  // Number validations
  if (validation?.min !== undefined || validation?.max !== undefined) {
    let numberSchema: z.ZodNumber = z.number();
    if (validation.min !== undefined) {
      numberSchema = numberSchema.min(validation.min);
    }
    if (validation.max !== undefined) {
      numberSchema = numberSchema.max(validation.max);
    }
    schema = numberSchema;
  }

  // Apply required
  if (isRequired) {
    // For string schemas, use min(1) instead of nonempty
    if (schema instanceof z.ZodString) {
      schema = schema.min(1, 'This field is required');
    }
    // For other types, they're already required by default
  } else {
    schema = schema.optional();
  }

  return schema;
};

