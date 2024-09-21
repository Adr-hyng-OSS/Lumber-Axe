import { FormBuilder } from "utils/form_builder";
import { cloneConfiguration } from "./configuration_handler";
export const serverConfiguration = {
    durabilityDamagePerBlock: new FormBuilder("LumberAxe.server.durability_damage_per_block").createTextField("0"),
    chopLimit: new FormBuilder("LumberAxe.server.chop_limit").createTextField("1000"),
    includedLog: new FormBuilder("LumberAxe.configuration.log_include_manager").createDropdown(['Empty'], "Empty"),
    excludedLog: new FormBuilder("LumberAxe.configuration.log_exclude_manager").createDropdown(['Empty'], "Empty"),
    immersiveMode: new FormBuilder("LumberAxe.server.immersive_chopping").createToggle(false),
    immersiveModeDelay: new FormBuilder("LumberAxe.server.immersive_delay").createTextField("5"),
    debug: new FormBuilder("Debug Mode").createToggle(true),
};
export let serverConfigurationCopy = cloneConfiguration(serverConfiguration);
export let setServerConfiguration = (newServerConfig) => serverConfigurationCopy = newServerConfig;
export let resetServerConfiguration = () => serverConfigurationCopy = cloneConfiguration(serverConfiguration);
export const VERSION = "1.0.11";
