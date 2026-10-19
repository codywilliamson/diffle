<script lang="ts">
  import Box from "@lucide/svelte/icons/box";
  import Braces from "@lucide/svelte/icons/braces";
  import Cuboid from "@lucide/svelte/icons/cuboid";
  import Hash from "@lucide/svelte/icons/hash";
  import ListTree from "@lucide/svelte/icons/list-tree";
  import Package from "@lucide/svelte/icons/package";
  import SquareFunction from "@lucide/svelte/icons/square-function";
  import Tag from "@lucide/svelte/icons/tag";
  import Type from "@lucide/svelte/icons/type";
  import Variable from "@lucide/svelte/icons/variable";
  import type { Component } from "svelte";

  let { kind }: { kind: string } = $props();

  const ICONS: Record<string, Component<{ size?: number; class?: string }>> = {
    class: Box,
    interface: Braces,
    struct: Cuboid,
    enum: ListTree,
    enummember: Hash,
    method: SquareFunction,
    function: SquareFunction,
    constructor: SquareFunction,
    property: Tag,
    field: Tag,
    variable: Variable,
    constant: Variable,
    namespace: Package,
    module: Package,
    package: Package,
    typeparameter: Type,
  };
  const Icon = $derived(ICONS[kind.toLowerCase().replace(/[\s_-]/g, "")] ?? Hash);
</script>

<span class="grid size-5 shrink-0 place-items-center text-accent" title={kind} data-symbol-kind={kind}><Icon size={14} /></span>
