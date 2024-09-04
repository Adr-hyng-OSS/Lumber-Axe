import { Player } from "@minecraft/server";
import { ADDON_NAME } from "constant";
import { FormBuilder } from "utils/form_builder";

export type ConfigurationTypes = "SERVER" | "CLIENT";
export const ConfigurationCollections_DB = (player: Player, configType: ConfigurationTypes = "CLIENT") => `${ADDON_NAME}|${player.id}|${configType}`;

export function cloneConfiguration<T extends Record<string, FormBuilder<any>>>(config: T): T {
  let clonedConfig = {} as T;
  for (const [key, _formBuilder] of Object.entries(config)) {
    const formBuilder = <FormBuilder<any>>_formBuilder;
    const isArrayEmpty = formBuilder.values.length > 0;
    const newFormBuilder = new FormBuilder<any>(formBuilder.name);
    if (typeof formBuilder.defaultValue === "string" && isArrayEmpty) {
      newFormBuilder.createDropdown(formBuilder.values, formBuilder.defaultValue);
    }
    else if (typeof formBuilder.defaultValue === "string" && !isArrayEmpty) {
      newFormBuilder.createTextField(formBuilder.defaultValue);
    } 
    else if (typeof formBuilder.defaultValue === "boolean") {
      newFormBuilder.createToggle(formBuilder.defaultValue as boolean);
    }
    clonedConfig[key as keyof T] = newFormBuilder as T[keyof T];
  }
  return clonedConfig;
}