<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type CardVariant = "default" | "soft" | "primary" | "danger";
  type Props = Omit<HTMLAttributes<HTMLDivElement>, "class"> & {
    readonly variant?: CardVariant;
    readonly interactive?: boolean;
    readonly class?: string;
    readonly children?: Snippet;
  };

  let { variant = "default", interactive = false, class: className = "", children, ...rest }: Props = $props();

  const classes = $derived(
    `ps-card ps-card-${variant} ${interactive ? "ps-card-interactive" : ""} ${className}`.trim(),
  );
</script>

<div class={classes} {...rest}>
  {@render children?.()}
</div>
