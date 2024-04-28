import { default as App } from './app.js'

const View = {
    node: Symbol("node"),
    visualizer: Symbol("preview"),
    tree: Symbol("tree"),
    variables: Symbol("variable")
}

const NodeAction = {
    none: Symbol("none"),
    add: Symbol("add")
}

const state = {
    current_view: View.node,
    current_node_action: NodeAction.none,
    focused_node: null,
    selected_effect: null,
    selected_parameter: null
}

const elements = {}

async function init() {
    // query elements
    elements.visualize_button = document.querySelector("#visualize-button")
    elements.tree_button = document.querySelector("#tree-button")
    elements.variables_button = document.querySelector("#variables-button")
    elements.exit_visualizer_button = document.querySelector("#exit-visualizer-button")

    elements.persistent_interface = document.querySelector("#persistent-interface")
    elements.node_view = document.querySelector("#node-view")
    elements.visualizer_view = document.querySelector("#visualizer-view")
    elements.effects = document.querySelector("#effects")

    elements.parent_placeholder_node = document.querySelector("#parent-nodes .placeholder-node")
    elements.focus_placeholder_node = document.querySelector("#focus-node .placeholder-node")
    elements.child_placeholder_node = document.querySelector("#child-nodes .placeholder-node")

    // set current state
    changeView(View.node)
    changeNodeAction(NodeAction.add)

    // link onclick events
    elements.visualize_button.onclick = () => { changeView(View.visualizer) }
    elements.tree_button.onclick = () => { changeView(View.tree) }
    elements.variables_button.onclick = () => { changeView(View.variables) }
    elements.exit_visualizer_button.onclick = () => { changeView(View.node) }

    // generate toolkit entries and link event listeners
    elements.effects = await populateToolkit()
    const effect_canvases = {}
    for (const element of elements.effects) {
        element.onclick = selectElement
        element.ondragstart = selectElement

        effect_canvases[element.dataset.name] = element.querySelector("canvas")
    }

    elements.focus_placeholder_node.ondragover = enableDrop
    elements.focus_placeholder_node.ondrop = addFocusNode
    elements.focus_placeholder_node.onclick = addFocusNode

    elements.parent_placeholder_node.ondragover = enableDrop
    elements.parent_placeholder_node.ondrop = addParentNode
    elements.parent_placeholder_node.onclick = addParentNode

    elements.child_placeholder_node.ondragover = enableDrop
    elements.child_placeholder_node.ondrop = addChildNode
    elements.child_placeholder_node.onclick = addChildNode

    return { effect_canvases: effect_canvases }
}

function changeView(newView) {
    switch (newView) {
        case View.node:
            elements.persistent_interface.classList.add("active-view")
            elements.node_view.classList.add("active-view")
            elements.visualizer_view.classList.remove("active-view")
            break
        case View.visualizer:
            elements.visualizer_view.classList.add("active-view")
            elements.persistent_interface.classList.remove("active-view")
            break
        case View.variables:
        case View.tree:
            console.warn("View not implemented")
            break
        default:
            console.error("Unknown view")
            return
    }

    state.current_view = newView
}

function changeNodeAction(newNodeAction) {
    if (newNodeAction == NodeAction.none) {
        elements.parent_placeholder_node.classList.remove("active-placeholder")
        elements.focus_placeholder_node.classList.remove("active-placeholder")
        elements.child_placeholder_node.classList.remove("active-placeholder")
    } else if (newNodeAction == NodeAction.add) {
        if (state.focused_node != null) {
            elements.parent_placeholder_node.classList.add("active-placeholder")
            elements.focus_placeholder_node.classList.remove("active-placeholder")
            elements.child_placeholder_node.classList.add("active-placeholder")
        } else {
            elements.parent_placeholder_node.classList.remove("active-placeholder")
            elements.focus_placeholder_node.classList.add("active-placeholder")
            elements.child_placeholder_node.classList.remove("active-placeholder")  
        }
    } else {
        console.error("Unknown node action")
        return
    }

    state.current_node_action = newNodeAction
}

async function populateToolkit() {
    const template = document.querySelector("#effect-template")
    const effectElements = []

    for (const configName in App.configs) {
        const config = App.configs[configName]
        const newEffect = template.cloneNode(true)

        newEffect.querySelector("h3").innerText = getDisplayName(config)
        newEffect.querySelector(".tooltip").innerText = config.description

        newEffect.dataset.name = config.name
        elements.effects.appendChild(newEffect)
        effectElements.push(newEffect)
    }

    return effectElements
}

function selectElement() {
    state.selected_effect = this.dataset.name

    for (const element of elements.effects)
        element.classList.remove("selected-effect")
    this.classList.add("selected-effect")

    elements.parent_placeholder_node.classList.add("pointer")
    elements.focus_placeholder_node.classList.add("pointer")
    elements.child_placeholder_node.classList.add("pointer")

    changeNodeAction(NodeAction.add)
}

function enableDrop(event) { event.preventDefault() }

function addFocusNode() {
    if (state.selected_effect === null) {
        console.warn("No effect selected")
        return
    }

    const config = App.configs[state.selected_effect]
    if (config === undefined) {
        console.error(`Congfiguration for effect ${state.selected_effect} does not exist`)
        return
    }

    // generate nodeid
    const nodeid = App.current_nodeid++

    const node = App.addNodeAsRoot(nodeid, config)
    const nodeElement = constructFocusNode(node, config)

    const canvas = nodeElement.querySelector("canvas")
    App.addNodePass(nodeid, canvas)

    document.querySelector("#focus-node").appendChild(nodeElement)
    state.focused_node = nodeid
    changeNodeAction(NodeAction.none)
}

function constructFocusNode(node, config) {
    const nodeTemplate = document.querySelector("#element-templates>.node")
    const newNode = nodeTemplate.cloneNode(true)

    newNode.dataset.nodeid = node.id
    newNode.dataset.name = config.name
    newNode.querySelector(".node-header>h2").innerText = getDisplayName(config)

    const nodeParameters = newNode.querySelector(".node-parameters")
    const parameterTemplates = document.querySelector("#element-templates>.node-parameters")
    if (config.inputs !== undefined) {
        for (const input_name in config.inputs) {
            const input = config.inputs[input_name]
            const newParameter = (input.display)
                ? parameterTemplates.querySelector(".display").cloneNode(true)
                : parameterTemplates.querySelector(`.${input.type}`).cloneNode(true)
    
            if (newParameter === undefined) {
                console.error(`Input type "${input.type}" does not have a corresponding parameter interface.`)
                continue
            }

            newParameter.querySelector("p").innerText = getDisplayName(input, input_name)
            newParameter.dataset.name = input_name
            newParameter.dataset.type = input.type

            newParameter.onclick = linkParameter

            nodeParameters.appendChild(newParameter)
        }
    } else {
        nodeParameters.remove()
    }

    const removeButton = newNode.querySelector(".remove-node-button")
    removeButton.onclick = () => {
        // newNode.remove()
        // state.focused_node = null
        // changeNodeAction(NodeAction.add)
    }

    return newNode
}

function addParentNode() {
    if (state.selected_effect === null) {
        console.warn("No effect selected")
        return
    }

    const config = App.configs[state.selected_effect]
    if (config === undefined) {
        console.error(`Congfiguration for effect ${state.selected_effect} does not exist`)
        return
    }

    // generate nodeid
    const nodeid = App.current_nodeid++

    const node = App.addNodeAsRoot(nodeid, config)
    const nodeElement = constructSmallNode(node, config)
    document.querySelector("#parent-nodes").appendChild(nodeElement)
    changeNodeAction(NodeAction.none)
}

function addChildNode() {
    if (state.selected_effect === null) {
        console.warn("No effect selected")
        return
    }

    const config = App.configs[state.selected_effect]
    if (config === undefined) {
        console.error(`Congfiguration for effect ${state.selected_effect} does not exist`)
        return
    }

    // generate nodeid
    const nodeid = App.current_nodeid++

    // find parent id
    const parentElement = document.querySelector("#focus-node>.node")
    const parentid = parentElement.dataset.nodeid

    const node = App.addNodeAsChild(parentid, nodeid, config)
    const nodeElement = constructSmallNode(node, config)

    const canvas = nodeElement.querySelector("canvas")
    App.addNodePass(nodeid, canvas)

    document.querySelector("#child-nodes").appendChild(nodeElement)
    changeNodeAction(NodeAction.none)
}

function constructSmallNode(node, config) {
    const smallNodeTemplate = document.querySelector("#element-templates>.small-node")
    const newNode = smallNodeTemplate.cloneNode(true)

    const nodeConnectors = newNode.querySelector(".node-connectors")
    for (const output_name in config.outputs) {
        const output = config.outputs[output_name]
        const nodeConnector = document.querySelector("#element-templates>.node-connector").cloneNode(true)
        nodeConnector.dataset.name = output_name
        nodeConnector.dataset.type = output.type

        nodeConnector.onclick = selectParameter

        nodeConnectors.appendChild(nodeConnector)
    }

    newNode.dataset.nodeid = node.id
    newNode.dataset.name = config.name
    newNode.querySelector(".node-header>h2").innerText = getDisplayName(config)

    return newNode
}

function selectParameter() {
    if (state.selected_parameter != null) return

    const connectors = document.querySelectorAll(".node-connector")
    for (const connector of connectors) connector.classList.remove("active-connector")
    this.classList.add("active-connector")

    const node = this.parentElement.parentElement
    const parentNode = document.querySelector("#focus-node>.node")
    const parentParameters = parentNode.querySelectorAll(".parameter")

    for (const parameter of parentParameters) {
        if (this.dataset.type == parameter.dataset.type) {
            parameter.classList.add("active-parameter")
            parameter.querySelector(".node-connector").classList.add("active-connector")
        }
    }

    state.selected_parameter = {
        node: node.dataset.nodeid,
        name: this.dataset.name,
        type: this.dataset.type
    }
}

function linkParameter() {
    // make sure a parameter is already selected and this parameter is active
    if (state.selected_parameter == null || !this.classList.contains("active-parameter")) return

    // make sure the parameter types match. this shouldn't fail but idk it might
    if (state.selected_parameter.type !== this.dataset.type) return

    const node = this.parentElement.parentElement

    App.linkParameter(
        state.selected_parameter.node,
        state.selected_parameter.name,
        node.dataset.nodeid,
        this.dataset.name
    )

    if (this.classList.contains("display")) {
        const canvas = this.querySelector("canvas")
        App.addNodePass(state.selected_parameter.node, canvas)
    } 

    const connectors = document.querySelectorAll(".node-connector")
    for (const connector of connectors) connector.classList.remove("active-connector")

    state.selected_parameter = null
}

function getDisplayName(config, name) {
    if (name === undefined) {
        return (config.display_name !== undefined) ? config.display_name : config.name
    } else {
        return (config.display_name !== undefined) ? config.display_name : name
    }
}

// export public functions
const Interface = {
    init: init
}
export default Interface