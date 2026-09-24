// Next.js sunucusu açılırken bir kez çalışır (Node runtime).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerBotCommands } = await import("@/lib/telegram-tasks");
  await registerBotCommands();
}
