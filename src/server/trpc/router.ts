import { router } from "./trpc";
import { userRouter } from "./routers/user";
import { clientsRouter } from "./routers/clients";
import { projectsRouter } from "./routers/projects";
import { chatsRouter } from "./routers/chats";
import { documentsRouter } from "./routers/documents";
import { workflowsRouter } from "./routers/workflows";
import { activityLogRouter } from "./routers/activity-log";

export const appRouter = router({
  user: userRouter,
  clients: clientsRouter,
  projects: projectsRouter,
  chats: chatsRouter,
  documents: documentsRouter,
  workflows: workflowsRouter,
  activityLog: activityLogRouter,
});

export type AppRouter = typeof appRouter;