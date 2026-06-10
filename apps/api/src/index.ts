import { app } from './app';

app.listen(process.env.PORT || 3005);

console.log(`API Elysia Server listening on port ${app.server?.port}`);

export type App = typeof app;
