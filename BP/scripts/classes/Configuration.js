import { ConfigurationCollections_DB, db, getServerConfiguration, resetServerConfiguration, SERVER_CONFIGURATION, setServerConfiguration } from "index";
import { ActionFormData, FormCancelationReason, ModalFormData } from "@minecraft/server-ui";
export class __Configuration {
    constructor(player) {
        this.player = player;
        this.id = ConfigurationCollections_DB(this.player);
    }
    __load() {
        if (db.isValid) {
            if (db.has(this.id))
                setServerConfiguration(db.get(this.id));
            else
                db.set(this.id, getServerConfiguration());
        }
        else
            throw new Error("Database not found. Please check through !db_show, and !db_clear");
    }
    __save() {
        if (db.isValid)
            db.set(this.id, getServerConfiguration());
        else
            throw new Error("Database not found. Please check through !db_show, and !db_clear");
    }
    reset(includeDB = false) {
        if (db.isValid) {
            resetServerConfiguration();
            if (includeDB)
                db.set(this.id, getServerConfiguration());
        }
        else
            throw new Error("Database not found. Please check through !db_show, and !db_clear");
    }
    showMainScreen() {
        this.player.sendMessage("Close chat to open configuration.");
        const form = new ActionFormData()
            .title("Lumber Axe")
            .button("General Options")
            .button("Include Manager")
            .button("Exclude Manager")
            .button("More Info");
        form.show(this.player).then(async (response) => {
            if (response.canceled || response.cancelationReason === FormCancelationReason.UserClosed || response.cancelationReason === FormCancelationReason.UserBusy)
                return;
            if (response.selection === 0)
                this.showGeneralSettings();
            if (response.selection === 1)
                this.showIncludeManager();
            if (response.selection === 2)
                this.showExcludeManager();
            if (response.selection === 3)
                this.showMoreInfoScreen();
        });
    }
    showMoreInfoScreen() {
    }
    showGeneralSettings() {
        this.__load();
        const preResultFlags = [];
        let index = 0;
        preResultFlags[index] = SERVER_CONFIGURATION.durabilityDamagePerBlock;
        index++;
        preResultFlags[index] = SERVER_CONFIGURATION.chopLimit;
        index++;
        preResultFlags[index] = SERVER_CONFIGURATION.disableWatchDogTerminateLog;
        index++;
        const form = new ModalFormData()
            .title("General Options")
            .textField("Durability Damage", SERVER_CONFIGURATION.durabilityDamagePerBlock.toString(), SERVER_CONFIGURATION.durabilityDamagePerBlock.toString())
            .textField("Max Logs to Chop", SERVER_CONFIGURATION.chopLimit.toString(), SERVER_CONFIGURATION.chopLimit.toString())
            .toggle("Disable Watchdog Text", !!SERVER_CONFIGURATION.disableWatchDogTerminateLog);
        form.show(this.player).then((response) => {
            if (!response.formValues)
                return;
            const hadChanges = !preResultFlags.every((element, index) => element === response.formValues[index]);
            if (response.canceled || response.cancelationReason === FormCancelationReason.UserClosed || response.cancelationReason === FormCancelationReason.UserBusy)
                return;
            if (hadChanges) {
                index = 0;
                SERVER_CONFIGURATION.durabilityDamagePerBlock = response.formValues[index];
                index++;
                SERVER_CONFIGURATION.chopLimit = response.formValues[index];
                index++;
                SERVER_CONFIGURATION.disableWatchDogTerminateLog = response.formValues[index];
                index++;
                this.__save();
            }
            this.showMainScreen();
        });
    }
    showIncludeManager() {
        this.__load();
        const preResultFlags = [];
        let index = 0;
        preResultFlags[index] = 0;
        index++;
        preResultFlags[index] = "";
        index++;
        preResultFlags[index] = false;
        index++;
        const form = new ModalFormData()
            .title("Included Tree Logs")
            .dropdown("Included Logs", ["Empty", ...SERVER_CONFIGURATION.includedLog], 0)
            .textField("Inserted Log", "minecraft:custom_log", preResultFlags[1])
            .toggle("Insert / Update Log", preResultFlags[2]);
        form.show(this.player).then((response) => {
            if (!response.formValues)
                return;
            if (response.canceled || response.cancelationReason === FormCancelationReason.UserClosed || response.cancelationReason === FormCancelationReason.UserBusy)
                return;
            const hadChanges = !preResultFlags.every((element, index) => element === response.formValues[index]);
            const selectedIndex = response.formValues[0];
            let canUpdate = response.formValues[2];
            const dropDownContent = response.formValues[1];
            const dropDownSelected = selectedIndex - 1;
            const isEmpty = !dropDownContent.length;
            if (!hadChanges)
                return this.showMainScreen();
            if (isEmpty)
                canUpdate = false;
            const tempConfig = getServerConfiguration();
            if (canUpdate) {
                if (selectedIndex === 0)
                    tempConfig.includedLog.push(dropDownContent);
                else {
                    if (tempConfig.includedLog.length)
                        tempConfig.includedLog[dropDownSelected] = dropDownContent;
                }
            }
            else {
                if (tempConfig.includedLog.length && selectedIndex !== 0)
                    tempConfig.includedLog.splice(dropDownSelected, 1);
            }
            setServerConfiguration(tempConfig);
            this.__save();
            this.showMainScreen();
        });
    }
    showExcludeManager() {
        this.__load();
        const preResultFlags = [];
        let index = 0;
        preResultFlags[index] = 0;
        index++;
        preResultFlags[index] = "";
        index++;
        preResultFlags[index] = false;
        index++;
        const form = new ModalFormData()
            .title("Excluded Tree Logs")
            .dropdown("Excluded Logs", ["Empty", ...SERVER_CONFIGURATION.excludedLog], 0)
            .textField("Inserted Log", "minecraft:custom_log", preResultFlags[1])
            .toggle("Insert / Update Log", preResultFlags[2]);
        form.show(this.player).then((response) => {
            if (!response.formValues)
                return;
            if (response.canceled || response.cancelationReason === FormCancelationReason.UserClosed || response.cancelationReason === FormCancelationReason.UserBusy)
                return;
            const hadChanges = !preResultFlags.every((element, index) => element === response.formValues[index]);
            const selectedIndex = response.formValues[0];
            let canUpdate = response.formValues[2];
            const dropDownContent = response.formValues[1];
            const dropDownSelected = selectedIndex - 1;
            const isEmpty = !dropDownContent.length;
            if (!hadChanges)
                return this.showMainScreen();
            if (isEmpty)
                canUpdate = false;
            const tempConfig = getServerConfiguration();
            if (canUpdate) {
                if (selectedIndex === 0)
                    tempConfig.excludedLog.push(dropDownContent);
                else {
                    if (tempConfig.excludedLog.length)
                        tempConfig.excludedLog[dropDownSelected] = dropDownContent;
                }
            }
            else {
                if (tempConfig.excludedLog.length && selectedIndex !== 0)
                    tempConfig.excludedLog.splice(dropDownSelected, 1);
            }
            setServerConfiguration(tempConfig);
            this.__save();
            this.showMainScreen();
        });
    }
}
