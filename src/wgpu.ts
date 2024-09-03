export interface UniformValues {
    [x: string]: number | number[]
}

export class Pass {
    ctx: GPUCanvasContext
    renderPipeline: GPURenderPipeline
    vertexBuffer: GPUBuffer
    uniforms: {[x: string]: Uniform}
    uniformValues: UniformValues
    customBindGroup: GPUBindGroup

    constructor(ctx: GPUCanvasContext, renderPipeline: GPURenderPipeline,
                vertexBuffer: GPUBuffer, uniforms: {[x: string]: Uniform} = {},
                customBindGroup: GPUBindGroup = null, uniformValues: UniformValues = {}) {
        this.ctx = ctx
        this.renderPipeline = renderPipeline
        this.vertexBuffer = vertexBuffer
        this.uniforms = uniforms
        this.customBindGroup = customBindGroup
        this.uniformValues = uniformValues
    }
}

class Uniform {
    index: number
    values: Float32Array
    buffer: GPUBuffer
    constructor(index: number, size: number) {
        this.index = index
        this.values = new Float32Array(size)
        this.buffer = device.createBuffer({
            size: size * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })
    }
}

let device: GPUDevice, update: () => void, defaultBindGroupLayout: GPUBindGroupLayout, pipelineLayout: GPUPipelineLayout, bindGroup: GPUBindGroup
let passes: Pass[] = [], uniforms: {[x: string]: Uniform} = {}
let running = false

async function init(descriptor: UniformValues) {
    if (device != undefined) device.destroy()

    passes = []
    uniforms = {}

    if (!navigator.gpu) { throw Error("WebGPU not supported.") }
    
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) { throw Error("Couldn't request WebGPU adapter.") }

    device = await adapter.requestDevice()

    const proxy = new Proxy(descriptor, { set: modifyUniform })

    const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = []
    const bindGroupEntries: GPUBindGroupEntry[] = []
    Object.entries(descriptor).forEach((entry, index) => {
        const key = entry[0]
        const value = entry[1]

        const size = Array.isArray(value) ? value.length : 1
        const arrayForm = Array.isArray(value) ? value : [value]

        bindGroupLayoutEntries[index] = {
            binding: index,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' }
        }

        const newUniform = new Uniform(index, size)
        newUniform.values.set(arrayForm)
        bindGroupEntries[index] = { binding: index, resource: { buffer: newUniform.buffer }}
        uniforms[key] = newUniform
    })

    defaultBindGroupLayout = device.createBindGroupLayout({
        entries: bindGroupLayoutEntries })
    pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [ defaultBindGroupLayout ] })

    bindGroup = device.createBindGroup({
        layout: defaultBindGroupLayout,
        entries: bindGroupEntries
    })

    return proxy
}

interface PassData {
    canvas: HTMLCanvasElement
    fragment: string
    uniformValues: any
}

async function create_pass(data: PassData): Promise<UniformValues> {
    const hasUniforms = (data.uniformValues != undefined)

    const vertex = `
        @vertex
        fn vertex_main(@location(0) pos : vec2f) ->  @builtin(position) vec4f {
            return vec4f(pos, 0., 1.); 
        }
    `

    const shaderModule = device.createShaderModule({
        code: vertex + data.fragment })

    const ctx = data.canvas.getContext("webgpu")
    ctx.configure({
        device: device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: "premultiplied",
    })

    const verts = new Float32Array([
        -1.0, -1.0,
        1.0, -1.0,
        1.0, 1.0,
        1.0, 1.0,
        -1.0, 1.0,
        -1.0, -1.0
    ])

    // create & configure vertex buffer
    const vertexBuffer = device.createBuffer({
        size: verts.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(vertexBuffer, 0, verts, 0, verts.length)

    const vertexBuffers: GPUVertexBufferLayout[] = [
        {
            attributes: [
                { shaderLocation: 0, offset: 0, format: "float32x2"}
            ],
            arrayStride: 8,
            stepMode: "vertex",
        },
    ]

    let newPipelineLayout = pipelineLayout
    let customBindGroup, uniforms: {[x: string]: Uniform} = {}
    if (hasUniforms) {
        const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [], bindGroupEntries: GPUBindGroupEntry[] = []
        Object.entries(data.uniformValues).forEach((entry, index) => {
            const key = entry[0]
            const value = entry[1]

            const size = Array.isArray(value) ? value.length : 1
            const arrayForm = Array.isArray(value) ? value : [value]

            bindGroupLayoutEntries[index] = {
                binding: index,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            }

            const newUniform = new Uniform(index, size)
            uniforms[key] = newUniform
            const values = newUniform.values
            values.set(arrayForm)
            bindGroupEntries[index] = { binding: index, resource: { buffer: newUniform.buffer }}
        })

        const bindGroupLayout = device.createBindGroupLayout({
            entries: bindGroupLayoutEntries })
        newPipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ defaultBindGroupLayout, bindGroupLayout ] })

        const newBindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: bindGroupEntries
        })
        customBindGroup = newBindGroup
    }

    // configure rendering pipeline
    const vertexState: GPUVertexState = { module: shaderModule, entryPoint: "vertex_main", buffers: vertexBuffers }
    const fragmentState: GPUFragmentState = {
        module: shaderModule, entryPoint: "fragment_main",
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }]
    }
    const pipelineDescriptor: GPURenderPipelineDescriptor = {
        vertex: vertexState,
        fragment: fragmentState,
        primitive: { topology: "triangle-list" },
        layout: newPipelineLayout
    }
    const renderPipeline = device.createRenderPipeline(pipelineDescriptor)

    let passProxy: Promise<UniformValues> = null, pass: Pass
    if (hasUniforms) {
        pass = new Pass(ctx, renderPipeline, vertexBuffer, uniforms, customBindGroup, data.uniformValues)
        passProxy = new Proxy(data.uniformValues, { set: createLocalUniformModifier(pass) })
    } else {
        pass = new Pass(ctx, renderPipeline, vertexBuffer)
    }

    passes.push(pass)
    return passProxy
}

async function run(_update: () => void) {
    update = _update

    for (const key in uniforms) {
        const uniform = uniforms[key]
        device.queue.writeBuffer(uniform.buffer, 0, uniform.values)
    }

    for (const pass of passes) {
        for (const key in pass.uniforms) {
            const uniform = pass.uniforms[key]
            device.queue.writeBuffer(uniform.buffer, 0, uniform.values)
        }
    }

    if (!running) {
        requestAnimationFrame(render)
        running = true
    }
}

function render() {
    passes.forEach((pass) => {
        const commandEncoder = device.createCommandEncoder()

        // background color
        const clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [{
                clearValue: clearColor,
                loadOp: "clear",
                storeOp: "store",
                view: pass.ctx.getCurrentTexture().createView()
            }
        ]}

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
        passEncoder.setPipeline(pass.renderPipeline)
        passEncoder.setBindGroup(0, bindGroup)
        if (pass.customBindGroup != null) {
            passEncoder.setBindGroup(1, pass.customBindGroup)
        }
        passEncoder.setVertexBuffer(0, pass.vertexBuffer)

        passEncoder.draw(6)
        passEncoder.end()
        device.queue.submit([commandEncoder.finish()])
    })

    update()
    requestAnimationFrame(render)
}

function modifyUniform(target: UniformValues, key: string, value: number | number[]) {
    const arrayForm = Array.isArray(value) ? value : [value]
    const uniform = uniforms[key]
    const values = uniform.values
    values.set(arrayForm)
    device.queue.writeBuffer(uniform.buffer, 0, values)

    target[key] = value
    return true
}

function createLocalUniformModifier(pass: Pass) {
    return function(target: UniformValues, key: string, value: number | number[]) {
        const arrayForm = Array.isArray(value) ? value : [value]
        const targetUniform = pass.uniforms[key]

        targetUniform.values.set(arrayForm)
        device.queue.writeBuffer(targetUniform.buffer, 0, targetUniform.values)

        target[key] = value
        return true
    }
}

function clear_passes() {
    passes = []
}

const WGPU = { init, create_pass, run, clear_passes }
export default WGPU