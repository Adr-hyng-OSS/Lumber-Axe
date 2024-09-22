import { Player } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, FormCancelationReason, ModalFormData, ModalFormResponse } from "@minecraft/server-ui";
import { ConfigurationCollections_DB, ConfigurationTypes} from "./configuration_handler";
import {ADDON_NAME, originalDatabase, resetOriginalDatabase} from "constant";
import { FormBuilder } from "utils/form_builder";
import { resetServerConfiguration, serverConfigurationCopy, setServerConfiguration } from "./server_configuration";
import { SendMessageTo } from "utils/utilities";

export class Configuration {
  private player: Player;
  private SERVER_CONFIGURATION_DB: string;
  private CLIENT_CONFIGURATION_DB: string

  isConfigurationSettingsOpen: boolean;
  constructor(player: Player) {
    this.player = player;
    this.isConfigurationSettingsOpen = false;
    this.CLIENT_CONFIGURATION_DB = ConfigurationCollections_DB(this.player, "CLIENT");
    this.SERVER_CONFIGURATION_DB = ConfigurationCollections_DB(this.player, "SERVER");
  }
  reset(configurationType: ConfigurationTypes) {
    if(originalDatabase.isValid()) {
      if(configurationType === "SERVER") {
        resetServerConfiguration();
        originalDatabase.set(this.SERVER_CONFIGURATION_DB, serverConfigurationCopy);
      }
    }
    else throw new Error("Database not found");
  }
  saveServer() {
    setServerConfiguration(serverConfigurationCopy);
    if (originalDatabase.isValid()) originalDatabase.set(this.SERVER_CONFIGURATION_DB, serverConfigurationCopy);
    else {
      resetOriginalDatabase();
    }
  }
  loadServer() {
    if (originalDatabase?.isValid()) {
      if (originalDatabase.has(this.SERVER_CONFIGURATION_DB)) {
        setServerConfiguration( originalDatabase.get(this.SERVER_CONFIGURATION_DB) );
      } else {
        originalDatabase.set(this.SERVER_CONFIGURATION_DB, serverConfigurationCopy);
      }
    } 
  }
  showServerScreen() {
    const parsedAddonTitle = ADDON_NAME.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    const form = new ActionFormData()
    .title({rawtext: [
      {translate: "LumberAxe.configuration.title", with: [parsedAddonTitle]}
    ]})
    .button({rawtext: [
      {translate: "LumberAxe.configuration.general"}
    ]})
    .button({rawtext: [
      {translate: "LumberAxe.configuration.log_include_manager"}
    ]})
    .button({rawtext: [
      {translate: "LumberAxe.configuration.log_exclude_manager"}
    ]})
    form.show(this.player).then( (response: ActionFormResponse) => {
      if (response.canceled || response.cancelationReason === FormCancelationReason.UserClosed || response.cancelationReason === FormCancelationReason.UserBusy) return;
      switch(response.selection) {
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
    const form: ModalFormData = new ModalFormData().title({rawtext: [
      {translate: "LumberAxe.configuration.general"}
    ]});
    
    this.loadServer();

    const cachedConfigurationValues: Array<{result: number | boolean | string, index: number}> = [];
    
    // Only good for read-only Dropdowns
    Object.values(serverConfigurationCopy).forEach((builder, index) => {
      const isNotDropdown = (builder.values.length === 0);
      if (typeof builder.defaultValue === "boolean" && isNotDropdown) {
        cachedConfigurationValues.push({result: builder.defaultValue, index});
        form.toggle({rawtext: [{translate: builder.name}]}, builder.defaultValue as boolean);
      } 
      else if (typeof builder.defaultValue === "string" && isNotDropdown) {
        cachedConfigurationValues.push({result: builder.defaultValue, index});
        form.textField({rawtext: [{translate: builder.name}]}, builder.defaultValue, builder.defaultValue);
      }
    });

    form.show(this.player).then((result: ModalFormResponse) => {
      if (!result.formValues) return;
      const hadChanges: boolean = !cachedConfigurationValues.every(({result: element}, i) => element === result.formValues[i]);
      if (result.canceled || result.cancelationReason === FormCancelationReason.UserClosed || result.cancelationReason === FormCancelationReason.UserBusy) {
        return;
      }
      if (hadChanges) {
        result.formValues.forEach((newValue, formIndex) => {
          const index = cachedConfigurationValues[formIndex].index;
          const key = Object.keys(serverConfigurationCopy)[index];
          const builder = serverConfigurationCopy[key] as FormBuilder<any>;
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
    const preResultFlags: Array<number | boolean | string> = [];
    let index = 0;
    preResultFlags[index] = 0; index++;
    preResultFlags[index] = ""; index++;
    preResultFlags[index] = false; index++;
    const form = new ModalFormData()
    .title({rawtext: [
      {translate: "LumberAxe.configuration.log_include_manager"}
    ]})
    .dropdown({rawtext: [
      {translate: "LumberAxe.log_include_manager.drop_down"}
    ]}, [...serverConfigurationCopy.includedLog.values], 0)
    .textField({rawtext: [
      {translate: "LumberAxe.log_include_manager.text_field"}
    ]}, "myaddon:custom_log", preResultFlags[1] as string)
    .toggle({rawtext: [
      {translate: "LumberAxe.log_include_manager.toggle"}
    ]}, preResultFlags[2] as boolean); 
    form.show(this.player).then((response: ModalFormResponse) => {
      if(!response.formValues) return;
      if (response.canceled || response.cancelationReason === FormCancelationReason.UserClosed || response.cancelationReason === FormCancelationReason.UserBusy) return;
      const hadChanges: boolean = !preResultFlags.every((element, index) => element === response.formValues[index]);
      const selectedIndex: number = (response.formValues[0] as number);
      let canUpdate: boolean = response.formValues[2] as boolean;
      const dropDownContent: string = response.formValues[1] as string;
      const dropDownSelected: number = (selectedIndex as number);
      const isEmpty: boolean = !dropDownContent.length;
      if (!hadChanges) return this.showServerScreen();
      if(isEmpty) canUpdate = false;
      if(canUpdate){
        if(selectedIndex === 0) {
          serverConfigurationCopy.includedLog.values.push(dropDownContent);
          SendMessageTo(this.player, {rawtext: [
            {text: `§aLumber Axe: `},
            {translate: "LumberAxe.log_include_manager.add_success_log", with: [dropDownContent]}
          ]});
        }
        else {
          if(serverConfigurationCopy.includedLog.values.length) {
            const prevValue = serverConfigurationCopy.includedLog.values[dropDownSelected];
            serverConfigurationCopy.includedLog.values[dropDownSelected] = dropDownContent;
            SendMessageTo(this.player, {rawtext: [
              {text: `§eLumber Axe: `},
              {translate: "LumberAxe.log_include_manager.update_success_log", with: [prevValue, dropDownContent]}
            ]});
          }
        }
      } else {
        if(serverConfigurationCopy.includedLog.values.length && selectedIndex !== 0) {
          const itemDeleted = serverConfigurationCopy.includedLog.values.splice(dropDownSelected, 1)[0];
          SendMessageTo(this.player, {rawtext: [
            {text: `§cLumber Axe: `},
            {translate: "LumberAxe.log_include_manager.remove_success_log", with: [itemDeleted]}
          ]});
        }
      }
      this.saveServer();
      return this.showServerScreen();
    });
  }
  showExcludeManager() {
    this.loadServer();
    const preResultFlags: Array<number | boolean | string> = [];
    let index = 0;
    preResultFlags[index] = 0; index++;
    preResultFlags[index] = ""; index++;
    preResultFlags[index] = false; index++;
    const form = new ModalFormData()
    .title({rawtext: [
      {translate: "LumberAxe.configuration.log_exclude_manager"}
    ]})
    .dropdown({rawtext: [
      {translate: "LumberAxe.log_exclude_manager.drop_down"}
    ]}, [...serverConfigurationCopy.excludedLog.values], 0)
    .textField({rawtext: [
      {translate: "LumberAxe.log_exclude_manager.drop_down"}
    ]}, "myaddon:custom_log", preResultFlags[1] as string)
    .toggle({rawtext: [
      {translate: "LumberAxe.log_exclude_manager.drop_down"}
    ]}, preResultFlags[2] as boolean);
    form.show(this.player).then((response: ModalFormResponse) => {
      if(!response.formValues) return;
      if (response.canceled || response.cancelationReason === FormCancelationReason.UserClosed || response.cancelationReason === FormCancelationReason.UserBusy) return;
      const hadChanges: boolean = !preResultFlags.every((element, index) => element === response.formValues[index]);
      const selectedIndex: number = (response.formValues[0] as number);
      let canUpdate: boolean = response.formValues[2] as boolean;
      const dropDownContent: string = response.formValues[1] as string;
      const dropDownSelected: number = (selectedIndex as number);
      const isEmpty: boolean = !dropDownContent.length;
      if (!hadChanges) return this.showServerScreen();
      if(isEmpty) canUpdate = false;
      if(canUpdate){
        if(selectedIndex === 0) {
          serverConfigurationCopy.excludedLog.values.push(dropDownContent);
          SendMessageTo(this.player, {rawtext: [
            {text: `§aLumber Axe: `},
            {translate: "LumberAxe.log_exclude_manager.add_success_log", with: [dropDownContent]}
          ]});
        }
        else {
          if(serverConfigurationCopy.excludedLog.values.length) {
            const prevValue = serverConfigurationCopy.includedLog.values[dropDownSelected];
            serverConfigurationCopy.excludedLog.values[dropDownSelected] = dropDownContent;
            SendMessageTo(this.player, {rawtext: [
              {text: `§eLumber Axe: `},
              {translate: "LumberAxe.log_exclude_manager.update_success_log", with: [prevValue, dropDownContent]}
            ]});
          }
        }
      } else {
        if(serverConfigurationCopy.excludedLog.values.length && selectedIndex !== 0) {
          const itemDeleted = serverConfigurationCopy.excludedLog.values.splice(dropDownSelected, 1)[0];
          SendMessageTo(this.player, {rawtext: [
            {text: `§cLumber Axe: `},
            {translate: "LumberAxe.log_exclude_manager.remove_success_log", with: [itemDeleted]}
          ]});
        }
      }
      this.saveServer();
      return this.showServerScreen();
    });
  }
}


