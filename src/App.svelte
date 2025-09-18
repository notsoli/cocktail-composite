<script lang="ts">
    // library imports
    import * as Devolute from "devolute";
    import { onMount } from "svelte";

    // module imports
    import { importConfigs } from "$lib/scripts/config";
    import { addParentNode, addChildNode, formatOutputToColor } from "$lib/scripts/tree.svelte";
    import { build } from "$lib/scripts/builder";

    // component imports
    import Effect from "$lib/components/Effect.svelte";
    import ParentNode from "$lib/components/ParentNode.svelte";
    import FocusedNode from "$lib/components/FocusedNode.svelte";
    import ChildNode from "$lib/components/ChildNode.svelte";
    import LinkedConnectors from "$lib/components/LinkedConnectors.svelte";

    // state imports
    import { tree, getParentNode } from "$lib/scripts/tree.svelte";
    import { editor } from "$lib/scripts/editor.svelte";

    // resource imports
    import "./assets/reset.css";
    import "./assets/global.css";

    // state
    let mode: "editor" | "visualizer" = $state("editor");
    let visualizerCanvas: HTMLCanvasElement | null = $state(null);

    // node selectors
    const parentNode = $derived(
        (editor.focusedNode === null || tree.root === null) ? null : getParentNode(editor.focusedNode, tree.root));
    
    function addFocusedNode() {
        const new_node = addChildNode(null, editor.selectedEffect!);
        editor.focusedNode = new_node;
    }

    onMount(async () => {
        const globals = await Devolute.init({
            uniforms: { frame: { type: "f32", value: 0 } }
        });

        const configs = await importConfigs();
        tree.configs = configs;

        Devolute.run(() => {
            globals.frame++;
        });
    });

    $effect(() => {
        if (tree.root !== null && visualizerCanvas !== null) {
            // set canvas dimensions
            visualizerCanvas.width = window.innerWidth;
            visualizerCanvas.height = window.innerHeight;

            // generate a fragment shader
            const returnValue = formatOutputToColor(tree.root.outputs[Object.keys(tree.root.outputs)[0]]);
            const frag = build(tree.root, returnValue, tree.configs);
            if (!frag) return;

            // create a pass
            let pass: Devolute.Pass;
            Devolute.createPass({
                canvas: visualizerCanvas,
                uniforms: {
                    res: { type: "vec2f", value: [window.innerWidth, window.innerHeight] }
                },
                fragment: frag
            }).then((passInfo) => {
                pass = passInfo.pass;
            });

            // remove the pass when the tree, configs, or canvas change
            return () => {
                Devolute.removePass(pass);
            };
        }
    });

    function clearSelections() {
        editor.selectedEffect = null;
        editor.selectedInput = null;
        editor.selectedOutput = null;
    }
</script>

<main>
    {#if mode === "editor"}
        <div id="editor">
            <section id="node-view">
                <nav>
                    <button onclick={() => mode = "visualizer"}>visualize</button>
                    <h1 id="title">COCKTAIL COMPOSITE</h1>
                    <!-- <button id="tree-button" disabled>tree view</button>
                    <button id="variables-button" disabled>variables</button> -->
                </nav>
                <div id="nodes" role="button" tabindex=-1
                    onclick={clearSelections}
                    onkeyup={(event) => {if (event.key === "Enter") editor.selectedEffect = null}}
                >
                    <div id="parent-node">
                        {#if parentNode !== null}
                            <ParentNode node={parentNode} />
                        {:else if editor.selectedEffect !== null && editor.focusedNode !== null}
                            <button
                                class="placeholder-node"
                                onclick={() => addParentNode(editor.focusedNode!, editor.selectedEffect!)}
                            >+</button>
                        {/if}
                    </div>
                    <div id="focus-node">
                        {#if editor.focusedNode !== null}
                            <FocusedNode node={editor.focusedNode} />
                        {:else if editor.selectedEffect !== null}
                            <button
                                class="placeholder-node"
                                onclick={addFocusedNode}
                            >+</button>
                        {/if}
                    </div>
                    <div id="child-nodes">
                        {#if editor.focusedNode !== null}
                            {#each editor.focusedNode?.children as child}
                                <ChildNode node={child} />
                            {/each}
                            {#if editor.selectedEffect !== null}
                                <button
                                    class="placeholder-node"
                                    onclick={() => addChildNode(editor.focusedNode!, editor.selectedEffect!)}
                                >+</button>
                            {/if}
                        {/if}
                    </div>
                </div>
                <div id="linked-connectors">
                    {#each editor.linkedConnectors as linkedConnectors }
                        <LinkedConnectors {linkedConnectors} />
                    {/each}
            </section>
            <section id="effect-view">
                <h1>effect toolkit</h1>
                <div id="effects">
                    {#each Object.values(tree.configs) as config}
                        <Effect config={config} />
                    {/each}
                </div>
            </section>
        </div>
    {:else}
        <div id="visualizer">
            <div id="visualizer-interface">
                <button onclick={() => mode = "editor"}>edit</button>
            </div>
            <canvas id="visualizer-canvas" bind:this={visualizerCanvas}></canvas>
        </div>
    {/if}
</main>

<style>
    main {
        padding: var(--medium-gap);
        display: flex;
        height: 100%;
    }

    #editor {
        display: flex;
        flex-direction: row;
        width: 100%;
        height: 100%;
        gap: var(--large-gap);
        align-items: stretch;
    }

    #node-view {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }

    #effect-view {
        width: 20rem;
        padding: var(--medium-gap);
        border: var(--border-width) solid var(--primary-color);
        border-radius: var(--large-radius);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--medium-gap);
    }

    #effects {
        overflow: scroll;
        display: flex;
        flex-wrap: wrap;
        gap: var(--medium-gap);
    }

    nav {
        display: flex;
        gap: var(--medium-gap);
    }

    #nodes {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 2em;
        height: 100%;
    }

    #title {
        margin: auto;
    }

    #visualizer {
        position: absolute;
        inset: 0;
    }

    #visualizer canvas {
        width: 100%;
        height: 100%;
    }

    #visualizer button {
        position: absolute;
        top: var(--medium-gap);
        left: var(--medium-gap);
    }

    .placeholder-node {
        width: 8rem;
        height: 8rem;
        background-color: var(--background-color);
        border: var(--border-width) dashed var(--accent-color);
        border-radius: var(--large-radius);
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 3em;
        color: var(--accent-color);
    }

    #focus-node .placeholder-node {
        width: 12rem;
        height: 12rem;
    }

    #child-nodes {
        display: flex;
        gap: var(--large-gap);
        align-items: center;
    }
</style>