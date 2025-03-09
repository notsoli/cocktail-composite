<script lang="ts">
    import { type Output } from "$lib/scripts/tree.svelte";
    import { isCompatible, isAdjacent } from "$lib/scripts/editor.svelte";
    import { editor } from "$lib/scripts/editor.svelte";
    import type { Node } from "$lib/scripts/tree.svelte";

    // state
    const { output, node } : { output: Output, node: Node } = $props();

    const selected = $derived( editor.selectedOutput?.output === output );
    const compatible = $derived(
        editor.selectedInput &&
        isCompatible(editor.selectedInput.input, output) &&
        isAdjacent(node, editor.selectedInput.node)
    );
    
    function selectOutput(e: MouseEvent) {
        e.stopPropagation();
        if (!editor.selectedInput) {
            editor.selectedOutput = { output, node };
        } else {
            editor.selectedInput.input.value = output;
            editor.selectedInput = null;
            editor.selectedOutput = null;
        }
    }
</script>

<button
    aria-label={`${output.display_name} output connector`}
    onclick={selectOutput}
    class={{ selected, compatible }}
    disabled={editor.selectedInput && !compatible}
></button>

<style>
    button {
        width: calc( 1em + 2 * var(--border-width));
        height: calc( 1em + 2 * var(--border-width));
        border-radius: 50%;
        border: var(--border-width) solid var(--background-color);
    }

    .selected, .compatible, button:hover {
        outline: var(--border-width) solid var(--accent-color);
    }
</style>