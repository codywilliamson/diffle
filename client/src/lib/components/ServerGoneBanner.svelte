<script lang="ts">
  import { PRODUCT } from "$product";
  import { getAppState } from "$lib/state/context";

  const { connection } = getAppState();
  // a fixed port is the only way a restart lands on the origin this page can reconnect to.
  const restart = $derived(`${PRODUCT.name}${location.port ? ` --port ${location.port}` : ""}`);
</script>

{#if connection.gone}
  <div role="alert" data-testid="server-gone" class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
    <strong class="font-semibold">The {PRODUCT.name} server is gone.</strong>
    <span class="text-text">Sending feedback and saving comments are off. Run <code class="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">{restart}</code> in your repo and this page reconnects on its own.</span>
  </div>
{/if}
