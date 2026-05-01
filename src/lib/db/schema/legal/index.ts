// ---------------------------------------------------------------------------
// Legal schema barrel — re-exports all tables for Drizzle config + queries
// Path: src/lib/db/schema/legal/index.ts
// ---------------------------------------------------------------------------

export {
  userProfiles,
} from "./user-profiles";

export {
  projects,
  projectSubfolders,
} from "./projects";

export {
  documents,
  documentVersions,
  documentEdits,
} from "./documents";

export {
  chats,
  chatMessages,
} from "./chats";

export {
  workflows,
  hiddenWorkflows,
  workflowShares,
} from "./workflows";

export {
  tabularReviews,
  tabularCells,
  tabularReviewChats,
  tabularReviewChatMessages,
} from "./tabular-reviews";
