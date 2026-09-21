<script lang="ts">
  import type { UpdateStatus } from "$types";
  import { getUpdate } from "$lib/api/meta";

  const POLL_MS = 600_000; // 10 minutes
  let status = $state<UpdateStatus | null>(null);

  $effect(() => {
    let alive = true;
    const check = (): void => {
      getUpdate()
        .then((s) => {
          if (alive) status = s;
        })
        .catch(() => {});
    };
    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  });
</script>

{#if status?.behind}
  <a
    class="rounded-full bg-mod-badge-bg px-2 py-0.5 text-xs text-mod-badge-text hover:opacity-90"
    href="https://github.com/codywilliamson/diffle/releases"
    target="_blank"
    rel="noopener"
    title="A newer release ({status.latest}) is available"
  >Update {status.latest}</a>
{/if}
