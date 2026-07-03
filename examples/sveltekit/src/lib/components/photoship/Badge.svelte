<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type BadgeVariant = "default" | "primary" | "secondary" | "success" | "info" | "warning" | "danger";
  type Props = Omit<HTMLAttributes<HTMLSpanElement>, "class"> & {
    readonly variant?: BadgeVariant;
    readonly class?: string;
    readonly children?: Snippet;
  };

  let { variant = "default", class: className = "", children, ...rest }: Props = $props();

  const classes = $derived(`ps-badge ps-badge-${variant} ${className}`.trim());
</script>

<span class={classes} {...rest}>
  {@render children?.()}
</span>
