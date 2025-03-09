import type { Node } from './tree.svelte';
import type { NodeConfig } from './config';
import type { Input, Output } from './tree.svelte';


export const editor: {
    focusedNode: Node | null,
    selectedEffect: NodeConfig | null,
    selectedInput: {
        input: Input
        node: Node
    } | null
    selectedOutput: {
        output: Output
        node: Node
    } | null
} = $state({
    focusedNode: null,
    selectedEffect: null,
    selectedInput: null,
    selectedOutput: null
});

/**
 * Checks if an input and output are compatible for linking.
 * 
 * @param input The input to check
 * @param output The output to check
 * @returns True if the data types are compatible, false otherwise
 */
export function isCompatible(input: Input, output: Output): boolean {
    // Check if the input and output data types are the same
    if (input.data_type === output.data_type) return true;

    if (typeof input.value === "number") {
        if (input.data_type === "float" && output.data_type === "f32") return true;
    }

    if (Array.isArray(input.value)) {
        if (input.data_type === "float" && input.value.length == 2 && output.data_type === "vec2f") return true;
        if (input.data_type === "float" && input.value.length == 3 && output.data_type === "vec3f") return true;
        if (input.data_type === "float" && input.value.length == 4 && output.data_type === "vec4f") return true;
    }

    if (typeof input.value === "object" && "text" in input.value) {
        if (input.value.data_type === output.data_type) return true;
    }

    return false;
}

export function isAdjacent(input_node: Node, output_node: Node): boolean {
    if (input_node === output_node) return false;

    // Check if the output node is a child of the input node
    for (const child of input_node.children)
        if (child.id === output_node.id) return true;

    return false;
}