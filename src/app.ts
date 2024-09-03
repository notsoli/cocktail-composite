import { default as WGPU } from './wgpu.js'
import { default as Shaker } from './shaker.js'
import { default as Interface } from './interface.js'
import { default as configs } from './configs.js'

import { UniformValues } from './wgpu.js'
import { NodeConfig, OutputConfig } from './configs.js'

export interface Config {
    root: Node
    effect_nodes: {[x: string]: any}
    passes: PassConfig[]
    return: string
}

class PassConfig {
    root_id: number | string
    canvas: HTMLCanvasElement
    uniforms: Object
    return: string
}

export class Node {
    id: number
    name: string
    inputs: {[x: string]: any}
    outputs: {[x: string]: string}
    children: Node[]

    constructor(id:number, name: string, inputs: {[x: string]: any}, outputs: {[x: string]: string}) {
        this.id = id
        this.name = name
        this.inputs = inputs
        this.outputs = outputs
        this.children = []
    }
}

const tree: Config = {
    root: null,
    effect_nodes: {},
    passes: [],
    return: null
}

const canvases: {
    main_canvas: HTMLCanvasElement,
    effect_canvases: {[x: string]: HTMLCanvasElement}
} = {
    main_canvas: null,
    effect_canvases: {}
}

let data: UniformValues

window.onload = async () => {
    // set up main visualizer canvas
    canvases.main_canvas = document.querySelector("#visualizer-canvas")
    canvases.main_canvas.width = window.innerWidth
    canvases.main_canvas.height = window.innerHeight

    // initialize graphics backend with a global 'frame' uniform
    data = await WGPU.init({ frame: 0 })

    // const effects = [ "distance", "example", "flatten", "grid", "normalized_position" ]
    // await populateConfigs(effects)
    App.configs = configs

    // initialize interface and create effect previews for each type of node
    const interfaceInfo = await Interface.init()
    canvases.effect_canvases = interfaceInfo.effect_canvases
    generateEffectPreviews()

    // buld effect preview shaders (the actual node tree should be empty right now)
    await buildShaders(tree)
}

/**
 * Compiles a fragment shader for each node in the tree and runs them.
 * This shader is the preview for every node under it (its children),
 * ultimately creating the full visualization (represented by the root node).
 */
async function buildShaders(config: Config) {
    // make sure the graphics backend doesn't contain any shader passes, since we'll be remaking all of them
    WGPU.clear_passes()
    
    let mainPassUniforms: UniformValues
    // iterate over each pass (preview) in the config, building its fragment shader and creating a shader pass
    for (const passID in config.passes) {
        const passConfig = config.passes[passID]

        // account for effect previews, where the id is the name of the effect rather than a numerical id
        let rootNode
        if (typeof passConfig.root_id === "string") {
            rootNode = config.effect_nodes[passConfig.root_id]
        } else {
            rootNode = findNodeByID(passConfig.root_id)
        }

        // create sleketon config
        const newConfig: Config = {
            root: rootNode,
            return: passConfig.return,
            effect_nodes: {},
            passes: []
        }

        // build fragment shader and create a backend shader pass
        const frag = await Shaker.build(newConfig)
        const passUniforms = await WGPU.create_pass({
            canvas: passConfig.canvas, 
            fragment: frag,
            uniformValues: passConfig.uniforms
        })

        // check if this canvas is the full visualization canvas so we can handle screen resizes later
        if (passConfig.canvas === canvases.main_canvas) mainPassUniforms = passUniforms
    }

    if (mainPassUniforms !== undefined) {
        window.onresize = () => { resizeMainCanvas(mainPassUniforms) }
        resizeMainCanvas(mainPassUniforms)
    }

    WGPU.run(() => {
        (data.frame as number)++ // kinda ew, sorry
    })
}

/**
 * Resizes the main visualization canvas on screen resize and communicates
 * the new dimensions to the shader.
 * 
 * @param uniforms The local uniform values of the main visualization canvas
 */
function resizeMainCanvas(uniforms: UniformValues) {
    canvases.main_canvas.width = window.innerWidth
    canvases.main_canvas.height = window.innerHeight
    uniforms.res = [ window.innerWidth, window.innerHeight ]
}

/**
 * Imports `NodeConfig`s from `../configs` from a list of config names.
 * 
 * @param effects A list of strings containing the names of each desired `NodeConfig`
 */
async function populateConfigs(effects: string[]) {
    for (const effect of effects) {
        const configText = await fetch(`../configs/${effect}.json`)
        const config = await configText.json()
        App.configs[effect] = config
    }
}

/**
 * Creates a new `Node` and places it at the top of the effect tree.
 * Only used for the first node placed in the effect tree.
 * 
 * @param nodeid The ID of the newly-created node
 * @param config The node's `NodeConfig`
 */
function addNodeAsRoot(nodeid: number, config: NodeConfig) {
    const node = formatNodeConfig(nodeid, config)
    tree.root = node

    // makes the first output what will be displayed as the full visualization
    const defaultOutputKey = Object.keys(node.outputs)[0]

    tree.passes.push({
        root_id: nodeid,
        canvas: canvases.main_canvas,
        uniforms: { res: [ window.innerWidth, window.innerHeight ] },
        return: formatOutputToColor(node.outputs[defaultOutputKey], config.outputs[defaultOutputKey])
    })

    buildShaders(tree)
}

/**
 * Creates effect previews for each effect node in the toolbox.
 */
function generateEffectPreviews() {
    for (const config_name in canvases.effect_canvases) {
        // grabs the config and corresponding canvas for the effect node
        const canvas = canvases.effect_canvases[config_name]
        const config = App.configs[config_name]

        // creates a `Node` and adds it to the tree
        const node = formatNodeConfig(0, config)
        tree.effect_nodes[config_name] = node
    
        // makes the first output what will be displayed in the effect preview
        const defaultOutputKey = Object.keys(node.outputs)[0]
    
        // creates a pass for the preview, making sure a shader gets compiled
        tree.passes.push({
            root_id: config_name,
            canvas: canvas,
            uniforms: { res: [ canvas.width, canvas.height ] },
            return: formatOutputToColor(node.outputs[defaultOutputKey], config.outputs[defaultOutputKey])
        })
    }
}

/**
 * Creates a new `Node` and places the specified child node as one of its children.
 * 
 * @param childid The ID for the child node
 * @param nodeid The ID for the new parent node
 * @param config The new parent node's `NodeConfig`
 */
function addNodeAsParent(childid: number, nodeid: number, config: NodeConfig) {
    // removes the child node from its current location, saving its parent node
    const parentNode = findParentByID(childid)

    let childNode
    if (parentNode !== null) {
        for (let c = 0; c < parentNode.children.length; c++) {
            const child = parentNode.children[c]
            if (child.id == childid) {
                childNode = child
                parentNode.children.splice(c, c)
                break
            }
        }
    }

    const newParentNode = formatNodeConfig(nodeid, config)

    if (parentNode == null) {
        // child node is already root node, set new node as root
        newParentNode.children.push(tree.root)
        tree.root = newParentNode
        addNodePass(nodeid, canvases.main_canvas)
    } else {
        // child node has parent, put new parent in between
        newParentNode.children.push(childNode)
        parentNode.children.push(newParentNode)
    }

    buildShaders(tree)
}

/**
 * Creates a new `Node` and places it as one of the specified parent node's children.
 * 
 * @param parentid The ID for the parent node
 * @param nodeid The ID for the new child node
 * @param config The new child node's `NodeConfig`
 */
function addNodeAsChild(parentid: number, nodeid: number, config: NodeConfig) {
    const childNode = formatNodeConfig(nodeid, config)
    const parentNode = findNodeByID(parentid)
    parentNode.children.push(childNode)

    buildShaders(tree)
}

/**
 * Creates a new `Node` from a node config.
 * @todo change the name of this function
 * 
 * @param nodeid The ID for the new node
 * @param config The new node's `NodeConfig`
 * @returns The new node
 */
function formatNodeConfig(nodeid: number, config: NodeConfig) {
    const inputs: {[x: string]: any} = {}
    if (config.inputs !== undefined) {
        for (const input_name in config.inputs)
            inputs[input_name] = config.inputs[input_name].default
    }

    const outputs: {[x: string]: string} = {}
    for (const output_name in config.outputs)
        outputs[output_name] = `${output_name}_${nodeid}`

    const newNode = new Node(nodeid, config.name, inputs, outputs)

    return newNode
}

/**
 * Transforms a specified type (fe2, vec2f, vec3f, and vec4f)
 * into one that can be displayed as an output color (`vec4`).
 * 
 * @param outputName The name of the variable to output
 * @param outputConfig Information about the output variable
 * @returns A string representing a `vec4` that can be used as an output color
 */
function formatOutputToColor(outputName: string, outputConfig: OutputConfig) {
    switch (outputConfig.type) {
        case "f32":
            return `vec4(vec3(${outputName}), 1.)`
        case "vec2f":
            return `vec4(${outputName}, 0., 1.)`
        case "vec3f":
            return `vec4(${outputName}, 1.)`
        case "vec4f":
            return outputName
        default:
            console.error("Unsupported return type!")
    }
}

/**
 * Finds a `Node` from its ID by traversing the root node's children.
 * @param nodeid The ID of target node
 * @param root A parent node of the target node (assumes the tree root if unspecified)
 * @returns The target `Node` if found, `null` if not
 */
function findNodeByID(nodeid: number, root?: Node): Node {
    if (root === undefined) root = tree.root
    if (root.id == nodeid) {
        return root
    } else {
        for (const child of root.children) {
            const childResult = findNodeByID(nodeid, child)
            if (childResult != null) return childResult
        }
    }
}

/**
 * Finds a node's parent `Node` from its ID by traversing the root node's children.
 * @param nodeid The ID of target node
 * @param root A parent node of the target node (assumes the tree root if unspecified)
 * @returns The target `Node` if found, `null` if not
 */
function findParentByID(nodeid: number, root?: Node): Node {
    if (root === undefined) root = tree.root
    if (root.id === nodeid) return null

    for (const child of root.children) {
        if (child.id === nodeid) return root
        const childResult = findParentByID(nodeid, child)
        if (childResult != null) return childResult
    }

    return null
}

/**
 * Feeds the output of a child node into the input of a parent node.
 * 
 * @param childID The ID of the child node
 * @param childParameter The specific child parameter to be linked
 * @param parentID The ID of the parent node
 * @param parentParameter THe specific parent parameter to be linked
 */
function linkParameter(childID: number, childParameter: string, parentID: number, parentParameter: string) {
    const childNode = findNodeByID(childID)
    const parentNode = findNodeByID(parentID)

    const childParameterName = childNode.outputs[childParameter]
    parentNode.inputs[parentParameter] = childParameterName

    buildShaders(tree)
}

/**
 * Creates a pass for a specified node and removes any current passes referencing it.
 * 
 * @param nodeid The specified node's ID
 * @param canvas The canvas to render the preview onto
 */
function addNodePass(nodeid: number, canvas: HTMLCanvasElement) {
    // if passes targeting this canvas already exist, remove them
    clearPasses(canvas)

    const node = findNodeByID(nodeid)
    const config = App.configs[node.name]

    const defaultOutputKey = Object.keys(node.outputs)[0]
    
    tree.passes.push({
        root_id: nodeid,
        canvas: canvas,
        uniforms: { res: [ canvas.width, canvas.height ] },
        return: formatOutputToColor(node.outputs[defaultOutputKey], config.outputs[defaultOutputKey])
    })

    buildShaders(tree)
}

/**
 * Clears all passes that are linked to a specific canvas.
 * 
 * @param canvas The specified canvas
 */
function clearPasses(canvas: HTMLCanvasElement) {
    for (const passID in tree.passes) {
        const pass = tree.passes[passID]
        if (pass.canvas === canvas) tree.passes[passID] = null
    }
    tree.passes = tree.passes.filter((entry) => entry !== null)
}

/**
 * Updates a specified node parameter to a new value.
 * 
 * @param nodeid The specified node's ID
 * @param parameter The specified parameter name
 * @param value The new value
 */
function updateParameter(nodeid: number, parameter: string, value: any) {
    const node = findNodeByID(nodeid)
    node.inputs[parameter] = value
    buildShaders(tree)
}

const App = {
    configs,
    current_nodeid: 0,
    addNodeAsRoot,
    addNodeAsParent,
    addNodeAsChild,
    linkParameter,
    addNodePass,
    clearPasses,
    findNodeByID,
    findParentByID,
    updateParameter
}

export default App