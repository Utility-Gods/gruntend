<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import type {
    GeneratedUi as GeneratedUiController,
    GeneratedUiFrame,
  } from "../index.ts";
  import {
    mountGeneratedUi,
    type GeneratedUiActionEndEvent,
    type GeneratedUiActionEvent,
    type GeneratedUiMountHandle,
  } from "../dom.ts";

  type Props = {
    readonly ui: GeneratedUiController;
    readonly class?: string;
    readonly onError?: (error: unknown) => void;
    readonly onRender?: (frame: GeneratedUiFrame) => void;
    readonly onActionStart?: (event: GeneratedUiActionEvent) => void;
    readonly onActionEnd?: (event: GeneratedUiActionEndEvent) => void;
  };

  let {
    ui,
    class: className = "",
    onError,
    onRender,
    onActionStart,
    onActionEnd,
  }: Props = $props();

  let running = $state(false);
  let surfaceError = $state("");
  let mounted: GeneratedUiMountHandle | undefined;
  let mountedUi: GeneratedUiController | undefined;

  const attachGeneratedUi: Attachment<HTMLDivElement> = (node) => {
    mountedUi = ui;
    mounted = mountGeneratedUi(node, ui, {
      onError(error) {
        surfaceError = errorText(error);
        onError?.(error);
      },
      onRender(frame) {
        surfaceError = "";
        onRender?.(frame);
      },
      onActionStart(event) {
        running = true;
        onActionStart?.(event);
      },
      onActionEnd(event) {
        running = false;
        onActionEnd?.(event);
      },
    });

    return () => {
      mounted?.destroy();
      mounted = undefined;
      mountedUi = undefined;
    };
  };

  $effect(() => {
    if (!mounted || mountedUi === ui) return;

    mountedUi = ui;
    mounted.update(ui);
  });

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
</script>

<div class={`generated-ui-shell ${className}`.trim()}>
  <div {@attach attachGeneratedUi} class="generated-ui"></div>
  {#if running}
    <p class="generated-ui-status">Running generated action...</p>
  {/if}
  {#if surfaceError}
    <p class="generated-ui-error">{surfaceError}</p>
  {/if}
</div>
