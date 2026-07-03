<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";

  type ButtonVariant = "default" | "primary" | "secondary" | "ghost" | "primary-outline" | "danger";
  type ButtonSize = "xs" | "sm" | "md" | "lg";
  type Props = Omit<HTMLButtonAttributes, "class"> &
    Omit<HTMLAnchorAttributes, "class"> & {
      readonly href?: string;
      readonly variant?: ButtonVariant;
      readonly size?: ButtonSize;
      readonly class?: string;
      readonly children?: Snippet;
    };

  let {
    href,
    variant = "default",
    size = "md",
    type = "button",
    disabled = false,
    class: className = "",
    children,
    ...rest
  }: Props = $props();

  const classes = $derived(`ps-button ps-button-${variant} ps-button-${size} ${className}`.trim());
</script>

{#if href}
  <a {href} class={classes} aria-disabled={disabled ? "true" : undefined} {...rest}>
    {@render children?.()}
  </a>
{:else}
  <button {type} class={classes} {disabled} {...rest}>
    {@render children?.()}
  </button>
{/if}
