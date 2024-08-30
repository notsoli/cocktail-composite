import { default as WGPU } from './wgpu.js'
import { default as Shaker } from './shaker.js'
import { default as Interface } from './interface.js'
import { default as configs } from './configs.js'

const tree = {
    root: {},
    effect_nodes: {},
    passes: []
}

const canvases = {
    main_canvas: null,
    effect_canvases: {},
    node_canvases: []
}

let data

window.onload = async () => {
    canvases.main_canvas = document.querySelector("#visualizer-canvas")
    canvases.main_canvas.width = window.innerWidth
    canvases.main_canvas.height = window.innerHeight

    data = await WGPU.init({ frame: 0 })

    // const effects = [ "distance", "example", "flatten", "grid", "normalized_position" ]
    // await populateConfigs(effects)
    App.configs = configs

    const interfaceInfo = await Interface.init()
    canvases.effect_canvases = interfaceInfo.effect_canvases
    generateEffectPreviews()

    // const passes = await buildShaders(config_2)

    await buildShaders(tree)
}

async function buildShaders(config) {
    WGPU.clear_passes()
    
    let mainPass
    const passes = []
    for (const passID in config.passes) {
        const passConfig = config.passes[passID]

        // there's a better way to do this
        let rootNode
        if (typeof passConfig.root_id === "string") {
            rootNode = config.effect_nodes[passConfig.root_id]
        } else {
            rootNode = findNodeFromID(config.root, passConfig.root_id)
        }

        const newConfig = {
            root: rootNode,
            return: passConfig.return
        }

        const frag = await Shaker.build(newConfig)
        const pass = await WGPU.create_pass({
            canvas: passConfig.canvas,
            fragment: frag,
            uniforms: passConfig.uniforms
        })

        if (passConfig.canvas === canvases.main_canvas) mainPass = pass

        passes.push(pass)
    }

    if (mainPass !== undefined) {
        window.onresize = () => { resizeMainCanvas(mainPass) }
        resizeMainCanvas(mainPass)
    }

    WGPU.run(() => {
        data.frame++
    })

    return passes
}

function resizeMainCanvas(passConfig) {
    canvases.main_canvas.width = window.innerWidth
    canvases.main_canvas.height = window.innerHeight
    passConfig.res = [ window.innerWidth, window.innerHeight ]
}

function findNodeFromID(root, nodeid) {
    if (root.id === nodeid) { return root }
    else {
        for (const node of root.children) {
            const returnedNode = findNodeFromID(node, nodeid)
            if (returnedNode !== null) { return returnedNode }
        }
    }

    return null
}

async function populateConfigs(effects) {
    for (const effect of effects) {
        const configText = await fetch(`../configs/${effect}.json`)
        const config = await configText.json()
        App.configs[effect] = config
    }
}

function addNodeAsRoot(nodeid, config) {
    const node = formatNodeConfig(nodeid, config)
    tree.root = node

    const defaultOutputKey = Object.keys(node.outputs)[0]

    tree.passes.push({
        root_id: nodeid,
        canvas: canvases.main_canvas,
        uniforms: { res: [ window.innerWidth, window.innerHeight ] },
        return: formatOutputToColor(node.outputs[defaultOutputKey], config.outputs[defaultOutputKey])
    })

    buildShaders(tree)
}

function generateEffectPreviews() {
    for (const config_name in canvases.effect_canvases) {
        const canvas = canvases.effect_canvases[config_name]
        const config = App.configs[config_name]

        const node = formatNodeConfig(0, config)
        tree.effect_nodes[config_name] = node
    
        const defaultOutputKey = Object.keys(node.outputs)[0]
    
        tree.passes.push({
            root_id: config_name,
            canvas: canvas,
            uniforms: { res: [ canvas.width, canvas.height ] },
            return: formatOutputToColor(node.outputs[defaultOutputKey], config.outputs[defaultOutputKey])
        })
    }
}

function addNodeAsParent(childid, nodeid, config) {
    const parentNode = findParentByID(childid)

    let childNode
    if (parentNode !== null) {
        for (const childIndex in parentNode.children) {
            const child = parentNode.children[childIndex]
            if (child.id == childid) {
                childNode = child
                parentNode.children.splice(childIndex, childIndex)
                break
            }
        }
    }

    const newParentNode = formatNodeConfig(nodeid, config)

    if (parentNode == null) {
        newParentNode.children.push(tree.root)
        tree.root = newParentNode
        addNodePass(nodeid, canvases.main_canvas)
    } else {
        newParentNode.children.push(childNode)
        parentNode.children.push(newParentNode)
    }

    buildShaders(tree)
}

function addNodeAsChild(parentid, nodeid, config) {
    const childNode = formatNodeConfig(nodeid, config)
    const parentNode = findNodeByID(parentid)
    parentNode.children.push(childNode)

    buildShaders(tree)
}

function formatNodeConfig(nodeid, config) {
    const node = {
        name: (config.internal_name !== undefined) ? config.internal_name : config.name,
        id: nodeid,
        inputs: {},
        outputs: {},
        children: []
    }

    if (config.inputs !== undefined) {
        for (const input_name in config.inputs)
            node.inputs[input_name] = config.inputs[input_name].default
    }
    for (const output_name in config.outputs)
        node.outputs[output_name] = `${output_name}_${nodeid}`

    return node
}

function formatOutputToColor(outputName, outputConfig) {
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

function findNodeByID(nodeid, root?) {
    if (root === undefined) root = tree.root
    if (root.id == nodeid) {
        return root
    } else {
        for (const child of root.children) {
            const childResult = findNodeByID(nodeid, child)
            if (childResult != null) return childResult
        }
    }

    return null
}

function findParentByID(nodeid, root?) {
    if (root === undefined) root = tree.root
    if (root.id === nodeid) return null

    for (const child of root.children) {
        if (child.id === nodeid) return root
        const childResult = findParentByID(nodeid, child)
        if (childResult != null) return childResult
    }

    return null
}

// feed the output of a child node into the input of a parent node
function linkParameter(childID, childParameter, parentID, parentParameter) {
    const childNode = findNodeByID(childID)
    const parentNode = findNodeByID(parentID)

    const childParameterName = childNode.outputs[childParameter]
    parentNode.inputs[parentParameter] = childParameterName

    buildShaders(tree)
}

function addNodePass(_nodeid, canvas) {
    const nodeid = (typeof _nodeid === "string") ? parseInt(_nodeid) : _nodeid

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

function clearPasses(canvas) {
    for (const passID in tree.passes) {
        const pass = tree.passes[passID]
        if (pass.canvas === canvas) tree.passes[passID] = null
    }
    tree.passes = tree.passes.filter((entry) => entry !== null)
}

function updateParameter(nodeid, parameter, value) {
    const node = findNodeByID(nodeid)
    node.inputs[parameter] = value
    buildShaders(tree)
}

const App = {
    configs: {},
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