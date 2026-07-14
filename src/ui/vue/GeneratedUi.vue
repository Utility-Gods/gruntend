<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  watch,
} from "vue";
import type {
  GeneratedUiActionEndEvent,
  GeneratedUiActionEvent,
  GeneratedUiRenderer,
  GeneratedUiRenderSession,
} from "../../renderer.ts";
import type {
  GeneratedUi as GeneratedUiController,
  GeneratedUiFrame,
} from "../index.ts";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  readonly ui: GeneratedUiController;
  readonly renderer: GeneratedUiRenderer<HTMLDivElement>;
  readonly className?: string;
}>();

const emit = defineEmits<{
  error: [error: unknown];
  render: [frame: GeneratedUiFrame];
  "action-start": [event: GeneratedUiActionEvent];
  "action-end": [event: GeneratedUiActionEndEvent];
}>();

const attrs = useAttrs();
const root = ref<HTMLDivElement | null>(null);
const running = ref(false);
const surfaceError = ref("");
let mounted: GeneratedUiRenderSession | undefined;

const rootClass = computed(() => [
  "generated-ui-shell",
  attrs.class,
  props.className,
]);

onMounted(() => {
  if (!root.value) return;

  mounted = props.renderer.mount(root.value, props.ui, {
    onError(error) {
      surfaceError.value = errorText(error);
      emit("error", error);
    },
    onRender(frame) {
      surfaceError.value = "";
      emit("render", frame);
    },
    onActionStart(event) {
      running.value = true;
      emit("action-start", event);
    },
    onActionEnd(event) {
      running.value = false;
      emit("action-end", event);
    },
  });
});

watch(
  () => props.ui,
  (nextUi) => {
    mounted?.update(nextUi);
  },
);

onBeforeUnmount(() => {
  mounted?.destroy();
  mounted = undefined;
});

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
</script>

<template>
  <div :class="rootClass">
    <div ref="root" class="generated-ui"></div>
    <p v-if="running" class="generated-ui-status">
      Running generated action...
    </p>
    <p v-if="surfaceError" class="generated-ui-error">{{ surfaceError }}</p>
  </div>
</template>
