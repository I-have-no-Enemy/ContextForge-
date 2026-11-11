import type { AiSkill, McpServer, Pagination } from '../services/api';
import { scrollPageTo } from './smoothScroll';

/**
 * What the landing page shows when the user comes back to it from a detail page: the scroll position, the tab,
 * search and page they had, and the lists themselves (so the page has the same height at once and the saved
 * position lands exactly). Lives in module scope for the length of the visit; a reload starts fresh.
 */
export interface BrowseUi {
  tab: 'servers' | 'skills';
  search: string;
  client: string;
  page: { servers: number; skills: number };
}

export const browseMemory = {
  y: 0,
  ui: null as BrowseUi | null,
  lists: null as { servers: McpServer[]; skills: AiSkill[]; meta: { servers?: Pagination; skills?: Pagination } } | null,
  laneServers: null as McpServer[] | null,
};

/** "Browse" in the navigation means start over: forget the saved place and go to the top. */
export function resetBrowse() {
  browseMemory.y = 0;
  browseMemory.ui = null;
  scrollPageTo(0);
}
