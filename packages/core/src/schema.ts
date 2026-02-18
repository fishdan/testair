import { z } from 'zod';

const secretPlaceholderSchema = z.string().min(1);

export const gotoStepSchema = z.object({
  type: z.literal('goto'),
  url: z.string().url()
});

export const clickStepSchema = z.object({
  type: z.literal('click'),
  target: z.string().min(1),
  selector: z.string().min(1).optional()
});

export const fillStepSchema = z.object({
  type: z.literal('fill'),
  field: z.string().min(1),
  value: secretPlaceholderSchema,
  selector: z.string().min(1).optional()
});

export const expectStepSchema = z
  .object({
    type: z.literal('expect'),
    textVisible: z.string().min(1).optional(),
    urlIncludes: z.string().min(1).optional(),
    elementVisible: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().max(60000).optional()
  })
  .superRefine((value, ctx) => {
    const keys = [value.textVisible, value.urlIncludes, value.elementVisible].filter(Boolean);
    if (keys.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'expect step must set exactly one of textVisible, urlIncludes, or elementVisible'
      });
    }
  });

export const loginStepSchema = z.object({
  type: z.literal('login'),
  username: secretPlaceholderSchema,
  password: secretPlaceholderSchema
});

export const waitForStepSchema = z
  .object({
    type: z.literal('waitFor'),
    textVisible: z.string().min(1).optional(),
    selector: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().max(120000).optional()
  })
  .superRefine((value, ctx) => {
    const keys = [value.textVisible, value.selector, value.timeoutMs].filter((entry) => entry !== undefined);
    if (keys.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'waitFor step must set exactly one of textVisible, selector, or timeoutMs'
      });
    }
  });

export const stepSchema = z.union([
  gotoStepSchema,
  clickStepSchema,
  fillStepSchema,
  expectStepSchema,
  loginStepSchema,
  waitForStepSchema
]);

export const planSchema = z.object({
  version: z.literal('1'),
  name: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  steps: z.array(stepSchema).min(1)
});

export type GotoStep = z.infer<typeof gotoStepSchema>;
export type ClickStep = z.infer<typeof clickStepSchema>;
export type FillStep = z.infer<typeof fillStepSchema>;
export type ExpectStep = z.infer<typeof expectStepSchema>;
export type LoginStep = z.infer<typeof loginStepSchema>;
export type WaitForStep = z.infer<typeof waitForStepSchema>;
export type TestStep = z.infer<typeof stepSchema>;
export type TestPlan = z.infer<typeof planSchema>;
