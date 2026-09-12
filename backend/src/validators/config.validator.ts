import { z } from 'zod';

export const generateConfigSchema = z.object({
  client_type: z.enum(['claude_desktop', 'cursor', 'cline', 'antigravity'], {
    errorMap: () => ({ message: "client_type must be one of: 'claude_desktop', 'cursor', 'cline', 'antigravity'" }),
  }),
  selected_server_ids: z.array(z.string().uuid('Invalid server UUID')).default([]),
  selected_skill_ids: z.array(z.string().uuid('Invalid skill UUID')).default([]),
}).refine(
  (data) => (data.selected_server_ids && data.selected_server_ids.length > 0) || (data.selected_skill_ids && data.selected_skill_ids.length > 0),
  {
    message: 'At least one MCP server or AI skill must be selected.',
    path: ['selected_server_ids'],
  }
);

export const configIdParamSchema = z.object({
  id: z.string().uuid('Invalid config UUID'),
});

export type GenerateConfigInput = z.infer<typeof generateConfigSchema>;
