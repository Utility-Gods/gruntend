<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    readonly eyebrow?: string;
    readonly title: string;
    readonly description?: string;
    readonly actions?: Snippet;
  };

  let { eyebrow, title, description, actions }: Props = $props();
</script>

<div class="ps-surface-header">
  <div>
    {#if eyebrow}<p class="ps-eyebrow">{eyebrow}</p>{/if}
    <h2>{title}</h2>
    {#if description}<p>{description}</p>{/if}
  </div>
  {#if actions}
    <div class="ps-surface-actions">
      {@render actions()}
    </div>
  {/if}
</div>
