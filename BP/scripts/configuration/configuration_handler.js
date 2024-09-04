import { ADDON_NAME } from "constant";
import { FormBuilder } from "utils/form_builder";
export const ConfigurationCollections_DB = (player, configType = "CLIENT") => `${ADDON_NAME}|${player.id}|${configType}`;
export function cloneConfiguration(config) {
    let clonedConfig = {};
    for (const [key, _formBuilder] of Object.entries(config)) {
        const formBuilder = _formBuilder;
        const isArrayEmpty = formBuilder.values.length > 0;
        const newFormBuilder = new FormBuilder(formBuilder.name);
        if (typeof formBuilder.defaultValue === "string" && isArrayEmpty) {
            newFormBuilder.createDropdown(formBuilder.values, formBuilder.defaultValue);
        }
        else if (typeof formBuilder.defaultValue === "string" && !isArrayEmpty) {
            newFormBuilder.createTextField(formBuilder.defaultValue);
        }
        else if (typeof formBuilder.defaultValue === "boolean") {
            newFormBuilder.createToggle(formBuilder.defaultValue);
        }
        clonedConfig[key] = newFormBuilder;
    }
    return clonedConfig;
}
