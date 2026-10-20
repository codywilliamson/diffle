// runs a command and kills it only when it stops producing output for idleMs. a fixed deadline
// around a many-step script fails on a loaded machine even though every step is still moving;
// a real hang produces no output and still dies after one idle window.

export interface IdleRun { stdout: string; timedOut: boolean }

export async function runUntilIdle(
  cmd: string[],
  options: { cwd: string; env: Record<string, string>; idleMs: number },
): Promise<IdleRun> {
  const proc = Bun.spawn(cmd, { cwd: options.cwd, env: options.env, stdout: "pipe", stderr: "ignore", stdin: "ignore" });
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { timedOut = true; proc.kill(); }, options.idleMs);
  };
  arm();
  const decoder = new TextDecoder();
  let stdout = "";
  // the watchdog stays armed until the process has exited, so a child that closes stdout and hangs still dies
  try {
    for await (const chunk of proc.stdout) {
      stdout += decoder.decode(chunk, { stream: true });
      arm();
    }
    await proc.exited;
  } finally {
    clearTimeout(timer!);
  }
  return { stdout, timedOut };
}
