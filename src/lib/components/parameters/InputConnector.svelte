<script lang="ts">
    import { type Input } from "$lib/scripts/tree.svelte";
    import { isCompatible, isAdjacent } from "$lib/scripts/editor.svelte";
    import { editor } from "$lib/scripts/editor.svelte";
    import type { Node } from "$lib/scripts/tree.svelte";
    import { tick } from "svelte";

    const { input, node } : { input: Input, node: Node } = $props();
    let connector: HTMLButtonElement;

    const selected = $derived( editor.selectedInput?.input === input );
    const compatible = $derived(
        editor.selectedOutput &&
        isCompatible(input, editor.selectedOutput.output) &&
        isAdjacent(node, editor.selectedOutput.node)
    );
    
    function selectInput(e: MouseEvent) {
        e.stopPropagation();
        if (!editor.selectedOutput) {
            editor.selectedInput = { input, node };
        } else {
            input.value = editor.selectedOutput.output;
            editor.selectedOutput = null;
            editor.selectedInput = null;
        }
    }

    $effect(() => {
        if (typeof input.value === "object" && "text" in input.value) {
            addLinkedConnector();
            return removeLinkedConnector;
        }
    });

    async function addLinkedConnector() {
        if (typeof input.value !== "object" || !("text" in input.value)) return;
        await tick();
        const output_connector = document.querySelector<HTMLButtonElement>(`[data-connector="${input.value.text}"]`);
        if (output_connector) {
            editor.linkedConnectors = [
                ...editor.linkedConnectors,
                { c1: connector, c2: output_connector, input}
            ];
        }
    }

    function removeLinkedConnector() {
        editor.linkedConnectors = editor.linkedConnectors.filter(
            ({ c1 }) => c1 !== connector
        );
    }
</script>

<button
    aria-label={`${input.display_name} input connector`}
    onclick={selectInput}
    class={{ selected, compatible }}
    disabled={editor.selectedOutput && !compatible}
    bind:this={connector}
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