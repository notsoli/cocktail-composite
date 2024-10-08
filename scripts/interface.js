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
const links = []

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

    elements.parent_placeholder_node = document.querySelector("#parent-node .placeholder-node")
    elements.focus_placeholder_node = document.querySelector("#focus-node .placeholder-node")
    elements.child_placeholder_node = document.querySelector("#child-nodes .placeholder-node")

    elements.parent_node = document.querySelector("#parent-node")
    elements.focus_node = document.querySelector("#focus-node")
    elements.child_nodes = document.querySelector("#child-nodes")

    elements.templates = document.querySelector("#element-templates")

    elements.node_links = document.querySelector("#node-links")
    elements.node_links.width = window.innerWidth * window.devicePixelRatio
    elements.node_links.height = window.innerHeight * window.devicePixelRatio
    elements.links_ctx = elements.node_links.getContext("2d")

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
        element.onclick = selectEffect
        element.ondragstart = selectEffect

        effect_canvases[element.dataset.name] = element.querySelector("canvas")
    }

    elements.parent_placeholder_node.ondragover = enableDrop
    elements.parent_placeholder_node.ondrop = addParentNode
    elements.parent_placeholder_node.onclick = addParentNode

    elements.focus_placeholder_node.ondragover = enableDrop
    elements.focus_placeholder_node.ondrop = addFocusNode
    elements.focus_placeholder_node.onclick = addFocusNode

    elements.child_placeholder_node.ondragover = enableDrop
    elements.child_placeholder_node.ondrop = addChildNode
    elements.child_placeholder_node.onclick = addChildNode

    elements.persistent_interface.onclick = deselect

    elements.parameter_templates = document.querySelector("#element-templates>.node-parameters")

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
    const template = elements.templates.querySelector(".effect")
    const effectElements = []

    for (const configName in App.configs) {
        const config = App.configs[configName]
        const newEffect = template.cloneNode(true)

        newEffect.querySelector("h3").innerText = getDisplayName(config)
        newEffect.querySelector(".tooltip").innerText = config.description
        const canvas = newEffect.querySelector("canvas")
        canvas.width = 100
        canvas.height = 100

        newEffect.dataset.name = config.name
        elements.effects.appendChild(newEffect)
        effectElements.push(newEffect)
    }

    return effectElements
}

function selectEffect() {
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

    App.addNodeAsRoot(nodeid, config)
    state.focused_node = nodeid
    constructNodeView()
    changeNodeAction(NodeAction.none)
}

function constructFocusNode(node) {
    const nodeTemplate = elements.templates.querySelector(".node")
    const newNode = nodeTemplate.cloneNode(true)

    const config = App.configs[node.name]

    newNode.dataset.nodeid = node.id
    newNode.dataset.name = config.name
    newNode.querySelector(".node-header>h2").innerText = getDisplayName(config)

    const nodeParameters = newNode.querySelector(".node-parameters")
    if (config.inputs !== undefined) {
        for (const input_name in config.inputs) {
            const input = config.inputs[input_name]
            const newParameter = assembleParameter(node, input_name, input)
            if (newParameter == null) continue
            nodeParameters.appendChild(newParameter)
        }
    } else nodeParameters.remove()

    const nodeConnectors = newNode.querySelector(".node-connectors")
    for (const output_name in config.outputs) {
        const output = config.outputs[output_name]
        const nodeConnector = elements.templates.querySelector(".node-connector").cloneNode(true)
        nodeConnector.dataset.name = output_name
        nodeConnector.dataset.type = output.type

        nodeConnector.onclick = selectParameter
        nodeConnectors.appendChild(nodeConnector)
    }

    const removeButton = newNode.querySelector(".remove-node-button")
    removeButton.onclick = () => {
        // newNode.remove()
        // state.focused_node = null
        // changeNodeAction(NodeAction.add)
    }

    const canvas = newNode.querySelector("canvas")
    canvas.width = 175
    canvas.height = 175
    App.addNodePass(node.id, canvas)

    return newNode
}

function assembleParameter(node, input_name, input) {
    let newParameter
    if (input.display) {
        newParameter = elements.parameter_templates.querySelector(".display").cloneNode(true)

        const canvas = newParameter.querySelector("canvas")
        canvas.width = 50
        canvas.height = 50

        const nodeInput = node.inputs[input_name]
        if (nodeInput.linked != null) App.addNodePass(nodeInput.linked, canvas)
    } else {
        newParameter = elements.parameter_templates.querySelector(`.${input.type}`).cloneNode(true)
        switch (input.type) {
            case "f32":
                newParameter.querySelector("input").value = input.default
                break
            case "vec2f":
                const csv = input.default.match(/(?<=vec2\()(.*)(?=\))/)[0]
                const values = csv.split(", ")
                newParameter.querySelector(".x-input").value = values[0]
                newParameter.querySelector(".y-input").value = values[1]
        }
    }

    if (newParameter === undefined) {
        console.error(`Input type "${input.type}" does not have a corresponding parameter interface.`)
        return null
    }

    newParameter.querySelector("p").innerText = getDisplayName(input, input_name)
    newParameter.dataset.name = input_name
    newParameter.dataset.type = input.type

    const inputs = newParameter.querySelectorAll("input")
    for (const input of inputs) {
        input.onchange = () => {updateParameter(node.id, newParameter)}
    }

    newParameter.onclick = linkParameter

    return newParameter
}

function updateParameter(nodeid, parameter) {
    let newValue
    switch (parameter.dataset.type) {
        case "f32":
            let floatValue = parseFloat(parameter.querySelector("input").value)
            if (floatValue == NaN) {
                console.warning("Entered value cannot be parsed as a float!")
                return
            }
            floatValue = floatValue.toString()
            if (!floatValue.includes(".")) floatValue += "."
            
            newValue = floatValue
            break
        case "vec2f":
            let xValue = parseFloat(parameter.querySelector(".x-input").value)
            let yValue = parseFloat(parameter.querySelector(".y-input").value)
            if (isNaN(parseFloat(xValue)) || isNaN(parseFloat(yValue))) {
                console.warn("Entered value cannot be parsed as a float!")
                return
            }
            xValue = xValue.toString()
            if (!xValue.includes(".")) xValue += "."
            yValue = yValue.toString()
            if (!yValue.includes(".")) yValue += "."

            newValue = `vec2(${xValue}, ${yValue})`
        case "display":
            break
        default:
            console.error("Unsupported type.")
    }

    App.updateParameter(nodeid, parameter.dataset.name, newValue)
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

    App.addNodeAsParent(state.focused_node, nodeid, config)
    constructNodeView()
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

    App.addNodeAsChild(parentid, nodeid, config)
    constructNodeView()
    changeNodeAction(NodeAction.none)
}

function constructParentNode(node) {
    const smallNodeTemplate = elements.templates.querySelector(".small-node.parent-node")
    const newNode = smallNodeTemplate.cloneNode(true)

    const config = App.configs[node.name]

    const nodeConnectors = newNode.querySelector(".node-connectors")
    for (const input_name in config.inputs) {
        const input = config.inputs[input_name]
        const nodeConnector = elements.templates.querySelector(".node-connector").cloneNode(true)
        nodeConnector.dataset.name = input_name
        nodeConnector.dataset.type = input.type

        nodeConnector.onclick = linkParameter
        nodeConnectors.appendChild(nodeConnector)
    }

    newNode.dataset.nodeid = node.id
    newNode.dataset.name = config.name
    newNode.querySelector(".node-header>h2").innerText = getDisplayName(config)

    const canvas = newNode.querySelector("canvas")
    canvas.width = 125
    canvas.height = 125
    App.addNodePass(node.id, canvas)

    newNode.onclick = (event) => {
        if (event.target == newNode.querySelector(".edit-node-button") ||
            event.target == newNode.querySelector("canvas") ||
            event.target == newNode) {
            focusNode(node.id)
        }
    }

    return newNode
}

function constructChildNode(node) {
    const smallNodeTemplate = elements.templates.querySelector(".small-node.child-node")
    const newNode = smallNodeTemplate.cloneNode(true)

    const config = App.configs[node.name]

    const nodeConnectors = newNode.querySelector(".node-connectors")
    for (const output_name in config.outputs) {
        const output = config.outputs[output_name]
        const nodeConnector = elements.templates.querySelector(".node-connector").cloneNode(true)
        nodeConnector.dataset.name = output_name
        nodeConnector.dataset.type = output.type

        nodeConnector.onclick = selectParameter
        nodeConnectors.appendChild(nodeConnector)
    }

    newNode.dataset.nodeid = node.id
    newNode.dataset.name = config.name
    newNode.querySelector(".node-header>h2").innerText = getDisplayName(config)

    const canvas = newNode.querySelector("canvas")
    canvas.width = 125
    canvas.height = 125
    App.addNodePass(node.id, canvas)

    newNode.onclick = (event) => {
        if (event.target == newNode.querySelector(".edit-node-button") ||
            event.target == newNode.querySelector("canvas") ||
            event.target == newNode) {
            focusNode(node.id)
        }
    }

    return newNode
}

function focusNode(nodeid) {
    state.focused_node = nodeid
    constructNodeView()
    constructLinks()
}

function selectParameter() {
    if (state.selected_parameter != null) return

    const connectors = document.querySelectorAll(".node-connector")
    for (const connector of connectors) connector.classList.remove("active-connector")
    this.classList.add("active-connector")

    const node = this.parentElement.parentElement
    if (node.classList.contains("node")) {
        const parentConnectors = document.querySelectorAll("#parent-node .node-connector")
        for (const connector of parentConnectors) {
            if (this.dataset.type == connector.dataset.type) {
                connector.classList.add("active-connector")
            }
        }
    } else {
        const parentNode = document.querySelector("#focus-node>.node")
        const parentParameters = parentNode.querySelectorAll(".parameter")
    
        for (const parameter of parentParameters) {
            if (this.dataset.type == parameter.dataset.type) {
                parameter.classList.add("active-parameter")
                parameter.querySelector(".node-connector").classList.add("active-connector")
            }
        }
    }

    state.selected_parameter = {
        node: node.dataset.nodeid,
        name: this.dataset.name,
        type: this.dataset.type,
        connector: this
    }
}

function deselect(event) {
    const deselectIDs = [
        'nodes', 'parent-node', 'focus-node',
        'child-nodes', 'effect-view', 'effects'
    ]

    if (!deselectIDs.includes(event.target.id)) return

    state.selected_effect = null
    state.selected_parameter = null

    for (const element of elements.effects) element.classList.remove("selected-effect")
    const connectors = document.querySelectorAll(".node-connector")
    for (const connector of connectors) connector.classList.remove("active-connector")

    if (state.focused_node != null) changeNodeAction(NodeAction.none)
}

function linkParameter() {
    // make sure a parameter is already selected and the datatypes match
    if (state.selected_parameter == null ||
        state.selected_parameter.type !== this.dataset.type) return

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

    const parentConnector = (this.classList.contains("node-connector"))
        ? this : this.querySelector(".node-connector")

    links.push({
        childID: parseInt(state.selected_parameter.node),
        childParameter: state.selected_parameter.name,
        parentID: parseInt(node.dataset.nodeid),
        parentParameter: this.dataset.name,
    })
    constructLinks()

    state.selected_parameter = null
}

function getDisplayName(config, name) {
    if (name === undefined) {
        return (config.display_name !== undefined) ? config.display_name : config.name
    } else {
        return (config.display_name !== undefined) ? config.display_name : name
    }
}

function constructNodeView() {
    const nodeCanvases = document.querySelectorAll(".node canvas, .small-node canvas")
    for (const canvas of nodeCanvases) App.clearPasses(canvas)
    
    if (state.focused_node == null) changeNodeAction(NodeAction.add)

    const parentElement = elements.parent_node.querySelector(".small-node")
    if (parentElement != null) parentElement.remove()
    const parent = App.findParentByID(state.focused_node)
    if (parent != null) elements.parent_node.appendChild(constructParentNode(parent))

    const node = App.findNodeByID(state.focused_node)
    const focusElement = elements.focus_node.querySelector(".node")
    if (focusElement != null) focusElement.remove()
    elements.focus_node.appendChild(constructFocusNode(node))

    const children = elements.child_nodes.querySelectorAll(".small-node")
    for (const childElement of children) childElement.remove()
    for (const child of node.children) elements.child_nodes.appendChild(constructChildNode(child))
}

function constructLinks() {
    elements.links_ctx.clearRect(0, 0, elements.node_links.width, elements.node_links.height);
    const dpr = window.devicePixelRatio
    elements.links_ctx.lineWidth = 5 * dpr
    elements.links_ctx.strokeStyle = "#e0772d"
    for (const link of links) {
        const childConnector = findConnector(link.childID, link.childParameter).getBoundingClientRect()
        const parentConnector = findConnector(link.parentID, link.parentParameter).getBoundingClientRect()

        elements.links_ctx.beginPath()
        elements.links_ctx.moveTo((childConnector.x + 8) * dpr, (childConnector.y + 8) * dpr)
        elements.links_ctx.lineTo((parentConnector.x + 8) * dpr, (parentConnector.y + 8) * dpr)
        elements.links_ctx.stroke()
    }
}

function findConnector(nodeid, parameter) {
    const nodeElement = document.querySelector(`[data-nodeid="${nodeid}"]`)
    const parameterElement = nodeElement.querySelector(`[data-name="${parameter}"]`)
    if (parameterElement.classList.contains("node-connector")) return parameterElement
    else return parameterElement.querySelector(".node-connector")
}

// export public functions
const Interface = {
    init: init
}
export default Interface