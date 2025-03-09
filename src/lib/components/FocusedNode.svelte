<script lang="ts">
    import { tree, formatOutputToColor, removeNode, type Node } from "$lib/scripts/tree.svelte";
    import { build } from "$lib/scripts/builder";
    import { editor } from "$lib/scripts/editor.svelte";
    import InputConnector from "./parameters/InputConnector.svelte";
    import OutputConnector from "./parameters/OutputConnector.svelte";

    // components
    import NumberParameter from "./parameters/NumberParameter.svelte";
    import DisplayParameter from "./parameters/DisplayParameter.svelte";
    import { createPass, removePass, type Pass } from "devolute";
    import type { NumberInputConfig } from "$lib/scripts/config";

    // state
    const { node }: { node: Node } = $props();
    const config = $derived(tree.configs[node.name]);
    let canvas: HTMLCanvasElement;

    $effect(() => {
        // set canvas dimensions
        canvas.width = 175;
        canvas.height = 175;

        // generate a fragment shader
        const returnValue = formatOutputToColor(node.outputs[Object.keys(node.outputs)[0]]);
        const frag = build(node, returnValue, tree.configs);
        if (!frag) return;

        // create a pass
        let pass: Pass;
        createPass({
            canvas,
            uniforms: {
                res: { type: "vec2f", value: [ 175, 175 ] }
            },
            fragment: frag
        }).then((passInfo) => {
            pass = passInfo.pass;
        });

        // remove the pass when the node or configs change
        return () => {
            removePass(pass);
        };
    });
</script>

<div class="node">
    <div class="node-connectors">
        {#each Object.values(node.outputs) as output}
            <OutputConnector {output} />
        {/each}
    </div>
    <div class="node-header">
        <button
            aria-label="remove node"
            class="remove-node-button"
            onclick={() => {
                editor.focusedNode = removeNode(node);

            }}
        >X</button>
        <h2>{node.display_name}</h2>
    </div>
    <canvas bind:this={canvas}></canvas>
    <div class="node-parameters">
        {#each Object.keys(node.inputs) as key}
            <div class="input">
                <h2>{node.inputs[key].display_name}</h2>
                {#if node.inputs[key].input_type === "number"}
                    <NumberParameter
                        input={node.inputs[key]}
                        config={config.inputs![key] as NumberInputConfig}
                    />
                {:else if node.inputs[key].input_type === "display"}
                    <DisplayParameter
                        input={node.inputs[key]}
                        {node}
                    />
                {/if}
                <div class="input-connector">
                    <InputConnector input={node.inputs[key]} />
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .node {
        display: flex;
        position: relative;
        flex-direction: column;
        justify-content: space-between;
        border: var(--border-width) solid var(--accent-color);
        border-radius: var(--large-radius);
        width: 20rem;
        height: 20rem;
    }

    .node-connectors {
        position: absolute;
        top: calc( -0.5em - var(--border-width));
        display: flex;
        justify-content: space-around;
        width: 100%;
    }

    .node>canvas {
        width: 175px;
        height: 175px;
        margin: 0 auto;
    }

    .node-header {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: var(--medium-gap);
        padding: var(--medium-gap);
    }

    .node-header button {
        position: absolute;
        left: var(--medium-gap);
        top: var(--medium-gap);
    }

    .node-parameters {
        display: flex;
        gap: var(--medium-gap);
        justify-content: space-evenly;
    }

    .input {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        gap: var(--small-gap);
    }

    .input-connector {
        margin-bottom: calc( -0.5em - var(--border-width));
    }
</style>