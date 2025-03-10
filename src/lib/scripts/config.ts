export type Type = "f32" | "vec2f" | "vec3f" | "vec4f";
export type NumberType = "float"; // will be extended sometime

export type NodeConfig = {
    name: string
    display_name?: string
    description: string
    locals?: string[]
    globals?: string[]
    inputs?: { [x: string]: InputConfig }
    outputs: { [x: string]: OutputConfig }
    function?: string
    inline: string
};

export type DisplayInputConfig = {
    input_type: "display"
    data_type: Type
    default: string
    display_name?: string
};

export type NumberInputConfig = {
    input_type: "number"
    data_type: NumberType
    default: number | number[]
    display_name?: string
};

type InputConfig = DisplayInputConfig | NumberInputConfig;

type OutputConfig = {
    data_type: Type
    display_name?: string
};

/**
 * Imports all node configurations from the configs directory
 * @returns A promise that resolves to a record of node configurations
 */
export async function importConfigs(): Promise<Record<string, NodeConfig>> {
    const configs: Record<string, NodeConfig> = {};

    // import all JSON files from the configs directory
    const configPaths = import.meta.glob('../../configs/*.json');

    // validate each config
    for (const path in configPaths) {
        // parse module as a JSON object
        const config = JSON.parse(JSON.stringify(await configPaths[path]())).default;

        // validate config
        const validateResult = validateNodeConfig(config);
        if (!validateResult.valid) {
            console.error(`Invalid configuration in ${path}: ${validateResult.error}`);
        } else {
            configs[config.name] = config;
        }
    }

    return configs;
}

// ...existing code...

/**
 * Result of config validation
 */
type ValidationResult = {
    valid: boolean;
    error?: string;
};

/**
 * Validates a node configuration object against the NodeConfig type
 * @param config The configuration object to validate
 * @returns A validation result indicating whether the config is valid, with an error message if not
 */
export function validateNodeConfig(config: any): ValidationResult {
    // Check if config is an object
    if (!config || typeof config !== 'object') {
        return { valid: false, error: 'Config must be an object' };
    }

    // Validate required fields
    if (!config.name || typeof config.name !== 'string') {
        return { valid: false, error: 'Missing or invalid "name" field' };
    }

    if (!config.description || typeof config.description !== 'string') {
        return { valid: false, error: 'Missing or invalid "description" field' };
    }

    if (!config.inline || typeof config.inline !== 'string') {
        return { valid: false, error: 'Missing or invalid "inline" field' };
    }

    // Validate optional display_name
    if (config.display_name !== undefined && typeof config.display_name !== 'string') {
        return { valid: false, error: 'Invalid "display_name" field' };
    }

    // Validate locals and globals
    if (config.locals !== undefined) {
        if (!Array.isArray(config.locals) || !config.locals.every((item: unknown) => typeof item === 'string')) {
            return { valid: false, error: 'Invalid "locals" field: must be an array of strings' };
        }
    }

    if (config.globals !== undefined) {
        if (!Array.isArray(config.globals) || !config.globals.every((item: unknown) => typeof item === 'string')) {
            return { valid: false, error: 'Invalid "globals" field: must be an array of strings' };
        }
    }

    // Validate function
    if (config.function !== undefined && typeof config.function !== 'string') {
        return { valid: false, error: 'Invalid "function" field' };
    }

    // Validate inputs
    if (config.inputs !== undefined) {
        if (typeof config.inputs !== 'object') {
            return { valid: false, error: 'Invalid "inputs" field: must be an object' };
        }

        // Check each input
        for (const [key, input] of Object.entries(config.inputs)) {
            const inputValidation = validateInput(input, key);
            if (!inputValidation.valid) {
                return inputValidation;
            }
        }
    }

    // Validate outputs (required)
    if (!config.outputs || typeof config.outputs !== 'object') {
        return { valid: false, error: 'Missing or invalid "outputs" field' };
    }

    for (const [key, output] of Object.entries(config.outputs)) {
        const outputValidation = validateOutput(output, key);
        if (!outputValidation.valid) {
            return outputValidation;
        }
    }

    return { valid: true };
}

/**
 * Validates an input configuration
 * @param input The input configuration to validate
 * @param key The name of the input
 * @returns A validation result
 */
function validateInput(input: any, key: string): ValidationResult {
    if (!input || typeof input !== 'object') {
        return { valid: false, error: `Input "${key}" must be an object` };
    }

    // Check input_type
    if (!input.input_type || (input.input_type !== 'display' && input.input_type !== 'number')) {
        return { valid: false, error: `Input "${key}" has invalid "input_type": must be "display" or "number"` };
    }

    // Validate display_name if present
    if (input.display_name !== undefined && typeof input.display_name !== 'string') {
        return { valid: false, error: `Input "${key}" has invalid "display_name": must be a string` };
    }

    // Specific validation based on input_type
    if (input.input_type === 'display') {
        return validateDisplayInput(input, key);
    } else if (input.input_type === 'number') {
        return validateNumberInput(input, key);
    }

    return { valid: true };
}

/**
 * Validates a display input configuration
 * @param input The display input configuration to validate
 * @param key The name of the input
 * @returns A validation result
 */
function validateDisplayInput(input: any, key: string): ValidationResult {
    // Check data_type
    if (!input.data_type || !isValidType(input.data_type)) {
        return {
            valid: false,
            error: `Display input "${key}" has invalid "data_type": must be one of f32, vec2f, vec3f, vec4f`
        };
    }

    // Check default
    if (input.default === undefined || typeof input.default !== 'string') {
        return { valid: false, error: `Display input "${key}" must have a string "default" value` };
    }

    return { valid: true };
}

/**
 * Validates a number input configuration
 * @param input The number input configuration to validate
 * @param key The name of the input
 * @returns A validation result
 */
function validateNumberInput(input: any, key: string): ValidationResult {
    // Check data_type (currently only float is supported)
    if (!input.data_type || input.data_type !== 'float') {
        return { valid: false, error: `Number input "${key}" has invalid "data_type": must be "float"` };
    }

    // Check default
    if (input.default === undefined) {
        return { valid: false, error: `Number input "${key}" must have a "default" value` };
    }

    // Default can be a number or array of numbers
    if (typeof input.default !== 'number' &&
        (!Array.isArray(input.default) || !input.default.every((item: unknown) => typeof item === 'number'))) {
        return {
            valid: false,
            error: `Number input "${key}" has invalid "default": must be a number or array of numbers`
        };
    }

    return { valid: true };
}

/**
 * Validates an output configuration
 * @param output The output configuration to validate
 * @param key The name of the output
 * @returns A validation result
 */
function validateOutput(output: any, key: string): ValidationResult {
    if (!output || typeof output !== 'object') {
        return { valid: false, error: `Output "${key}" must be an object` };
    }

    // Check data_type
    if (!output.data_type || !isValidType(output.data_type)) {
        return {
            valid: false,
            error: `Output "${key}" has invalid "data_type": must be one of f32, vec2f, vec3f, vec4f`
        };
    }

    // Validate display_name if present
    if (output.display_name !== undefined && typeof output.display_name !== 'string') {
        return { valid: false, error: `Output "${key}" has invalid "display_name": must be a string` };
    }

    return { valid: true };
}

/**
 * Checks if a value is a valid Type
 * @param type The value to check
 * @returns Whether the value is a valid Type
 */
function isValidType(type: any): boolean {
    return ['f32', 'vec2f', 'vec3f', 'vec4f'].includes(type);
}