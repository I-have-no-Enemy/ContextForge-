import { z } from 'zod';

export const listSubmissionsQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  limit: z.string().optional().transform((v) => (v ? Math.min(100, Math.max(1, parseInt(v, 10))) : 20)),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  flagged_by_scan: z.enum(['true', 'false']).optional().transform((v) => {
    if (v === 'true') return true;
    if (v === 'false') return false;
    return undefined;
  }),
  item_type: z.enum(['server', 'skill']).optional(),
});

export const reviewSubmissionSchema = z.object({
  item_type: z.enum(['server', 'skill'], {
    errorMap: () => ({ message: "item_type must be either 'server' or 'skill'" }),
  }),
  item_id: z.string().uuid('Invalid item UUID'),
  status: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: "status must be either 'approved' or 'rejected'" }),
  }),
  review_notes: z.string().optional(),
});

export const emergencyTakedownSchema = z.object({
  item_type: z.enum(['server', 'skill'], {
    errorMap: () => ({ message: "item_type must be either 'server' or 'skill'" }),
  }),
  item_id: z.string().uuid('Invalid item UUID'),
  reason: z.string().min(5, 'Reason must be at least 5 characters long'),
});

export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;
export type EmergencyTakedownInput = z.infer<typeof emergencyTakedownSchema>;
