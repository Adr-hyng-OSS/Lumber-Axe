import { ActionFormData, FormCancelationReason, ModalFormData } from "@minecraft/server-ui";
import { ConfigurationCollections_DB } from "./configuration_handler";
import { ADDON_NAME, db } from "constant";
import { resetServerConfiguration, serverConfigurationCopy, setServerConfiguration } from "./server_configuration";
import { SendMessageTo } from "utils/utilities";
export class Configuration {
    constructor(player) {
        this.player = player;
        this.isConfigurationSettingsOpen = false;
        this.CLIENT_CONFIGURATION_DB = ConfigurationCollections_DB(this.player, "CLIENT");
        this.SERVER_CONFIGURATION_DB = ConfigurationCollections_DB(this.player, "SERVER");
    }
    reset(configurationType) {
        if (db.isValid()) {
            if (configurationType === "SERVER") {
                resetServerConfiguration();
                db.set(this.SERVER_CONFIGURATION_DB, serverConfigurationCopy);
            }
        }
        else
            throw new Error("Database not found");
    }
    saveServer() {
        setServerConfiguration(serverConfigurationCopy);
        if (db.isValid())
            db.set(this.SERVER_CONFIGURATION_DB, serverConfigurationCopy);
    }
    loadServer() {
        if (db.isValid()) {
            if (db.has(this.SERVER_CONFIGURATION_DB)) {
                setServerConfiguration(db.get(this.SERVER_CONFIGURATION_DB));
            }
            else {
                db.set(this.SERVER_CONFIGURATION_DB, serverConfigurationCopy);
            }
        }
    }
    showServerScreen() {
        const parsedAddonTitle = ADDON_NAME.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
        const form = new ActionFormData()
            .title({ rawtext: [
                { translate: "LumberAxe.configuration.title", with: [parsedAddonTitle] }
            ] })
            .button({ rawtext: [
                { translate: "LumberAxe.configuration.general" }
            ] })
            .button({ rawtext: [
                { translate: "LumberAxe.configuration.log_include_manager" }
            ] })
            .button({ rawtext: [
                { translate: "LumberAxe.configuration.log_exclude_manager" }
            ] });
        form.show(this.player).then((response) => {
            if (response.canceled || response.cancelationReason === FormCancelationReason.UserClosed || response.cancelationReason === FormCancelationReason.UserBusy)
                return;
            switch (response.selection) {
                case 0: return this.showGeneralOptions();
                case 1: return this.showIncludeManager();
                case 2: return this.showExcludeManager();
                default:
                    break;
            }
            return;
        });
    }
    showGeneralOptions() {
        const form = new ModalFormData().title({ rawtext: [
                { translate: "LumberAxe.configuration.general" }
            ] });
        this.loadServer();
        const cachedConfigurationValues = [];
        Object.values(serverConfigurationCopy).forEach((builder, index) => {
            const isNotDropdown = (builder.values.length === 0);
            if (typeof builder.defaultValue === "boolean") {
                cachedConfigurationValues[index] = builder.defaultValue;
                form.toggle({ rawtext: [{ translate: builder.name }] }, cachedConfigurationValues[index]);
            }
            else if (typeof builder.defaultValue === "string" && isNotDropdown) {
                cachedConfigurationValues[index] = builder.defaultValue;
                form.textField({ rawtext: [{ translate: builder.name }] }, cachedConfigurationValues[index], builder.defaultValue);
            }
        });
        form.show(this.player).then((result) => {
            1;
            if (!result.formValues)
                return;
            const hadChanges = !cachedConfigurationValues.every((element, index) => element === result.formValues[index]);
            if (result.canceled || result.cancelationReason === FormCancelationReason.UserClosed || result.cancelationReason === FormCancelationReason.UserBusy) {
                return;
            }
            if (hadChanges) {
                result.formValues.forEach((newValue, formIndex) => {
                    const key = Object.keys(serverConfigurationCopy)[formIndex];
                    const builder = serverConfigurationCopy[key];
                    switch (typeof newValue) {
                        case "boolean":
                            builder.defaultValue = newValue;
                            break;
                        case "number":
                            builder.defaultValue = builder.values[newValue];
                            break;
                        case "string":
                            builder.defaultValue = newValue;
                            break;
                        default:
                            break;
                    }
                    serverConfigurationCopy[key] = builder;
                });
                this.saveServer();
            }
            return this.showServerScreen();
        });
    }
    showIncludeManager() {
        this.loadServer();
        const preResultFlags = [];
        let index = 0;
        preResultFlags[index] = 0;
        index++;
        preResultFlags[index] = "";
        index++;
        preResultFlags[index] = false;
        index++;
        const form = new ModalFormData()
            .title({ rawtext: [
                { translate: "LumberAxe.configuration.log_include_manager" }
            ] })
            .dropdown({ rawtext: [
                { translate: "LumberAxe.log_include_manager.drop_down" }
            ] }, [...serverConfigurationCopy.includedLog.values], 0)
            .textField({ rawtext: [
                { translate: "LumberAxe.log_include_manager.text_field" }
            ] }, "squid", preResultFlags[1])
            .toggle({ rawtext: [
                { translate: "LumberAxe.log_include_manager.toggle" }
            ] }, preResultFlags[2]);
        form.show(this.player).then((response) => {
            if (!response.formValues)
                return;
            if (response.canceled || response.cancelationReason === FormCancelationReason.UserClosed || response.cancelationReason === FormCancelationReason.UserBusy)
                return;
            const hadChanges = !preResultFlags.every((element, index) => element === response.formValues[index]);
            const selectedIndex = response.formValues[0];
            let canUpdate = response.formValues[2];
            const dropDownContent = response.formValues[1];
            const dropDownSelected = selectedIndex;
            const isEmpty = !dropDownContent.length;
            if (!hadChanges)
                return this.showServerScreen();
            if (isEmpty)
                canUpdate = false;
            if (canUpdate) {
                if (selectedIndex === 0) {
                    serverConfigurationCopy.includedLog.values.push(dropDownContent);
                    SendMessageTo(this.player, { rawtext: [
                            { text: `§aLumber Axe: ` },
                            { translate: "LumberAxe.log_include_manager.add_success_log", with: [dropDownContent] }
                        ] });
                }
                else {
                    if (serverConfigurationCopy.includedLog.values.length) {
                        const prevValue = serverConfigurationCopy.includedLog.values[dropDownSelected];
                        serverConfigurationCopy.includedLog.values[dropDownSelected] = dropDownContent;
                        SendMessageTo(this.player, { rawtext: [
                                { text: `§eLumber Axe: ` },
                                { translate: "LumberAxe.log_include_manager.update_success_log", with: [prevValue, dropDownContent] }
                            ] });
                    }
                }
            }
            else {
                if (serverConfigurationCopy.includedLog.values.length && selectedIndex !== 0) {
                    const itemDeleted = serverConfigurationCopy.includedLog.values.splice(dropDownSelected, 1)[0];
                    SendMessageTo(this.player, { rawtext: [
                            { text: `§cLumber Axe: ` },
                            { translate: "LumberAxe.log_include_manager.remove_success_log", with: [itemDeleted] }
                        ] });
                }
            }
            this.saveServer();
            return this.showServerScreen();
        });
    }
    showExcludeManager() {
        this.loadServer();
        const preResultFlags = [];
        let index = 0;
        preResultFlags[index] = 0;
        index++;
        preResultFlags[index] = "";
        index++;
        preResultFlags[index] = false;
        index++;
        const form = new ModalFormData()
            .title({ rawtext: [
                { translate: "LumberAxe.configuration.log_exclude_manager" }
            ] })
            .dropdown({ rawtext: [
                { translate: "LumberAxe.log_exclude_manager.drop_down" }
            ] }, [...serverConfigurationCopy.excludedLog.values], 0)
            .textField({ rawtext: [
                { translate: "LumberAxe.log_exclude_manager.drop_down" }
            ] }, "squid", preResultFlags[1])
            .toggle({ rawtext: [
                { translate: "LumberAxe.log_exclude_manager.drop_down" }
            ] }, preResultFlags[2]);
        form.show(this.player).then((response) => {
            if (!response.formValues)
                return;
            if (response.canceled || response.cancelationReason === FormCancelationReason.UserClosed || response.cancelationReason === FormCancelationReason.UserBusy)
                return;
            const hadChanges = !preResultFlags.every((element, index) => element === response.formValues[index]);
            const selectedIndex = response.formValues[0];
            let canUpdate = response.formValues[2];
            const dropDownContent = response.formValues[1];
            const dropDownSelected = selectedIndex;
            const isEmpty = !dropDownContent.length;
            if (!hadChanges)
                return this.showServerScreen();
            if (isEmpty)
                canUpdate = false;
            if (canUpdate) {
                if (selectedIndex === 0) {
                    serverConfigurationCopy.excludedLog.values.push(dropDownContent);
                    SendMessageTo(this.player, { rawtext: [
                            { text: `§aLumber Axe: ` },
                            { translate: "LumberAxe.log_exclude_manager.add_success_log", with: [dropDownContent] }
                        ] });
                }
                else {
                    if (serverConfigurationCopy.excludedLog.values.length) {
                        const prevValue = serverConfigurationCopy.includedLog.values[dropDownSelected];
                        serverConfigurationCopy.excludedLog.values[dropDownSelected] = dropDownContent;
                        SendMessageTo(this.player, { rawtext: [
                                { text: `§eLumber Axe: ` },
                                { translate: "LumberAxe.log_exclude_manager.update_success_log", with: [prevValue, dropDownContent] }
                            ] });
                    }
                }
            }
            else {
                if (serverConfigurationCopy.excludedLog.values.length && selectedIndex !== 0) {
                    const itemDeleted = serverConfigurationCopy.excludedLog.values.splice(dropDownSelected, 1)[0];
                    SendMessageTo(this.player, { rawtext: [
                            { text: `§cLumber Axe: ` },
                            { translate: "LumberAxe.log_exclude_manager.remove_success_log", with: [itemDeleted] }
                        ] });
                }
            }
            this.saveServer();
            return this.showServerScreen();
        });
    }
}
