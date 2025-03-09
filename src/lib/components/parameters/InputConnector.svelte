<script lang="ts">
    import { isCompatible, type Input } from "$lib/scripts/tree.svelte";
    const { input } : { input: Input} = $props();
    import { editor } from "$lib/scripts/editor.svelte";

    const selected = $derived( editor.selectedInput === input );
    const compatible = $derived( editor.selectedOutput && isCompatible(input, editor.selectedOutput) );
    
    function selectInput(e: MouseEvent) {
        e.stopPropagation();
        if (!editor.selectedOutput) {
            editor.selectedInput = input;
        } else {
            input.value = editor.selectedOutput;
            editor.selectedOutput = null;
            editor.selectedInput = null;
        }
    }
</script>

<button
    aria-label={`${input.display_name} input connector`}
    onclick={selectInput}
    class={{ selected, compatible }}
    disabled={editor.selectedOutput && !compatible}
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